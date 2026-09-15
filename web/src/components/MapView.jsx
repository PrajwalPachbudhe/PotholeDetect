import { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Tile provider URLs
const TILE_LAYERS = {
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: 'abc',
    attribution: '&copy; Esri Earthstar',
    maxZoom: 19,
  },
  street: {
    name: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  dark: {
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  },
};

export default function MapView({
  hazards = [],
  currentGps,
  isGpsTracking,
  isSimulating,
  onStartGps,
  onStopGps,
  onToggleSimulation,
  onDeleteHazard,
  user,
  showToast,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(L.layerGroup());
  const roadTrafficLayerRef = useRef(L.layerGroup());
  const vehicleMarkerRef = useRef(null);
  const gpsPathCoordsRef = useRef([]);
  const gpsPathPolylineRef = useRef(null);

  const [selectedHazard, setSelectedHazard] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [mapStyle, setMapStyle] = useState('satellite');
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [followVehicle, setFollowVehicle] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [geoResults, setGeoResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeHazardsList = useMemo(() => {
    return hazards && hazards.length > 0 ? hazards : [];
  }, [hazards]);

  useEffect(() => {
    if (selectedHazard) {
      const exists = activeHazardsList.some((h) => h.id === selectedHazard.id);
      if (!exists) {
        setSelectedHazard(activeHazardsList.length > 0 ? activeHazardsList[0] : null);
        if (activeHazardsList.length === 0) {
          setIsSheetOpen(false);
        }
      }
    } else if (activeHazardsList.length > 0) {
      setSelectedHazard(activeHazardsList[0]);
    }
  }, [activeHazardsList, selectedHazard]);

  // Determine initial center: prefer current user GPS, cached GPS, or latest detected pothole
  const initialCenter = useMemo(() => {
    if (currentGps?.lat && currentGps?.lng) {
      return [currentGps.lat, currentGps.lng];
    }
    try {
      const saved = localStorage.getItem('pothole_last_known_gps');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lat && parsed.lng) return [parsed.lat, parsed.lng];
      }
    } catch {
      // ignore
    }
    if (activeHazardsList.length > 0 && activeHazardsList[0].lat && activeHazardsList[0].lng) {
      return [activeHazardsList[0].lat, activeHazardsList[0].lng];
    }
    return [20.5937, 78.9629]; // Default coordinates
  }, [currentGps, activeHazardsList]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 16,
      zoomControl: false,
    });

    const layerConfig = TILE_LAYERS[mapStyle] || TILE_LAYERS.dark;
    const tileLayer = L.tileLayer(layerConfig.url, {
      subdomains: layerConfig.subdomains || 'abc',
      attribution: layerConfig.attribution,
      maxZoom: layerConfig.maxZoom || 19,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    roadTrafficLayerRef.current.addTo(map);
    markersLayerRef.current.addTo(map);

    mapInstanceRef.current = map;

    // Trigger multiple resize invalidations to guarantee full render
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 350);
    const t3 = setTimeout(() => map.invalidateSize(), 800);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Base Tile Style
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const layerConfig = TILE_LAYERS[mapStyle] || TILE_LAYERS.dark;
    tileLayerRef.current.setUrl(layerConfig.url);
  }, [mapStyle]);

  // Render Pothole Spot Indicators (Precise localized road defect circles and Google Maps incident markers)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    markersLayerRef.current.clearLayers();
    roadTrafficLayerRef.current.clearLayers();

    if (!showMarkers && !showTrafficLayer) return;

    const filtered = activeHazardsList.filter((hazard) => {
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        hazard.title?.toLowerCase().includes(q) ||
        hazard.id?.toLowerCase().includes(q) ||
        hazard.coordsText?.toLowerCase().includes(q);
      const matchSeverity = filterSeverity === 'all' || hazard.severity === filterSeverity;
      return matchQuery && matchSeverity;
    });

    filtered.forEach((hazard) => {
      const isCritical = hazard.severity === 'critical';
      const isSelected = selectedHazard?.id === hazard.id;
      const spotColor = isCritical ? '#ef4444' : '#f59e0b';

      // 1. Precise Localized Pavement Defect Circle (tight 6m-10m radius right on the road surface)
      if (showTrafficLayer) {
        // Outer pulsing hazard ring
        const outerCircle = L.circle([hazard.lat, hazard.lng], {
          radius: isCritical ? 10 : 7,
          color: spotColor,
          fillColor: spotColor,
          fillOpacity: 0.25,
          weight: 2,
          className: isCritical ? 'traffic-danger-line' : 'traffic-warning-line',
        }).addTo(roadTrafficLayerRef.current);

        // Inner solid core spot
        const innerCircle = L.circle([hazard.lat, hazard.lng], {
          radius: 3.5,
          color: '#ffffff',
          fillColor: spotColor,
          fillOpacity: 0.9,
          weight: 1.5,
        }).addTo(roadTrafficLayerRef.current);

        const spotTooltip = `
          <div class="p-2 font-body text-slate-100 min-w-[160px]">
            <div class="flex items-center gap-1.5 mb-0.5">
              <span class="w-2.5 h-2.5 rounded-full ${isCritical ? 'bg-red-500' : 'bg-amber-500'}"></span>
              <span class="text-xs font-bold font-heading">${hazard.title || 'Road Pothole'}</span>
            </div>
            <div class="text-[10px] text-slate-300 font-mono">
              Severity: <strong class="${isCritical ? 'text-red-400' : 'text-amber-400'}">${hazard.severity.toUpperCase()}</strong>
            </div>
            <div class="text-[10px] text-cyan-400 font-mono mt-0.5">
              ${hazard.coordsText || `${hazard.lat?.toFixed(5)}°N, ${hazard.lng?.toFixed(5)}°W`}
            </div>
          </div>
        `;
        outerCircle.bindTooltip(spotTooltip, { sticky: true, className: 'google-maps-traffic-tooltip' });
        innerCircle.on('click', () => {
          setSelectedHazard(hazard);
          setIsSheetOpen(true);
        });
      }

      // 2. Google Maps Pothole Pin Marker directly over the spot
      if (showMarkers) {
        const markerHtml = `
          <div class="relative flex flex-col items-center cursor-pointer group ${
            isSelected ? 'scale-125 z-40' : 'z-20'
          } transition-transform">
            <div class="absolute -bottom-1 w-5 h-2 rounded-full ${
              isCritical
                ? 'bg-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.9)]'
                : 'bg-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.9)]'
            } blur-[2px]"></div>
            <div class="w-7 h-7 rounded-full ${
              isCritical
                ? 'bg-[#111827] border-2 border-red-500 text-red-400 shadow-[0_0_16px_rgba(239,68,68,0.7)]'
                : 'bg-[#111827] border-2 border-amber-500 text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.7)]'
            } flex items-center justify-center font-bold">
              <span class="material-symbols-outlined text-[13px]">
                ${isCritical ? 'crisis_alert' : 'warning'}
              </span>
            </div>
            <div class="w-0.5 h-2 ${isCritical ? 'bg-red-500' : 'bg-amber-500'}"></div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-pothole-marker',
          iconSize: [28, 36],
          iconAnchor: [14, 36],
        });

        const marker = L.marker([hazard.lat, hazard.lng], { icon: customIcon }).addTo(
          markersLayerRef.current
        );

        marker.on('click', () => {
          setSelectedHazard(hazard);
          setIsSheetOpen(true);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([hazard.lat, hazard.lng], 17, { duration: 0.6 });
          }
        });
      }
    });
  }, [activeHazardsList, searchQuery, filterSeverity, selectedHazard, showMarkers, showTrafficLayer]);

  // Update Live GPS Vehicle Navigation & Real-Time Travel Track
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (!currentGps || !currentGps.lat || !currentGps.lng) {
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }
      return;
    }

    const { lat, lng, heading = 0 } = currentGps;

    // Track vehicle path breadcrumbs
    const lastCoord = gpsPathCoordsRef.current[gpsPathCoordsRef.current.length - 1];
    if (!lastCoord || Math.abs(lastCoord[0] - lat) > 0.00005 || Math.abs(lastCoord[1] - lng) > 0.00005) {
      gpsPathCoordsRef.current.push([lat, lng]);
      if (gpsPathCoordsRef.current.length > 50) {
        gpsPathCoordsRef.current.shift();
      }

      if (gpsPathCoordsRef.current.length > 1) {
        if (!gpsPathPolylineRef.current) {
          gpsPathPolylineRef.current = L.polyline(gpsPathCoordsRef.current, {
            color: '#3b82f6',
            weight: 5,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(roadTrafficLayerRef.current);
        } else {
          gpsPathPolylineRef.current.setLatLngs(gpsPathCoordsRef.current);
        }
      }
    }

    // Google Maps Navigation Arrow / Puck
    const vehicleHtml = `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-12 h-12 rounded-full bg-blue-500/25 animate-ping"></div>
        <div 
          class="absolute w-14 h-14 rounded-full pointer-events-none transition-transform duration-300"
          style="transform: rotate(${heading}deg); background: radial-gradient(circle at 50% 15%, rgba(59,130,246,0.6) 0%, transparent 60%);"
        ></div>
        <div class="relative w-7 h-7 rounded-full bg-blue-500 border-2 border-white shadow-[0_0_18px_rgba(59,130,246,0.9)] flex items-center justify-center text-white">
          <span 
            class="material-symbols-outlined text-[16px] transition-transform duration-300" 
            style="transform: rotate(${heading}deg);"
          >
            navigation
          </span>
        </div>
      </div>
    `;

    const vehicleIcon = L.divIcon({
      html: vehicleHtml,
      className: 'custom-vehicle-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    if (!vehicleMarkerRef.current) {
      vehicleMarkerRef.current = L.marker([lat, lng], {
        icon: vehicleIcon,
        zIndexOffset: 1000,
      }).addTo(mapInstanceRef.current);
    } else {
      vehicleMarkerRef.current.setLatLng([lat, lng]);
      vehicleMarkerRef.current.setIcon(vehicleIcon);
    }

    if (followVehicle && mapInstanceRef.current) {
      mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 0.4 });
    }
  }, [currentGps, followVehicle]);

  // Geocoding Search handler
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setGeoResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            q
          )}&limit=4&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (res.ok) {
          const data = await res.json();
          setGeoResults(
            data.map((item) => ({
              name: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            }))
          );
        }
      } catch (err) {
        console.warn('Geocoding search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectHazard = (hazard) => {
    setSelectedHazard(hazard);
    setIsSheetOpen(true);
    setShowDropdown(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([hazard.lat, hazard.lng], 17, { duration: 0.8 });
    }
    showToast?.(`Focused on ${hazard.title || hazard.id}`, 'info');
  };

  const handleSelectGeoPlace = (place) => {
    setShowDropdown(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([place.lat, place.lng], 15, { duration: 1 });
    }
    showToast?.(`Navigated to ${place.name.split(',')[0]}`, 'info');
  };

  const handleRecenter = () => {
    if (currentGps?.lat && currentGps?.lng && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([currentGps.lat, currentGps.lng], 17, { duration: 0.8 });
      setFollowVehicle(true);
      showToast?.('Centered on live vehicle GPS', 'info');
    } else if (activeHazardsList.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([activeHazardsList[0].lat, activeHazardsList[0].lng], 17, { duration: 0.8 });
      showToast?.('Centered on detected pothole', 'info');
    }
  };

  return (
    <main className="flex-1 relative w-full h-full min-h-0 flex flex-col overflow-hidden bg-[#0a0e17]">
      {/* Top Floating Header & Controls Container */}
      <div className="absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-4 z-[400] pointer-events-none flex flex-col md:flex-row justify-between items-stretch md:items-start gap-2">
        {/* Search Input */}
        <div className="pointer-events-auto relative w-full md:max-w-xs lg:max-w-sm flex-shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (activeHazardsList.length > 0) handleSelectHazard(activeHazardsList[0]);
            }}
            className="bg-[#111827]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl px-3.5 py-2 flex items-center gap-2.5 shadow-2xl hover:border-amber-500/40 transition-colors"
          >
            <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              placeholder="Search road or defect ID..."
              className="bg-transparent border-none text-slate-100 placeholder-slate-500 text-xs focus:outline-none w-full"
            />
            {isSearching && (
              <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setGeoResults([]);
                  setShowDropdown(false);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </form>

          {/* Autocomplete Suggestions */}
          {showDropdown && searchQuery.trim().length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1.5 bg-[#111827]/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 max-h-64 overflow-y-auto space-y-1"
              onMouseLeave={() => setShowDropdown(false)}
            >
              {activeHazardsList.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                    Pothole Hazards ({activeHazardsList.length})
                  </div>
                  {activeHazardsList.slice(0, 4).map((hazard) => (
                    <button
                      key={hazard.id}
                      onClick={() => handleSelectHazard(hazard)}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-800/80 flex items-center justify-between transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span
                          className={`material-symbols-outlined text-sm ${
                            hazard.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                          }`}
                        >
                          {hazard.severity === 'critical' ? 'crisis_alert' : 'warning'}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-slate-100 group-hover:text-amber-400 truncate">
                            {hazard.title}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">
                            {hazard.coordsText || `${hazard.lat?.toFixed(4)}, ${hazard.lng?.toFixed(4)}`}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          hazard.severity === 'critical'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {hazard.severity}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {geoResults.length > 0 && (
                <div className="pt-1 border-t border-slate-800">
                  <div className="px-2.5 py-1 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                    Global Locations
                  </div>
                  {geoResults.map((place, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectGeoPlace(place)}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-800/80 flex items-center gap-2 text-slate-300 hover:text-cyan-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm text-cyan-400">location_on</span>
                      <span className="text-xs truncate">{place.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Pills Bar (Horizontal scroll on mobile, flex on desktop) */}
        <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          {/* 7-Day Active Map Indicator */}
          <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl px-2.5 py-1 flex items-center gap-1.5 text-amber-300 text-[10px] font-mono font-bold shadow-xl flex-shrink-0 backdrop-blur-xl">
            <span className="material-symbols-outlined text-xs text-amber-400">history</span>
            <span>7-Day Active Dots</span>
          </div>

          {/* Map Layer Switcher */}
          <div className="bg-[#111827]/95 backdrop-blur-xl border border-slate-700/80 rounded-xl p-0.5 flex items-center gap-0.5 shadow-xl flex-shrink-0">
            {Object.keys(TILE_LAYERS).map((styleKey) => (
              <button
                key={styleKey}
                onClick={() => setMapStyle(styleKey)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold capitalize transition-colors flex items-center gap-1 ${
                  mapStyle === styleKey
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {styleKey === 'satellite' && <span>🛰️</span>}
                {styleKey === 'street' && <span>🛣️</span>}
                {styleKey === 'dark' && <span>🌙</span>}
                <span>{styleKey}</span>
              </button>
            ))}
          </div>

          {/* Road Defect Hotspots Toggle */}
          <button
            onClick={() => {
              setShowTrafficLayer(!showTrafficLayer);
              showToast?.(
                showTrafficLayer ? 'Road defect hotspots hidden' : 'Road defect hotspots active',
                'info'
              );
            }}
            className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold border transition-all flex items-center gap-1 backdrop-blur-xl shadow-xl flex-shrink-0 ${
              showTrafficLayer
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-[#111827]/95 text-slate-400 border-slate-700/80'
            }`}
          >
            <span className="material-symbols-outlined text-sm">traffic</span>
            <span>Hotspots</span>
            {showTrafficLayer && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </button>

          {/* GPS Simulation Toggle */}
          <button
            onClick={() => {
              if (isSimulating) {
                onToggleSimulation?.();
                showToast?.('Drive simulation stopped', 'info');
              } else {
                onToggleSimulation?.();
                showToast?.('🚗 Drive Route simulation active', 'success');
              }
            }}
            className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1 transition-all border backdrop-blur-xl shadow-xl flex-shrink-0 ${
              isSimulating
                ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_12px_rgba(37,99,235,0.6)] animate-pulse'
                : 'bg-[#111827]/95 text-slate-300 border-slate-700/80 hover:text-blue-400'
            }`}
          >
            <span className="material-symbols-outlined text-xs">directions_car</span>
            <span>{isSimulating ? 'Sim On' : 'Simulate'}</span>
          </button>

          {/* Live Device GPS Toggle */}
          <button
            onClick={() => {
              if (isGpsTracking && !isSimulating) {
                onStopGps?.();
                showToast?.('GPS tracking paused', 'info');
              } else {
                onStartGps?.();
                showToast?.('Live GPS tracking started', 'success');
              }
            }}
            className={`p-1.5 rounded-xl text-xs font-bold transition-all border backdrop-blur-xl shadow-xl flex-shrink-0 ${
              isGpsTracking && !isSimulating
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-[#111827]/95 text-slate-400 border-slate-700/80 hover:text-slate-200'
            }`}
            title="Toggle Live Device GPS"
          >
            <span className="material-symbols-outlined text-sm">gps_fixed</span>
          </button>

          {/* Recenter Button */}
          <button
            onClick={handleRecenter}
            className={`p-1.5 rounded-xl border backdrop-blur-xl shadow-xl flex items-center justify-center transition-all flex-shrink-0 ${
              followVehicle
                ? 'bg-[#111827]/95 border-blue-500 text-blue-400'
                : 'bg-[#111827]/95 border-slate-700/80 text-slate-300 hover:text-amber-400'
            }`}
            title="Recenter Map"
          >
            <span className="material-symbols-outlined text-sm">my_location</span>
          </button>
        </div>
      </div>

      {/* Floating Speedometer & Live Telemetry Badge (Positioned below top pills) */}
      {currentGps && (
        <div className="absolute top-[88px] md:top-20 left-2 md:left-4 z-[350] pointer-events-auto bg-[#111827]/90 backdrop-blur-xl border border-slate-700/80 rounded-xl p-2 md:p-3 shadow-2xl flex items-center gap-2.5 max-w-[280px] md:max-w-sm animate-in fade-in">
          <div className="w-9 h-9 md:w-11 md:h-11 rounded-lg bg-blue-500/15 border border-blue-500/40 flex flex-col items-center justify-center text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)] flex-shrink-0">
            <span className="text-xs md:text-sm font-extrabold font-heading leading-none">
              {currentGps.speed || 0}
            </span>
            <span className="text-[7px] font-mono uppercase text-slate-400">km/h</span>
          </div>

          <div className="flex flex-col min-w-0 pr-1">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider truncate">
                LIVE GPS
              </span>
            </div>
            <p className="text-[11px] md:text-xs font-bold text-slate-100 truncate mt-0.5">
              {currentGps.address || 'Road Track'}
            </p>
            <p className="text-[9px] font-mono text-cyan-400 truncate">
              {currentGps.lat?.toFixed(4)}°N, {currentGps.lng?.toFixed(4)}°W • Head {currentGps.heading || 0}°
            </p>
          </div>
        </div>
      )}

      {/* Map Viewport Container - Covers 100% Full Viewport Area */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-10" />

      {/* Selected Hazard Drawer / Bottom Card */}
      {selectedHazard && (
        <div
          className={`absolute bottom-3 md:bottom-4 left-2 right-2 md:left-auto md:right-4 md:w-96 z-[500] bg-[#111827]/95 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-[0_-8px_35px_rgba(0,0,0,0.7)] transition-all duration-300`}
        >
          {/* Collapsed Header / Toggle */}
          <div
            onClick={() => setIsSheetOpen(!isSheetOpen)}
            className="p-3 flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
                  selectedHazard.severity === 'critical'
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                }`}
              >
                {selectedHazard.severity}
              </span>
              <p className="text-xs font-bold text-slate-100 truncate">
                {selectedHazard.title || 'Road Defect'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-mono text-amber-400">
                {isSheetOpen ? 'Hide' : 'Details'}
              </span>
              <span className="material-symbols-outlined text-base text-slate-400">
                {isSheetOpen ? 'expand_more' : 'expand_less'}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedHazard(null);
                }}
                className="w-6 h-6 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-slate-200 ml-1"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          </div>

          {/* Expanded Content */}
          {isSheetOpen && (
            <div className="px-3 pb-3 pt-1 border-t border-slate-800/80 flex flex-col gap-2.5 animate-in fade-in">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-800 overflow-hidden relative aspect-video bg-black">
                  <img
                    src={
                      selectedHazard.image?.startsWith('data:')
                        ? selectedHazard.image
                        : selectedHazard.image ||
                          'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=600&auto=format&fit=crop'
                    }
                    alt={selectedHazard.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 right-1 bg-black/80 rounded px-1.5 py-0.5 text-[9px] font-mono text-cyan-400 border border-cyan-500/30">
                    Conf {selectedHazard.confidence || '94%'}
                  </div>
                </div>

                <div className="flex flex-col justify-between text-xs font-mono">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase">Coordinates</span>
                    <p className="text-[10px] font-bold text-cyan-400 truncate mt-0.5">
                      {selectedHazard.coordsText || `${selectedHazard.lat?.toFixed(4)}°N, ${selectedHazard.lng?.toFixed(4)}°W`}
                    </p>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 mt-1">
                    <span className="text-[9px] text-slate-400 uppercase">Detected</span>
                    <p className="text-[10px] font-bold text-slate-200 truncate mt-0.5">
                      {selectedHazard.detectedTime || selectedHazard.timestamp || 'Just now'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedHazard.lat},${selectedHazard.lng}`;
                    window.open(url, '_blank');
                    showToast?.(`Opening Google Maps navigation...`, 'info');
                  }}
                  className="flex-1 bg-slate-900 border border-slate-700/80 hover:border-amber-500/40 rounded-xl py-2 flex items-center justify-center gap-1 text-slate-200 font-semibold text-xs transition-all"
                >
                  <span className="material-symbols-outlined text-sm text-cyan-400">directions</span>
                  Route
                </button>

                {onDeleteHazard && (
                  <button
                    disabled={isDeleting}
                    onClick={async () => {
                      if (window.confirm(`Delete this hazard pin (${selectedHazard.id || selectedHazard.title})?`)) {
                        setIsDeleting(true);
                        try {
                          await onDeleteHazard(selectedHazard.id);
                          setSelectedHazard(null);
                        } finally {
                          setIsDeleting(false);
                        }
                      }
                    }}
                    className="px-3 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/40 rounded-xl py-2 flex items-center justify-center gap-1 text-xs font-semibold transition-all active:scale-95"
                    title="Delete Hazard Pin"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Delete Pin
                  </button>
                )}

                <button
                  onClick={() => {
                    showToast?.(`Hazard report dispatched for ${selectedHazard.id}!`, 'success');
                  }}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1 shadow-md shadow-amber-500/20"
                >
                  <span className="material-symbols-outlined text-sm">assignment</span>
                  Dispatch
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

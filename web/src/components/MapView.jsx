import { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Tile provider URLs
const TILE_LAYERS = {
  dark: {
    name: 'Carto Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; CARTO &copy; OpenStreetMap',
    maxZoom: 20,
  },
  satellite: {
    name: 'Satellite Hybrid',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: 'abc',
    attribution: '&copy; Esri &mdash; Earthstar Geographics',
    maxZoom: 19,
  },
  street: {
    name: 'Street Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

// Base road network corridors for Google Maps traffic-style representation
export const BASE_ROAD_NETWORK = [
  {
    id: 'road-main-st',
    name: 'Main Street Corridor',
    status: 'danger',
    potholeCount: 3,
    avgSpeed: '18 km/h (Slow - Road Damage)',
    coordinates: [
      [34.0505, -118.2415],
      [34.0522, -118.2437],
      [34.0531, -118.2465],
      [34.0545, -118.2490],
      [34.0560, -118.2515],
    ],
  },
  {
    id: 'road-grand-ave',
    name: 'Grand Avenue Arterial',
    status: 'danger',
    potholeCount: 2,
    avgSpeed: '22 km/h (Pothole Congestion)',
    coordinates: [
      [34.0530, -118.2560],
      [34.0545, -118.2520],
      [34.0558, -118.2485],
      [34.0575, -118.2450],
    ],
  },
  {
    id: 'road-broadway',
    name: 'Broadway Boulevard',
    status: 'warning',
    potholeCount: 1,
    avgSpeed: '36 km/h (Moderate Caution)',
    coordinates: [
      [34.0450, -118.2520],
      [34.0485, -118.2495],
      [34.0510, -118.2475],
      [34.0535, -118.2455],
    ],
  },
  {
    id: 'road-wilshire',
    name: 'Wilshire Boulevard Express',
    status: 'warning',
    potholeCount: 1,
    avgSpeed: '32 km/h (Surface Distress)',
    coordinates: [
      [34.0498, -118.2630],
      [34.0498, -118.2580],
      [34.0500, -118.2530],
      [34.0502, -118.2480],
    ],
  },
  {
    id: 'road-sunset-hwy',
    name: 'Sunset Highway Express',
    status: 'danger',
    potholeCount: 2,
    avgSpeed: '25 km/h (Deep Craters)',
    coordinates: [
      [34.0590, -118.2480],
      [34.0570, -118.2400],
      [34.0555, -118.2350],
      [34.0540, -118.2300],
    ],
  },
  {
    id: 'road-figueroa-north',
    name: 'North Figueroa Safe Corridor',
    status: 'clear',
    potholeCount: 0,
    avgSpeed: '55 km/h (Clear & Smooth)',
    coordinates: [
      [34.0580, -118.2550],
      [34.0560, -118.2580],
      [34.0530, -118.2610],
      [34.0500, -118.2640],
    ],
  },
  {
    id: 'road-olympic-clear',
    name: 'Olympic Expressway (Eastbound)',
    status: 'clear',
    potholeCount: 0,
    avgSpeed: '60 km/h (Optimal Condition)',
    coordinates: [
      [34.0420, -118.2650],
      [34.0420, -118.2550],
      [34.0420, -118.2450],
      [34.0420, -118.2380],
    ],
  },
  {
    id: 'road-spring-clear',
    name: 'Spring Street Bypass',
    status: 'clear',
    potholeCount: 0,
    avgSpeed: '48 km/h (Pavement Inspected)',
    coordinates: [
      [34.0470, -118.2450],
      [34.0490, -118.2430],
      [34.0510, -118.2410],
      [34.0530, -118.2390],
    ],
  },
];

export default function MapView({
  hazards = [],
  currentGps,
  isGpsTracking,
  isSimulating,
  onStartGps,
  onStopGps,
  onToggleSimulation,
  showToast,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(L.layerGroup());
  const roadTrafficLayerRef = useRef(L.layerGroup());
  const vehicleMarkerRef = useRef(null);

  const [selectedHazard, setSelectedHazard] = useState(null);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [mapStyle, setMapStyle] = useState('dark');
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [followVehicle, setFollowVehicle] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [geoResults, setGeoResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const activeHazardsList = useMemo(() => {
    return hazards && hazards.length > 0 ? hazards : [];
  }, [hazards]);

  useEffect(() => {
    if (!selectedHazard && activeHazardsList.length > 0) {
      setSelectedHazard(activeHazardsList[0]);
    }
  }, [activeHazardsList, selectedHazard]);

  // Combine roads with detected hazards
  const roadNetwork = useMemo(() => {
    const roads = [...BASE_ROAD_NETWORK];

    activeHazardsList.forEach((hazard) => {
      const isAlreadyCovered = roads.some((r) =>
        r.coordinates.some(
          (c) => Math.abs(c[0] - hazard.lat) < 0.0006 && Math.abs(c[1] - hazard.lng) < 0.0006
        )
      );

      if (!isAlreadyCovered && hazard.lat && hazard.lng) {
        roads.push({
          id: `dynamic-road-${hazard.id}`,
          name: hazard.title || `Road Corridor at ${hazard.coordsText || 'GPS Point'}`,
          status: hazard.severity === 'critical' ? 'danger' : 'warning',
          potholeCount: 1,
          avgSpeed: hazard.severity === 'critical' ? '15 km/h (Severe Defect)' : '30 km/h (Caution)',
          coordinates: [
            [hazard.lat - 0.0012, hazard.lng - 0.0008],
            [hazard.lat, hazard.lng],
            [hazard.lat + 0.0012, hazard.lng + 0.0008],
          ],
        });
      }
    });

    return roads;
  }, [activeHazardsList]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = currentGps?.lat || 34.0515;
    const initialLng = currentGps?.lng || -118.2480;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
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

    // Trigger multiple resize invalidations to ensure smooth rendering
    const t1 = setTimeout(() => map.invalidateSize(), 80);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    const t3 = setTimeout(() => map.invalidateSize(), 700);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Base Tile
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const layerConfig = TILE_LAYERS[mapStyle] || TILE_LAYERS.dark;
    tileLayerRef.current.setUrl(layerConfig.url);
  }, [mapStyle]);

  // Render Google Maps Traffic Lines
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    roadTrafficLayerRef.current.clearLayers();

    if (!showTrafficLayer) return;

    roadNetwork.forEach((road) => {
      let strokeColor = '#10b981';
      let casingColor = '#064e3b';
      let glowClass = '';

      if (road.status === 'danger') {
        strokeColor = '#ef4444';
        casingColor = '#7f1d1d';
        glowClass = 'traffic-danger-line';
      } else if (road.status === 'warning') {
        strokeColor = '#f59e0b';
        casingColor = '#78350f';
        glowClass = 'traffic-warning-line';
      }

      // Outer Casing / Border
      const casing = L.polyline(road.coordinates, {
        color: casingColor,
        weight: 10,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(roadTrafficLayerRef.current);

      // Inner Vivid Traffic Color
      const innerLine = L.polyline(road.coordinates, {
        color: strokeColor,
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        className: glowClass,
      }).addTo(roadTrafficLayerRef.current);

      const roadTooltip = `
        <div class="p-2 font-body text-slate-100 min-w-[180px]">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="w-2.5 h-2.5 rounded-full ${
              road.status === 'danger'
                ? 'bg-red-500'
                : road.status === 'warning'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }"></span>
            <span class="text-xs font-bold font-heading">${road.name}</span>
          </div>
          <div class="text-[11px] font-mono text-slate-300">
            Road Status: <strong class="${
              road.status === 'danger'
                ? 'text-red-400'
                : road.status === 'warning'
                ? 'text-amber-400'
                : 'text-emerald-400'
            }">${road.status.toUpperCase()}</strong>
          </div>
          <div class="text-[10px] text-slate-400 font-mono mt-0.5">
            Avg Speed: ${road.avgSpeed}
          </div>
          <div class="text-[10px] text-amber-400 font-mono mt-0.5">
            Potholes Identified: ${road.potholeCount}
          </div>
        </div>
      `;

      innerLine.bindTooltip(roadTooltip, {
        sticky: true,
        className: 'google-maps-traffic-tooltip',
      });

      innerLine.on('click', () => setSelectedRoad(road));
      casing.on('click', () => setSelectedRoad(road));

      // Incident Badge on hazardous road midpoint
      if (road.status === 'danger' || road.status === 'warning') {
        const midCoord = road.coordinates[Math.floor(road.coordinates.length / 2)];
        const incidentIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center animate-bounce">
              <div class="w-6 h-6 rounded-full ${
                road.status === 'danger'
                  ? 'bg-red-600 border-2 border-slate-950 text-white shadow-[0_0_12px_rgba(239,68,68,0.9)]'
                  : 'bg-amber-500 border-2 border-slate-950 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.9)]'
              } flex items-center justify-center font-bold text-[11px]">
                <span class="material-symbols-outlined text-[13px]">${
                  road.status === 'danger' ? 'report' : 'warning'
                }</span>
              </div>
            </div>
          `,
          className: 'custom-incident-badge',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        L.marker(midCoord, { icon: incidentIcon }).addTo(roadTrafficLayerRef.current);
      }
    });
  }, [roadNetwork, showTrafficLayer]);

  // Render Pothole Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    markersLayerRef.current.clearLayers();

    if (!showMarkers) return;

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

      const markerHtml = `
        <div class="relative flex flex-col items-center cursor-pointer group ${
          isSelected ? 'scale-125 z-40' : 'z-20'
        } transition-transform">
          <div class="absolute -bottom-1 w-6 h-2 rounded-full ${
            isCritical
              ? 'bg-red-500/80 shadow-[0_0_14px_rgba(239,68,68,0.9)]'
              : 'bg-amber-500/80 shadow-[0_0_14px_rgba(245,158,11,0.9)]'
          } blur-[3px]"></div>
          <div class="w-8 h-8 rounded-full ${
            isCritical
              ? 'bg-[#111827] border-2 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
              : 'bg-[#111827] border-2 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.6)]'
          } flex items-center justify-center font-bold">
            <span class="material-symbols-outlined text-[15px]">
              ${isCritical ? 'crisis_alert' : 'warning'}
            </span>
          </div>
          <div class="w-1 h-2.5 ${isCritical ? 'bg-red-500' : 'bg-amber-500'} -mt-0.5"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-pothole-marker',
        iconSize: [32, 42],
        iconAnchor: [16, 42],
      });

      const marker = L.marker([hazard.lat, hazard.lng], { icon: customIcon }).addTo(
        markersLayerRef.current
      );

      marker.on('click', () => {
        setSelectedHazard(hazard);
        setIsSheetOpen(true);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([hazard.lat, hazard.lng], 16, { duration: 0.8 });
        }
      });
    });
  }, [activeHazardsList, searchQuery, filterSeverity, selectedHazard, showMarkers]);

  // Update Live GPS Vehicle Navigation Marker
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
      mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 0.5 });
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
      mapInstanceRef.current.flyTo([hazard.lat, hazard.lng], 16, { duration: 1 });
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
      mapInstanceRef.current.flyTo([currentGps.lat, currentGps.lng], 16, { duration: 1 });
      setFollowVehicle(true);
      showToast?.('Centered on live vehicle GPS', 'info');
    } else if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([34.0515, -118.2480], 14, { duration: 1 });
      showToast?.('Centered on Downtown Road Corridors', 'info');
    }
  };

  return (
    <main className="flex-1 relative w-full h-[calc(100vh-64px)] min-h-[500px] flex flex-col overflow-hidden bg-[#0a0e17]">
      {/* Top HUD Controls & Search Bar */}
      <div className="absolute top-4 left-4 right-4 z-[400] pointer-events-none flex flex-col md:flex-row justify-between items-start gap-3">
        {/* Search Input Container */}
        <div className="pointer-events-auto relative w-full max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (activeHazardsList.length > 0) handleSelectHazard(activeHazardsList[0]);
            }}
            className="bg-[#111827]/95 backdrop-blur-md border border-slate-700/80 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-2xl hover:border-amber-500/40 transition-colors"
          >
            <span className="material-symbols-outlined text-slate-400">search</span>
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              placeholder="Search road, street, or hazard ID..."
              className="bg-transparent border-none text-slate-100 placeholder-slate-500 text-sm focus:outline-none w-full"
            />
            {isSearching && (
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
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
              className="absolute top-full left-0 right-0 mt-2 bg-[#111827]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 max-h-80 overflow-y-auto space-y-1"
              onMouseLeave={() => setShowDropdown(false)}
            >
              {activeHazardsList.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                    Pothole Hazards ({activeHazardsList.length})
                  </div>
                  {activeHazardsList.slice(0, 4).map((hazard) => (
                    <button
                      key={hazard.id}
                      onClick={() => handleSelectHazard(hazard)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800/80 flex items-center justify-between transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span
                          className={`material-symbols-outlined text-base ${
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
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
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
                  <div className="px-3 py-1 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                    Global Locations
                  </div>
                  {geoResults.map((place, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectGeoPlace(place)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800/80 flex items-center gap-2 text-slate-300 hover:text-cyan-400 transition-colors"
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

        {/* Right Controls: Traffic Layer, Map Styles, GPS Controls */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {/* Google Maps Traffic Layer Switcher */}
          <button
            onClick={() => {
              setShowTrafficLayer(!showTrafficLayer);
              showToast?.(
                showTrafficLayer ? 'Traffic flow layer hidden' : 'Google Maps traffic layer active',
                'info'
              );
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 backdrop-blur-md shadow-2xl ${
              showTrafficLayer
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/20'
                : 'bg-[#111827]/90 text-slate-400 border-slate-700/80 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">traffic</span>
            <span>Traffic Flow</span>
            {showTrafficLayer && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          </button>

          {/* Map Layer Switcher: Dark, Satellite, Street */}
          <div className="bg-[#111827]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1 flex items-center gap-1 shadow-2xl">
            {Object.keys(TILE_LAYERS).map((styleKey) => (
              <button
                key={styleKey}
                onClick={() => setMapStyle(styleKey)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold capitalize transition-colors ${
                  mapStyle === styleKey
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {styleKey}
              </button>
            ))}
          </div>

          {/* GPS Simulation / Live GPS Tracker Button */}
          <div className="bg-[#111827]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1 flex items-center gap-1 shadow-2xl">
            <button
              onClick={() => {
                if (isSimulating) {
                  onToggleSimulation?.();
                  showToast?.('Drive simulation stopped', 'info');
                } else {
                  onToggleSimulation?.();
                  showToast?.('🚗 Live Drive Route simulation active', 'success');
                }
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                isSimulating
                  ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.6)] animate-pulse'
                  : 'text-slate-300 hover:text-blue-400'
              }`}
              title="Simulate driving car along road route"
            >
              <span className="material-symbols-outlined text-sm">directions_car</span>
              {isSimulating ? 'Driving Simulation' : 'Simulate Drive'}
            </button>

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
              className={`p-1.5 rounded-xl text-xs font-bold transition-all ${
                isGpsTracking && !isSimulating
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Live Device GPS"
            >
              <span className="material-symbols-outlined text-base">gps_fixed</span>
            </button>
          </div>

          {/* Recenter Button */}
          <button
            onClick={handleRecenter}
            className={`w-10 h-10 bg-[#111827]/90 backdrop-blur-md border rounded-2xl flex items-center justify-center shadow-2xl transition-all ${
              followVehicle
                ? 'border-blue-500 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                : 'border-slate-700/80 text-slate-300 hover:text-amber-400'
            }`}
            title="Recenter Map & Follow Vehicle"
          >
            <span className="material-symbols-outlined text-xl">my_location</span>
          </button>
        </div>
      </div>

      {/* Floating Speedometer & Live Telemetry HUD */}
      {currentGps && (
        <div className="absolute top-20 left-4 z-[350] pointer-events-auto bg-[#111827]/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-3 shadow-2xl flex items-center gap-4 max-w-sm animate-in fade-in">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/40 flex flex-col items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <span className="text-base font-extrabold font-heading leading-none">
              {currentGps.speed || 0}
            </span>
            <span className="text-[8px] font-mono uppercase tracking-wider text-slate-400">km/h</span>
          </div>

          <div className="flex flex-col min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                GPS LIVE TELEMETRY
              </span>
            </div>
            <p className="text-xs font-bold text-slate-100 truncate mt-0.5">
              {currentGps.address || 'Surveying Roadway...'}
            </p>
            <p className="text-[10px] font-mono text-cyan-400 mt-0.5">
              {currentGps.lat?.toFixed(5)}°N, {currentGps.lng?.toFixed(5)}°W • Acc: ±{currentGps.accuracy || 5}m
            </p>
          </div>
        </div>
      )}

      {/* Google Maps Road Traffic Legend */}
      <div className="absolute bottom-6 left-4 z-[350] pointer-events-auto bg-[#111827]/90 backdrop-blur-xl border border-slate-800 rounded-2xl px-3.5 py-2 shadow-2xl flex items-center gap-3 hidden sm:flex">
        <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Road Traffic / Hazards:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-mono text-slate-300">Clear</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-amber-500" />
          <span className="text-[10px] font-mono text-slate-300">Moderate Potholes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-mono text-slate-300">Severe Road Defect</span>
        </div>
      </div>

      {/* Map Viewport Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[500px] z-10" />

      {/* Selected Hazard Drawer */}
      {selectedHazard && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-[500] bg-[#111827]/95 backdrop-blur-xl border-t border-slate-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ${
            isSheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-44px)]'
          }`}
        >
          <div
            onClick={() => setIsSheetOpen(!isSheetOpen)}
            className="w-full flex flex-col items-center pt-3 pb-2 cursor-pointer group"
          >
            <div className="w-12 h-1.5 bg-slate-700 group-hover:bg-amber-400 rounded-full transition-colors" />
          </div>

          <div className="px-5 pb-6 pt-1 max-w-3xl mx-auto space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      selectedHazard.severity === 'critical'
                        ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                    }`}
                  >
                    {selectedHazard.severity} Severity
                  </span>
                  <span className="text-xs font-mono text-slate-400">ID: {selectedHazard.id}</span>
                </div>
                <h2 className="font-heading text-xl font-bold text-slate-100">
                  {selectedHazard.title || `Pothole at ${selectedHazard.coordsText || 'Survey Route'}`}
                </h2>
              </div>
              <button
                onClick={() => setIsSheetOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="col-span-1 rounded-xl border border-slate-800 overflow-hidden relative aspect-video sm:aspect-square bg-slate-900 group">
                <img
                  src={
                    selectedHazard.image?.startsWith('data:')
                      ? selectedHazard.image
                      : selectedHazard.image ||
                        'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=600&auto=format&fit=crop'
                  }
                  alt={selectedHazard.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-md rounded px-2 py-0.5 text-[10px] font-mono text-cyan-400 flex items-center gap-1 border border-cyan-500/30">
                  <span className="material-symbols-outlined text-[12px]">center_focus_strong</span>
                  AI CONF {selectedHazard.confidence || '94%'}
                </div>
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-2">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    GPS Coordinates
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-400 truncate">
                    {selectedHazard.coordsText || `${selectedHazard.lat?.toFixed(5)}°N, ${selectedHazard.lng?.toFixed(5)}°W`}
                  </span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    Detected Timestamp
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-200 truncate">
                    {selectedHazard.detectedTime || selectedHazard.timestamp || 'Just now'}
                  </span>
                </div>

                <div className="col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-base">traffic</span>
                    <span className="text-xs text-slate-300 font-medium">
                      Road Impact: High Traffic Slowdown & Hazard
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                    Red Alert
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedHazard.lat},${selectedHazard.lng}`;
                  window.open(url, '_blank');
                  showToast?.(`Opening Google Maps navigation to ${selectedHazard.title}...`, 'info');
                }}
                className="flex-1 bg-slate-900 border border-slate-700/80 hover:border-amber-500/40 rounded-xl py-3 flex items-center justify-center gap-2 text-slate-200 font-semibold text-sm hover:bg-slate-800 transition-all"
              >
                <span className="material-symbols-outlined text-lg">directions</span>
                Google Maps Route
              </button>

              <button
                onClick={() => {
                  showToast?.(`Hazard report dispatched for ${selectedHazard.id}!`, 'success');
                }}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm py-3 rounded-xl shadow-[0_4px_20px_rgba(245,158,11,0.35)] transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">assignment</span>
                Dispatch Repair Unit
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';

// Get initial cached GPS or real fallback
const getInitialCoords = () => {
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('pothole_last_known_gps');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
  }
  return {
    lat: 18.5204,
    lng: 73.8567,
    accuracy: 10,
    speed: 0,
    heading: 0,
    address: 'Current Road Location',
  };
};

export const DEFAULT_COORDS = getInitialCoords();

// Simulation Route Coordinates
export const SIMULATED_DRIVE_ROUTE = [
  { lat: 18.5204, lng: 73.8567, speed: 38, heading: 45, address: 'Main Highway Sector 1' },
  { lat: 18.5215, lng: 73.8580, speed: 42, heading: 60, address: 'Central Boulevard Link' },
  { lat: 18.5230, lng: 73.8595, speed: 35, heading: 90, address: 'East Expressway Overpass' },
  { lat: 18.5245, lng: 73.8610, speed: 28, heading: 110, address: 'North Ring Road Junction' },
  { lat: 18.5260, lng: 73.8625, speed: 48, heading: 85, address: 'Industrial Corridor Sector 4' },
];

/**
 * Calculate distance between two lat/lng points in meters (Haversine Formula)
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

/**
 * Voice Announcement helper using Web Speech Synthesis API
 */
export function speakAlert(text) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis not available:', e);
    }
  }
}

/**
 * Custom Hook for Live GPS Tracking & Drive Simulation (Fast Auto-Lock on Reload)
 */
export function useGeolocation() {
  const [coords, setCoords] = useState(getInitialCoords);
  const [isTracking, setIsTracking] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [error, setError] = useState(null);

  const watchIdRef = useRef(null);
  const simIndexRef = useRef(0);
  const simIntervalRef = useRef(null);

  // Reverse geocode lat/lng to street name
  const fetchAddress = useCallback(async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' }, signal: AbortSignal.timeout(3500) }
      );
      if (res.ok) {
        const data = await res.json();
        const road = data.address?.road || data.address?.pedestrian || data.address?.suburb || data.display_name?.split(',')[0];
        const city = data.address?.city || data.address?.town || data.address?.county || '';
        if (road) {
          return `${road}${city ? `, ${city}` : ''}`;
        }
      }
    } catch {
      // Non-blocking fallback
    }
    return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°W`;
  }, []);

  // Handle GPS location success
  const handleSuccess = useCallback(async (position) => {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    setGpsLocked(true);
    setError(null);

    const speedKmH = speed !== null && speed !== undefined ? Math.round(speed * 3.6) : 0;
    const computedHeading = heading !== null && heading !== undefined ? Math.round(heading) : 0;

    const newCoords = {
      lat: latitude,
      lng: longitude,
      accuracy: Math.round(accuracy || 5),
      speed: speedKmH,
      heading: computedHeading,
      address: `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°W`,
    };

    setCoords((prev) => ({
      ...prev,
      ...newCoords,
      address: prev.address && !prev.address.includes('°') ? prev.address : newCoords.address,
    }));

    try {
      localStorage.setItem('pothole_last_known_gps', JSON.stringify(newCoords));
    } catch {
      // Storage error ignore
    }

    // Update address in background
    fetchAddress(latitude, longitude).then((addr) => {
      setCoords((prev) => {
        const updated = { ...prev, address: addr };
        try {
          localStorage.setItem('pothole_last_known_gps', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    });
  }, [fetchAddress]);

  // Handle GPS error
  const handleError = useCallback((err) => {
    console.warn('Geolocation error:', err?.message);
    setError(err?.message || 'GPS Signal Unavailable');
  }, []);

  // Automatic Fast Initial GPS Lock on Mount / Page Reload
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleSuccess(pos);
        },
        async () => {
          // If browser GPS is denied or slow, fetch quick IP location fallback
          try {
            const ipRes = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3000) });
            if (ipRes.ok) {
              const ipData = await ipRes.json();
              if (ipData.success && ipData.latitude && ipData.longitude) {
                const ipCoords = {
                  lat: ipData.latitude,
                  lng: ipData.longitude,
                  accuracy: 500,
                  speed: 0,
                  heading: 0,
                  address: `${ipData.city || 'City'}, ${ipData.region || ipData.country || ''}`,
                };
                setCoords(ipCoords);
                setGpsLocked(true);
                try {
                  localStorage.setItem('pothole_last_known_gps', JSON.stringify(ipCoords));
                } catch {}
              }
            }
          } catch {
            // Fallback
          }
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    }
  }, [handleSuccess]);

  // Start Real Hardware GPS Tracking
  const startTracking = useCallback(() => {
    if (isSimulating) {
      clearInterval(simIntervalRef.current);
      setIsSimulating(false);
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);
    setError(null);

    // Initial query
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    // Continuous watch
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  }, [handleSuccess, handleError, isSimulating]);

  // Stop GPS Tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsTracking(false);
    setIsSimulating(false);
  }, []);

  // Start Live Route Drive Simulation
  const toggleSimulation = useCallback(() => {
    if (isSimulating) {
      clearInterval(simIntervalRef.current);
      setIsSimulating(false);
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsTracking(true);
    setIsSimulating(true);
    setGpsLocked(true);
    setError(null);

    simIndexRef.current = 0;
    const firstPoint = SIMULATED_DRIVE_ROUTE[0];
    setCoords({
      lat: firstPoint.lat,
      lng: firstPoint.lng,
      accuracy: 3,
      speed: firstPoint.speed,
      heading: firstPoint.heading,
      address: firstPoint.address,
    });

    simIntervalRef.current = setInterval(() => {
      simIndexRef.current = (simIndexRef.current + 1) % SIMULATED_DRIVE_ROUTE.length;
      const point = SIMULATED_DRIVE_ROUTE[simIndexRef.current];
      const jitterLat = (Math.random() - 0.5) * 0.0001;
      const jitterLng = (Math.random() - 0.5) * 0.0001;
      const currentSpeed = Math.max(15, Math.min(65, point.speed + Math.floor(Math.random() * 9 - 4)));

      setCoords({
        lat: Number((point.lat + jitterLat).toFixed(6)),
        lng: Number((point.lng + jitterLng).toFixed(6)),
        accuracy: 3,
        speed: currentSpeed,
        heading: point.heading,
        address: point.address,
      });
    }, 2800);
  }, [isSimulating]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, []);

  return {
    coords,
    setCoords,
    isTracking,
    isSimulating,
    gpsLocked,
    error,
    startTracking,
    stopTracking,
    toggleSimulation,
  };
}

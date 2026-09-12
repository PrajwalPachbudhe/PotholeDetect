import { useState, useEffect, useRef, useCallback } from 'react';

// Default initial coordinates (Downtown road corridor)
export const DEFAULT_COORDS = {
  lat: 34.0522,
  lng: -118.2437,
  accuracy: 5,
  speed: 0,
  heading: 90,
  address: 'Grand Ave & 5th St, Los Angeles, CA',
};

// Simulation Route Coordinates (simulating a car driving along urban roads)
export const SIMULATED_DRIVE_ROUTE = [
  { lat: 34.0522, lng: -118.2437, speed: 38, heading: 45, address: '1400 Main St Bridge' },
  { lat: 34.0531, lng: -118.2465, speed: 42, heading: 60, address: 'Main St & 4th Ave' },
  { lat: 34.0545, lng: -118.2520, speed: 35, heading: 90, address: 'Grand Ave & 5th St' },
  { lat: 34.0558, lng: -118.2545, speed: 28, heading: 110, address: 'Broadway Blvd #42' },
  { lat: 34.0570, lng: -118.2400, speed: 48, heading: 85, address: 'Sunset Highway Mile 12' },
  { lat: 34.0498, lng: -118.2580, speed: 32, heading: 180, address: 'Wilshire & Hope Intersection' },
  { lat: 34.0485, lng: -118.2495, speed: 25, heading: 220, address: 'Olympic Blvd Overpass' },
  { lat: 34.0420, lng: -118.2550, speed: 40, heading: 270, address: 'South Figueroa St & 9th' },
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
      window.speechSynthesis.cancel(); // Stop any pending speech
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
 * Custom Hook for Live GPS Tracking & Drive Simulation
 */
export function useGeolocation() {
  const [coords, setCoords] = useState(DEFAULT_COORDS);
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
        { headers: { 'Accept-Language': 'en' } }
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
      // Fallback
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

    setCoords((prev) => ({
      ...prev,
      lat: latitude,
      lng: longitude,
      accuracy: Math.round(accuracy || 5),
      speed: speedKmH,
      heading: computedHeading,
    }));

    // Update address in background
    fetchAddress(latitude, longitude).then((addr) => {
      setCoords((prev) => ({ ...prev, address: addr }));
    });
  }, [fetchAddress]);

  // Handle GPS error
  const handleError = useCallback((err) => {
    console.warn('Geolocation error:', err.message);
    setError(err.message || 'GPS Signal Unavailable');
    setGpsLocked(false);
  }, []);

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
      maximumAge: 1000,
    });

    // Continuous watch
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 1000,
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

  // Start Live Route Drive Simulation (Ideal for desktop testing or demoing road traffic)
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
      // Add slight jitter for realism
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

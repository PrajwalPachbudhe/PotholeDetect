// Haversine Distance in meters between two lat/lng coordinates
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371000; // Radius of the Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Group detection records that are in the same area (within radiusMeters, e.g. 45m, or same street address)
 * @param {Array} historyItems - Array of detection records
 * @param {number} radiusMeters - Distance threshold for clustering (default: 45m)
 * @returns {Array} Clustered records with aggregated counts and photo galleries
 */
export function groupHistoryByLocation(historyItems = [], radiusMeters = 45) {
  if (!historyItems || historyItems.length === 0) return [];

  const clusters = [];

  historyItems.forEach((item) => {
    const lat = item.gps?.lat ?? item.lat;
    const lng = item.gps?.lng ?? item.lng;
    const address = item.gps?.address || item.title || 'Road Section';
    const detections = item.detections || [];
    const detectionCount = item.total_detections || detections.length || 1;
    const photoImg = item.annotated || item.original || item.image;

    // Check if item belongs to an existing cluster
    let matchedCluster = null;

    for (const cluster of clusters) {
      // 1. Distance check if GPS available
      if (lat != null && lng != null && cluster.lat != null && cluster.lng != null) {
        const dist = getDistanceMeters(lat, lng, cluster.lat, cluster.lng);
        if (dist <= radiusMeters) {
          matchedCluster = cluster;
          break;
        }
      }

      // 2. Fallback: Street name match
      if (
        address &&
        cluster.address &&
        address !== 'Road Section' &&
        address.toLowerCase().trim() === cluster.address.toLowerCase().trim()
      ) {
        matchedCluster = cluster;
        break;
      }
    }

    const photoObj = {
      id: item.id || `photo-${Math.random().toString(36).substr(2, 9)}`,
      image: photoImg,
      timestamp: item.timestamp || item.detectedTime || 'Recent',
      total_detections: detectionCount,
      detections: detections,
      analysisTime: item.analysisTime || '0.12',
      confidence: item.confidence || (detections[0]?.confidence ? `${detections[0].confidence}%` : '92%'),
      gps: item.gps || { lat, lng, address },
    };

    if (matchedCluster) {
      // Add photo if distinct
      const isDuplicatePhoto = matchedCluster.photos.some(
        (p) => p.image === photoImg && p.timestamp === photoObj.timestamp
      );
      if (!isDuplicatePhoto) {
        matchedCluster.photos.unshift(photoObj);
      }
      matchedCluster.total_detections += detectionCount;
      matchedCluster.pothole_count += detectionCount;
      matchedCluster.detections = [...(matchedCluster.detections || []), ...detections];
      matchedCluster.lastSeen = item.timestamp || matchedCluster.lastSeen;
      
      // Update severity based on aggregated count
      matchedCluster.severity =
        matchedCluster.total_detections >= 3
          ? 'critical'
          : matchedCluster.total_detections >= 1
          ? 'moderate'
          : 'safe';
    } else {
      // Create new cluster
      clusters.push({
        id: item.id || `cluster-${clusters.length + 1}`,
        lat: lat != null ? Number(lat) : null,
        lng: lng != null ? Number(lng) : null,
        address: address,
        pothole_count: detectionCount,
        total_detections: detectionCount,
        detections: [...detections],
        photos: [photoObj],
        severity: detectionCount >= 3 ? 'critical' : detectionCount >= 1 ? 'moderate' : 'safe',
        firstSeen: item.timestamp || item.detectedTime || item.createdAt || 'Recent',
        lastSeen: item.timestamp || item.detectedTime || item.createdAt || 'Recent',
        timestamp: item.timestamp || item.detectedTime || item.createdAt || 'Recent',
        analysisTime: item.analysisTime || '0.12',
        gps: item.gps || { lat, lng, address },
      });
    }
  });

  return clusters;
}

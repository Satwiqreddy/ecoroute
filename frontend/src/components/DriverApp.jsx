import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Truck, CheckCircle, Camera, Navigation, 
  MapPin, X, Compass, Sparkles, LogOut, RefreshCw, Globe
} from 'lucide-react';
import { translations, getRTLStyles } from '../translations';

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function DriverApp({ onNavigateHome, lang, onChangeLang, selectedRegion, onChangeRegion, regions, truckAssignments }) {
  const regionConfig = regions.find(r => r.name === selectedRegion) || regions[0];
  const [bins, setBins] = useState([]);
  const [depot, setDepot] = useState({ latitude: regionConfig.center[0], longitude: regionConfig.center[1], name: `Depot (${regionConfig.displayName.split(' (')[0]})` });
  const [routeIndex, setRouteIndex] = useState(-1); // Index in activeRoute sequence
  const [selectedTruck, setSelectedTruck] = useState("Truck_1");
  const [rawRouteSequence, setRawRouteSequence] = useState(null);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [gpsMode, setGpsMode] = useState('simulated'); // 'real' or 'simulated'
  const [currentLocation, setCurrentLocation] = useState({ latitude: regionConfig.center[0], longitude: regionConfig.center[1] });
  const [speed, setSpeed] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [transitPercent, setTransitPercent] = useState(0);
  const [etaMinutes, setEtaMinutes] = useState(0);
  const [distanceRemaining, setDistanceRemaining] = useState(0);
  
  const simTimerRef = useRef(null);
  const telemetryTimerRef = useRef(null);
  const canvasRef = useRef(null);

  const mapInstanceRef = useRef(null);
  const routeLineRef = useRef(null);
  const truckMarkerRef = useRef(null);
  const binMarkersRef = useRef({});
  const depotMarkerRef = useRef(null);

  // Compute activeRoute dynamically based on rawRouteSequence and selectedTruck
  const activeRoute = rawRouteSequence ? (
    typeof rawRouteSequence === 'object' && !Array.isArray(rawRouteSequence)
      ? (rawRouteSequence[selectedTruck] || [])
      : rawRouteSequence
  ) : [];

  // Load initial bins and route
  useEffect(() => {
    fetchRouteData();
  }, [selectedRegion, selectedTruck]);

  async function fetchRouteData() {
    try {
      const binsRes = await fetch(`http://localhost:3001/api/bins?region=${encodeURIComponent(selectedRegion)}`);
      const binsData = await binsRes.json();

      const depotRes = await fetch(`http://localhost:3001/api/depot?region=${encodeURIComponent(selectedRegion)}`);
      const depotData = await depotRes.json();
      if (depotData && depotData.latitude) {
        setDepot(depotData);
        // Set starting location to depot if shift hasn't started
        if (!isShiftActive) {
          setCurrentLocation({ latitude: depotData.latitude, longitude: depotData.longitude });
        }
      }

      const routeRes = await fetch(`http://localhost:3001/api/route?region=${encodeURIComponent(selectedRegion)}`);
      const routeData = await routeRes.json();
      
      let currentActiveRoute = [];
      if (routeData && routeData.route_sequence) {
        setRawRouteSequence(routeData.route_sequence);
        const seq = routeData.route_sequence;
        if (!Array.isArray(seq) && typeof seq === 'object') {
          currentActiveRoute = seq[selectedTruck] || [];
        } else {
          currentActiveRoute = seq || [];
        }
      } else {
        setRawRouteSequence(null);
      }

      // Filter bins to only show the assigned ones
      if (currentActiveRoute.length > 0) {
        setBins(binsData.filter(b => currentActiveRoute.includes(b.id)));
      } else {
        setBins([]);
      }
    } catch (err) {
      console.error('Error fetching route:', err);
    }
  }

  // Get current active target bin in route
  const currentBinId = activeRoute[routeIndex] || null;
  const currentBin = bins.find(b => b.id === currentBinId) || null;

  // Real GPS Geolocation Watcher
  useEffect(() => {
    let watchId = null;
    if (isShiftActive && gpsMode === 'real') {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const loc = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };
            setCurrentLocation(loc);
            setSpeed(position.coords.speed ? position.coords.speed * 3.6 : 25.0); // Convert m/s to km/h, fallback to 25
          },
          (error) => {
            console.error('GPS error:', error);
            alert('Could not retrieve GPS location. Switching to Simulation Mode.');
            setTimeout(() => {
              setGpsMode('simulated');
            }, 0);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      } else {
        alert('Geolocation not supported. Using simulation.');
        setTimeout(() => {
          setGpsMode('simulated');
        }, 0);
      }
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isShiftActive, gpsMode]);

  // GPS Telemetry Transmitter (every 5 seconds)
  useEffect(() => {
    if (isShiftActive) {
      telemetryTimerRef.current = setInterval(() => {
        transmitTelemetry();
      }, 5000);
    } else {
      if (telemetryTimerRef.current) clearInterval(telemetryTimerRef.current);
    }

    return () => {
      if (telemetryTimerRef.current) clearInterval(telemetryTimerRef.current);
    };
  }, [isShiftActive, currentLocation, speed]);

  async function transmitTelemetry() {
    try {
      const nextBinName = currentBin ? currentBin.name : (routeIndex >= activeRoute.length ? 'Depot' : 'None');
      await fetch('http://localhost:3001/api/driver/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          speed: speed,
          truck_id: selectedTruck,
          region: selectedRegion,
          eta_minutes: etaMinutes,
          distance_remaining_km: distanceRemaining,
          next_bin_name: nextBinName
        })
      });
    } catch (err) {
      console.error('Error sending telemetry:', err);
    }
  }

  // Simulated GPS Movement Loop
  useEffect(() => {
    if (isShiftActive && gpsMode === 'simulated') {
      let startLoc = { latitude: depot.latitude, longitude: depot.longitude };
      
      // Determine start location of current leg
      if (routeIndex > 0) {
        const prevBinId = activeRoute[routeIndex - 1];
        const prevBin = bins.find(b => b.id === prevBinId);
        if (prevBin) {
          startLoc = { latitude: prevBin.latitude, longitude: prevBin.longitude };
        }
      }

      // Determine end location of current leg
      let endLoc = { latitude: depot.latitude, longitude: depot.longitude };
      if (currentBin) {
        endLoc = { latitude: currentBin.latitude, longitude: currentBin.longitude };
      } else if (routeIndex >= activeRoute.length && activeRoute.length > 0) {
        // Last leg back to Depot
        const lastBinId = activeRoute[activeRoute.length - 1];
        const lastBin = bins.find(b => b.id === lastBinId);
        if (lastBin) startLoc = { latitude: lastBin.latitude, longitude: lastBin.longitude };
        endLoc = { latitude: depot.latitude, longitude: depot.longitude };
      }

      setTimeout(() => {
        setTransitPercent(0);
        setSpeed(35.0); // 35 km/h driving
        const initialDist = haversineDistance(startLoc.latitude, startLoc.longitude, endLoc.latitude, endLoc.longitude) || 1.5;
        setDistanceRemaining(initialDist);
        setEtaMinutes(15);
      }, 0);

      let currentStep = 0;
      const totalSteps = 15; // 15 seconds to travel between points
      let routePoints = [];

      // Fetch precise road points from OSRM
      fetch(`https://router.project-osrm.org/route/v1/driving/${startLoc.longitude},${startLoc.latitude};${endLoc.longitude},${endLoc.latitude}?overview=full&geometries=geojson`)
        .then(res => res.json())
        .then(data => {
          if (data && data.routes && data.routes[0]) {
            routePoints = data.routes[0].geometry.coordinates.map(pt => ({ latitude: pt[1], longitude: pt[0] }));
          }
        })
        .catch(err => {
          console.warn("OSRM simulator routing failed, using fallback:", err);
        });

      simTimerRef.current = setInterval(() => {
        currentStep += 1;
        const pct = currentStep / totalSteps;
        setTransitPercent(Math.min(100, Math.round(pct * 100)));

        const totalDist = haversineDistance(startLoc.latitude, startLoc.longitude, endLoc.latitude, endLoc.longitude) || 1.5;
        const remDist = Math.max(0, totalDist * (1 - pct));
        const remMinutes = Math.max(0, Math.round(15 - currentStep));
        setDistanceRemaining(remDist);
        setEtaMinutes(remMinutes);

        if (routePoints.length > 0) {
          const ptIdx = Math.min(routePoints.length - 1, Math.floor(pct * (routePoints.length - 1)));
          setCurrentLocation(routePoints[ptIdx]);
        } else {
          // Linear interpolation of coordinates fallback
          const nextLat = startLoc.latitude + (endLoc.latitude - startLoc.latitude) * pct;
          const nextLng = startLoc.longitude + (endLoc.longitude - startLoc.longitude) * pct;
          setCurrentLocation({ latitude: nextLat, longitude: nextLng });
        }

        if (currentStep >= totalSteps) {
          clearInterval(simTimerRef.current);
          setSpeed(0);
          setDistanceRemaining(0);
          setEtaMinutes(0);
          if (routeIndex >= activeRoute.length) {
            // Arrived back at Depot
            handleEndShift();
          }
        }
      }, 1000);
    } else {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    }

    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, [isShiftActive, gpsMode, routeIndex, activeRoute]);

  // Initialize Leaflet Map for Driver App
  useEffect(() => {
    if (!isShiftActive) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      const container = document.getElementById('driver-map');
      if (!container || mapInstanceRef.current) return;

      console.log("Initializing Driver Leaflet Map...");
      const map = L.map('driver-map', {
        center: [currentLocation.latitude, currentLocation.longitude],
        zoom: 15,
        zoomControl: false
      });
      mapInstanceRef.current = map;

      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: 'Map data &copy; Google contributors'
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Draw depot marker
      const depotHtmlIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #374151; width: 20px; height: 20px; border-radius: 4px; border: 2.5px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      depotMarkerRef.current = L.marker([depot.latitude, depot.longitude], { icon: depotHtmlIcon })
        .addTo(map)
        .bindPopup('<b>Depot</b>');
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isShiftActive]);

  // Sync Bins & Polyline on Driver Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear previous bin markers
    Object.values(binMarkersRef.current).forEach(m => map.removeLayer(m));
    binMarkersRef.current = {};

    // Draw all bins
    activeRoute.forEach((binId, idx) => {
      const bin = bins.find(b => b.id === binId);
      if (!bin) return;

      const isCurrentTarget = binId === currentBinId;
      const isCollected = bin.status === 'Collected';
      
      const fillColor = isCollected ? '#10b981' : isCurrentTarget ? '#ef4444' : '#f59e0b';
      const shadowColor = isCollected ? 'rgba(16,185,129,0.6)' : isCurrentTarget ? 'rgba(239,68,68,0.6)' : 'rgba(245,158,11,0.6)';

      const binIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${fillColor}; width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid #fff; box-shadow: 0 0 6px ${shadowColor}; display: flex; align-items: center; justify-content: center;"><span style="color: #fff; font-size: 8px; font-weight: bold;">${idx + 1}</span></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const marker = L.marker([bin.latitude, bin.longitude], { icon: binIcon })
        .addTo(map)
        .bindPopup(`<b>${bin.name}</b><br/>Status: ${bin.status}`);
      
      binMarkersRef.current[binId] = marker;
    });

    // Draw active route polyline
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    if (activeRoute.length > 0) {
      const routeLatLngs = [[depot.latitude, depot.longitude]];
      activeRoute.forEach(binId => {
        const bin = bins.find(b => b.id === binId);
        if (bin) routeLatLngs.push([bin.latitude, bin.longitude]);
      });
      routeLatLngs.push([depot.latitude, depot.longitude]);

      const colors = {
        "Truck_1": { outline: "#1557b0", main: "#1a73e8" },
        "Truck_2": { outline: "#065f46", main: "#10b981" },
        "Truck_3": { outline: "#5b21b6", main: "#8b5cf6" },
        "default": { outline: "#b45309", main: "#f59e0b" }
      };
      const truckColors = colors[selectedTruck] || colors["default"];

      const group = L.featureGroup().addTo(map);
      routeLineRef.current = group;

      // Fallback straight lines
      const polyOutline = L.polyline(routeLatLngs, { color: truckColors.outline, weight: 6, opacity: 0.8 }).addTo(group);
      const polyMain = L.polyline(routeLatLngs, { color: truckColors.main, weight: 4, opacity: 0.95 }).addTo(group);
      const fallbackLines = [polyOutline, polyMain];

      // Snap to roads via OSRM
      const coordsQuery = routeLatLngs.map(pt => `${pt[1]},${pt[0]}`).join(';');
      fetch(`https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson`)
        .then(res => res.json())
        .then(data => {
          if (data && data.routes && data.routes[0]) {
            const roadPoints = data.routes[0].geometry.coordinates.map(pt => [pt[1], pt[0]]);
            fallbackLines.forEach(l => group.removeLayer(l));
            
            L.polyline(roadPoints, { color: truckColors.outline, weight: 6, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }).addTo(group);
            L.polyline(roadPoints, { color: truckColors.main, weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(group);
          }
        })
        .catch(err => console.warn("OSRM routing failed:", err));
    }
  }, [isShiftActive, bins, activeRoute, selectedTruck, depot, currentBinId]);

  // Sync Truck Marker on Driver Map
  useEffect(() => {
    if (!mapInstanceRef.current || !currentLocation || !currentLocation.latitude) return;
    const map = mapInstanceRef.current;

    const colors = {
      "Truck_1": { fill: "#1a73e8", shadow: "0 0 10px rgba(26,115,232,0.8)" },
      "Truck_2": { fill: "#10b981", shadow: "0 0 10px rgba(16,185,129,0.8)" },
      "Truck_3": { fill: "#8b5cf6", shadow: "0 0 10px rgba(139,92,246,0.8)" },
      "default": { fill: "#f59e0b", shadow: "0 0 10px rgba(245,158,11,0.8)" }
    };
    const truckColor = colors[selectedTruck] || colors["default"];

    const truckHtmlIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${truckColor.fill}; width: 24px; height: 24px; border-radius: 50%; border: 2.5px solid #fff; box-shadow: ${truckColor.shadow}; display: flex; align-items: center; justify-content: center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    if (truckMarkerRef.current) {
      truckMarkerRef.current.setLatLng([currentLocation.latitude, currentLocation.longitude]);
    } else {
      truckMarkerRef.current = L.marker([currentLocation.latitude, currentLocation.longitude], { icon: truckHtmlIcon })
        .addTo(map)
        .bindPopup(`<b>${selectedTruck}</b>`);
    }

    map.panTo([currentLocation.latitude, currentLocation.longitude]);
  }, [currentLocation, selectedTruck]);

  // Camera simulator Canvas rendering
  useEffect(() => {
    if (isCameraOpen && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      // Draw simulated camera viewfinder
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 300, 300);

      // Draw background sky
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 300, 150);

      // Draw road/driveway
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(100, 150);
      ctx.lineTo(200, 150);
      ctx.lineTo(260, 300);
      ctx.lineTo(40, 300);
      ctx.closePath();
      ctx.fill();

      // Draw a clean, green waste bin
      ctx.fillStyle = '#059669'; // Green bin
      ctx.fillRect(115, 160, 70, 100);
      ctx.fillStyle = '#047857'; // Dark green lid
      ctx.fillRect(110, 150, 80, 15);
      
      // Draw bin wheels and details
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(125, 260, 10, 0, Math.PI * 2);
      ctx.arc(175, 260, 10, 0, Math.PI * 2);
      ctx.fill();

      // Recycling symbol mock
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(150, 190);
      ctx.lineTo(160, 210);
      ctx.lineTo(140, 210);
      ctx.closePath();
      ctx.stroke();

      // Text Overlay
      ctx.fillStyle = 'rgba(57, 255, 20, 0.7)';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('BIN FLOW CAM v1.0', 10, 25);
      ctx.fillText('GPS CONFIRMED', 10, 45);
    }
  }, [isCameraOpen]);

  // Action: Start Shift
  const handleStartShift = () => {
    if (activeRoute.length === 0) {
      alert('No active route. Please optimize route in the Admin Dashboard first.');
      return;
    }
    setIsShiftActive(true);
    setRouteIndex(0);
    setShiftSummary(null);
  };

  // Action: Open Camera Viewfinder
  const handleOpenPhotoCollection = () => {
    setIsCameraOpen(true);
  };

  // Action: Capture and upload photo (simulated)
  const handleCapturePhoto = async () => {
    setUploading(true);
    
    // Simulate delay
    setTimeout(async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/bins/${currentBinId}/collect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photo_url: 'https://images.unsplash.com/photo-1595275311145-c1d06371d374?auto=format&fit=crop&q=80&w=300',
            region: selectedRegion
          })
        });
        const data = await res.json();
        
        if (data.success) {
          // Update local bins
          setBins(prev => prev.map(b => b.id === currentBinId ? data.bin : b));
          setIsCameraOpen(false);
          setRouteIndex(prev => prev + 1);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setUploading(false);
      }
    }, 1500);
  };

  // Action: End Shift
  function handleEndShift() {
    setIsShiftActive(false);
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    if (telemetryTimerRef.current) clearInterval(telemetryTimerRef.current);
    
    // Calculate final metrics
    setShiftSummary({
      binsCleaned: bins.filter(b => b.status === 'Collected').length,
      shiftDurationMinutes: 18, // Simulated time
      avgSpeed: 32.4
    });
    setRouteIndex(-1);
    setCurrentLocation({ latitude: depot.latitude, longitude: depot.longitude });
    setSpeed(0);
  }

  const currentLegName = () => {
    if (!isShiftActive) return translations[lang].idle;
    if (routeIndex >= activeRoute.length) return translations[lang].headingBack;
    return `${translations[lang].headingTo} Bin ${routeIndex + 1}`;
  };

  const t = translations[lang];
  const rtlStyles = getRTLStyles(lang);

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#f8fafc', ...rtlStyles }}>
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Full Screen Mobile Content */}
        <div style={{ flex: 1, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', padding: '16px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
              <Truck size={20} color="var(--accent-purple)" />
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{t.driverTitle}</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
              {/* Region selection inside driver app header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                backgroundColor: '#fff',
                border: '1px solid var(--border-glass)',
                borderRadius: '6px'
              }}>
                <MapPin size={12} color="var(--accent-purple)" />
                <select 
                  value={selectedRegion} 
                  onChange={(e) => onChangeRegion(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: 'var(--accent-purple)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    maxWidth: '120px'
                  }}
                >
                  {regions.map(r => (
                    <option key={r.name} value={r.name}>
                      {r.name === 'Kukatpally' ? 'KPHB' : r.displayName.split(' (')[0].replace('Hyderabad - ', '')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Language selection inside driver app header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                backgroundColor: '#fff',
                border: '1px solid var(--border-glass)',
                borderRadius: '6px'
              }}>
                <Globe size={12} color="var(--text-secondary)" />
                <select 
                  value={lang} 
                  onChange={(e) => onChangeLang(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <option value="en">EN</option>
                  <option value="te">తె</option>
                  <option value="hi">हि</option>
                  <option value="ur">اردو</option>
                </select>
              </div>

              <button onClick={onNavigateHome} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
                <LogOut size={16} style={{ transform: lang === 'ur' ? 'rotate(180deg)' : 'none' }} />
              </button>
            </div>
          </div>

          {/* Core App View */}
          {!isShiftActive && !shiftSummary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, justifyContent: 'center', textAlign: 'center' }}>
              <div style={{
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px auto',
                color: 'var(--accent-purple)'
              }}>
                <Compass size={36} className="pulse-dot" style={{ animationDuration: '3s' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>{t.preShiftChecklist}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
                  {t.gpsMessage}
                </p>
              </div>

              {/* Vehicle Dropdown */}
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#fff', textAlign: lang === 'ur' ? 'right' : 'left' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  {t.chooseVehicle}
                </div>
                <select
                  value={selectedTruck}
                  onChange={(e) => setSelectedTruck(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    backgroundColor: '#fff',
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  {Array.from({ length: (truckAssignments && truckAssignments[selectedRegion]) || 5 }).map((_, i) => {
                    const id = `Truck_${i + 1}`;
                    const label = lang === 'te' ? `ట్రక్ ${i + 1}` : lang === 'hi' ? `ट्रक ${i + 1}` : lang === 'ur' ? `ٹرک ${i + 1}` : `Truck ${i + 1}`;
                    return <option key={id} value={id}>{label}</option>;
                  })}
                </select>
              </div>

              {/* Assigned Route Summary */}
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#fff', textAlign: lang === 'ur' ? 'right' : 'left' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  {t.assignedRoute}
                </div>
                {activeRoute.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ color: 'var(--accent-green)', fontWeight: '700', textAlign: lang === 'ur' ? 'right' : 'left' }}>
                      ✓ {activeRoute.length} {t.binsAssigned}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: lang === 'ur' ? '0' : '8px', paddingRight: lang === 'ur' ? '8px' : '0', borderLeft: lang === 'ur' ? 'none' : '2px solid #e2e8f0', borderRight: lang === 'ur' ? '2px solid #e2e8f0' : 'none', color: 'var(--text-secondary)' }}>
                      {activeRoute.map((binId, idx) => {
                        const bin = bins.find(b => b.id === binId);
                        return (
                          <div key={binId} style={{ display: 'flex', gap: '6px', justifyContent: lang === 'ur' ? 'flex-end' : 'flex-start' }}>
                            {lang !== 'ur' && <span style={{ fontWeight: 'bold', color: 'var(--accent-purple)' }}>{idx + 1}.</span>}
                            <span>{bin ? bin.name : `Bin #${binId}`}</span>
                            {lang === 'ur' && <span style={{ fontWeight: 'bold', color: 'var(--accent-purple)' }}>.{idx + 1}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--accent-red)', fontSize: '12px', fontWeight: '500', textAlign: lang === 'ur' ? 'right' : 'left' }}>
                    {t.noRouteAssigned}
                  </div>
                )}
              </div>

              {/* Mode Toggle */}
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#fff' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t.gpsTrackingMode}</div>
                <div style={{ display: 'flex', gap: '10px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                  <button 
                    onClick={() => setGpsMode('simulated')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: gpsMode === 'simulated' ? 'var(--accent-purple)' : 'rgba(15, 23, 42, 0.03)',
                      color: gpsMode === 'simulated' ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border-glass)'
                    }}
                  >
                    {t.simulatedRoute}
                  </button>
                  <button 
                    onClick={() => setGpsMode('real')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: gpsMode === 'real' ? 'var(--accent-purple)' : 'rgba(15, 23, 42, 0.03)',
                      color: gpsMode === 'real' ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border-glass)'
                    }}
                  >
                    {t.html5gps}
                  </button>
                </div>
              </div>

              <button className="btn-primary" onClick={handleStartShift} style={{
                background: 'linear-gradient(135deg, var(--accent-purple), #9d00ff)',
                boxShadow: '0 4px 14px rgba(168, 85, 247, 0.4)'
              }}>
                {t.startShift}
              </button>
            </div>
          )}

          {/* Active Navigation / Driving View */}
          {isShiftActive && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              {/* Telemetry Status Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-green)', display: 'inline-block' }} className="pulse-dot"></span>
                  <span>Telemetry: {gpsMode.toUpperCase()}</span>
                </div>
                <div>{speed.toFixed(0)} km/h</div>
              </div>

              {/* Navigation Map */}
              <div 
                id="driver-map" 
                style={{ 
                  height: '240px', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border-glass)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                  zIndex: 1
                }}
              />

              {/* Google Maps-Style Live Navigation Card */}
              {isShiftActive && speed > 0 ? (
                <div style={{
                  backgroundColor: '#0f9d58', // GMaps green color
                  color: '#ffffff',
                  padding: '16px',
                  borderRadius: '12px',
                  boxShadow: '0 8px 16px rgba(15, 157, 88, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  fontFamily: "'Inter', sans-serif"
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      padding: '8px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Navigation size={20} color="#fff" style={{ transform: 'rotate(45deg)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: lang === 'ur' ? 'right' : 'left' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.8)' }}>
                        {t.navigation}
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: '700' }}>
                        {currentBin ? `${t.headingTo} ${currentBin.name}` : t.headingBack}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar inside GMaps card */}
                  <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${transitPercent}%`, height: '100%', backgroundColor: '#ffffff' }}></div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '10px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: lang === 'ur' ? 'right' : 'left' }}>
                      <span style={{ fontSize: '24px', fontWeight: '800' }}>
                        {etaMinutes} <span style={{ fontSize: '14px', fontWeight: '400' }}>min</span>
                      </span>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
                        ETA: {new Date(Date.now() + etaMinutes * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ textAlign: lang === 'ur' ? 'left' : 'right', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '20px', fontWeight: '700' }}>
                        {distanceRemaining.toFixed(2)} <span style={{ fontSize: '14px', fontWeight: '400' }}>km</span>
                      </span>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
                        Speed: {speed.toFixed(0)} km/h
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.navigation}</div>
                    <div style={{ fontSize: '12px', color: 'var(--accent-purple)', fontWeight: 'bold' }}>{currentLegName()}</div>
                  </div>
                </div>
              )}

              {/* Destination Card */}
              {currentBin ? (
                <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(168, 85, 247, 0.2)', flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                    <MapPin size={14} />
                    <span>{t.targetNode} #{routeIndex + 1}</span>
                  </div>
                  
                  <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '12px' }}>{currentBin.name}</h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                      <span>{t.zoneClassification}:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                        {currentBin.zone_type === 'Residential' ? t.zoneResidential : t.zoneMainRoad}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                      <span>{t.requiredWindow}:</span>
                      <span style={{ color: 'var(--accent-orange)' }}>{currentBin.time_window}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                      <span>Latitude:</span>
                      <span>{currentLocation.latitude.toFixed(6)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                      <span>Longitude:</span>
                      <span>{currentLocation.longitude.toFixed(6)}</span>
                    </div>
                  </div>

                  {speed === 0 ? (
                    <button className="btn-primary" onClick={handleOpenPhotoCollection} style={{
                      width: '100%',
                      marginTop: 'auto',
                      background: 'linear-gradient(135deg, var(--accent-green), #047857)',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      flexDirection: lang === 'ur' ? 'row-reverse' : 'row'
                    }}>
                      <Camera size={18} />
                      {t.collectBtn}
                    </button>
                  ) : (
                    <div style={{ marginTop: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', border: '1px dashed var(--border-glass)', borderRadius: '8px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                      <Navigation size={14} className="pulse-dot" />
                      <span>{t.approaching}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', backgroundColor: '#fff' }}>
                  <Sparkles size={36} color="var(--accent-green)" style={{ marginBottom: '12px' }} />
                  <h4 style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{t.routeCleared}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', lineHeight: '1.5' }}>
                    {t.clearedDesc}
                  </p>
                  <button className="btn-primary" onClick={handleEndShift} style={{ marginTop: '20px', width: '100%', background: 'var(--accent-red)', color: '#fff', boxShadow: 'none' }}>
                    {t.endShift}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Shift Summary View */}
          {shiftSummary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, justifyContent: 'center', textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px auto',
                color: 'var(--accent-green)'
              }}>
                <CheckCircle size={32} />
              </div>
              
              <div>
                <h3 style={{ fontSize: '20px', marginBottom: '4px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{t.shiftSummary}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{t.perfSummary}</p>
              </div>

              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', fontSize: '14px', backgroundColor: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t.binsCollected}:</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{shiftSummary.binsCleaned} bins</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t.drivingTime}:</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{shiftSummary.shiftDurationMinutes} mins</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t.avgSpeed}:</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{shiftSummary.avgSpeed} km/h</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t.complianceRating}:</span>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>100% (No Violations)</span>
                </div>
              </div>

              <button className="btn-primary" onClick={() => setShiftSummary(null)} style={{ width: '100%' }}>
                {t.okayBtn}
              </button>
            </div>
          )}

          {/* Interactive Camera Shutter Overlay */}
          {isCameraOpen && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: '#000',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              padding: '24px 16px'
            }}>
              {/* Camera Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', marginBottom: '20px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{t.proofTitle}</span>
                <button onClick={() => setIsCameraOpen(false)} style={{ background: 'transparent', color: '#fff' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Viewfinder Canvas */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <canvas 
                  ref={canvasRef} 
                  width="300" 
                  height="300" 
                  style={{
                    width: '300px',
                    height: '300px',
                    borderRadius: '16px',
                    border: '3px solid var(--accent-green)',
                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)'
                  }}
                />
              </div>

              {/* Shutter Button */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: 'auto', paddingBottom: '20px' }}>
                <button 
                  onClick={handleCapturePhoto} 
                  disabled={uploading}
                  style={{
                    width: '70px',
                    height: '70px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    border: '5px solid #334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    cursor: uploading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {uploading ? (
                    <RefreshCw className="pulse-dot" color="#000" size={24} />
                  ) : (
                    <div style={{ width: '45px', height: '45px', borderRadius: '50%', backgroundColor: 'var(--accent-red)' }} />
                  )}
                </button>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                  {uploading ? t.uploadingProof : t.shutterHint}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DriverApp;

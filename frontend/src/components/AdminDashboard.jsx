import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  ArrowLeft, Play, RotateCcw, MapPin, 
  RefreshCw, Clock, AlertTriangle, 
  Globe, Fuel, Leaf
} from 'lucide-react';
import { translations, getRTLStyles } from '../translations';

const REGIONAL_TRAFFIC = {
  'Miyapur': [
    { name: 'Miyapur Metro Corridor', points: [[17.5020, 78.3650], [17.4970, 78.3680], [17.4890, 78.3740]], color: '#d93025', congestion: '88% (Severe Delay)' },
    { name: 'Sardar Patel Road', points: [[17.5060, 78.3520], [17.5020, 78.3650]], color: '#1e8e3e', congestion: '12% (Clear Traffic)' },
    { name: 'Ameenpur Road Transit', points: [[17.4910, 78.3720], [17.4970, 78.3680]], color: '#f9ab00', congestion: '54% (Moderate Delay)' }
  ],
  'Gachibowli': [
    { name: 'DLF Cybercity Expressway', points: [[17.4450, 78.3560], [17.4401, 78.3489], [17.4320, 78.3530]], color: '#d93025', congestion: '85% (Severe Delay)' },
    { name: 'ISB Road to Wipro', points: [[17.4280, 78.3450], [17.4360, 78.3400]], color: '#f9ab00', congestion: '42% (Moderate Delay)' }
  ],
  'Kukatpally': [
    { name: 'JNTU Main Highway', points: [[17.4930, 78.3820], [17.4855, 78.3885], [17.4780, 78.3990]], color: '#d93025', congestion: '91% (Critical Congestion)' }
  ],
  'Warangal': [
    { name: 'Hanamkonda Highway', points: [[17.9750, 79.6020], [17.9689, 79.5941], [17.9620, 79.5850]], color: '#d93025', congestion: '80% (Severe Delay)' }
  ],
  'Nizamabad': [
    { name: 'Kanteshwar Bypass Road', points: [[18.6850, 78.1150], [18.6725, 78.0986]], color: '#d93025', congestion: '76% (Heavy Traffic)' }
  ]
};

function AdminDashboard({ onNavigateHome, lang, onChangeLang, selectedRegion, onChangeRegion, regions, truckAssignments }) {
  const regionConfig = regions.find(r => r.name === selectedRegion) || regions[0];
  const [bins, setBins] = useState([]);
  const [depot, setDepot] = useState({ latitude: regionConfig.center[0], longitude: regionConfig.center[1], name: `Depot (${regionConfig.displayName.split(' (')[0]})` });
  const [activeRoute, setActiveRoute] = useState(null);
  const [routeMetrics, setRouteMetrics] = useState(null);
  const [truckTelemetries, setTruckTelemetries] = useState({});
  const [trucksCount, setTrucksCount] = useState(1);
  const [optimizing, setOptimizing] = useState(false);

  const allowedTrucks = (truckAssignments && truckAssignments[selectedRegion]) || 5;
  useEffect(() => {
    if (trucksCount > allowedTrucks) {
      setTrucksCount(allowedTrucks);
    }
  }, [allowedTrucks, trucksCount]);
  const [logs, setLogs] = useState(['System initialized. Standing by for instructions...']);
  const [wsStatus, setWsStatus] = useState('disconnected');

  // Custom Map Controls & Style
  const [mapStyle, setMapStyle] = useState('google-streets');
  const [showTrafficOverlay, setShowTrafficOverlay] = useState(true);
  const [placementMode, setPlacementMode] = useState('view');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Add Bin Modal state
  const [showAddBinModal, setShowAddBinModal] = useState(false);
  const [modalCoords, setModalCoords] = useState(null);
  const [newBinName, setNewBinName] = useState('');
  const [newBinZone, setNewBinZone] = useState('Residential');
  const [newBinTimeWindow, setNewBinTimeWindow] = useState('6:00 AM - 10:00 AM');

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef({});
  const polylineRef = useRef(null);
  const truckMarkersRef = useRef({});
  const depotMarkerRef = useRef(null);
  const trafficOverlayRef = useRef([]);
  const logsEndRef = useRef(null);
  const wsRef = useRef(null);

  // Sync refs to avoid Leaflet stale closures
  const placementModeRef = useRef(placementMode);
  const binsRef = useRef(bins);
  const depotRef = useRef(depot);

  useEffect(() => {
    placementModeRef.current = placementMode;
  }, [placementMode]);

  useEffect(() => {
    binsRef.current = bins;
  }, [bins]);

  useEffect(() => {
    depotRef.current = depot;
  }, [depot]);

  const isMountedRef = useRef(true);

  async function fetchData() {
    try {
      const binsRes = await fetch(`http://localhost:3001/api/bins?region=${encodeURIComponent(selectedRegion)}`);
      const binsData = await binsRes.json();
      if (!isMountedRef.current) return;
      setBins(binsData);

      const depotRes = await fetch(`http://localhost:3001/api/depot?region=${encodeURIComponent(selectedRegion)}`);
      const depotData = await depotRes.json();
      if (!isMountedRef.current) return;
      if (depotData && depotData.latitude) {
        setDepot(depotData);
      }

      const routeRes = await fetch(`http://localhost:3001/api/route?region=${encodeURIComponent(selectedRegion)}`);
      const routeData = await routeRes.json();
      if (!isMountedRef.current) return;
      if (routeData && routeData.route_sequence) {
        setActiveRoute(routeData.route_sequence);
        setRouteMetrics({
          distance_saved_km: routeData.distance_saved_km,
          optimized_distance_km: routeData.optimized_distance_km,
          unoptimized_distance_km: routeData.unoptimized_distance_km,
          fuel_saved_liters: routeData.fuel_saved_liters,
          co2_saved_kg: routeData.co2_saved_kg
        });
      } else {
        setActiveRoute(null);
        setRouteMetrics(null);
      }
    } catch (err) {
      console.error('Error fetching REST APIs:', err);
    }
  }

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Connect to WebSocket backend
  useEffect(() => {
    // Clear previous region's state immediately to prevent visual bleed-through
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setBins([]);
      setActiveRoute(null);
      setRouteMetrics(null);
      setTruckTelemetries({});
    }, 0);

    let isMounted = true;
    let reconnectTimeout = null;
    let ws = null;

    const connectWs = () => {
      if (!isMounted) return;
      
      const wsUrl = `ws://${window.location.hostname}:3001?region=${encodeURIComponent(selectedRegion)}`;
      console.log(`Connecting to WebSocket at ${wsUrl}...`);
      
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setWsStatus('connected');
        setLogs(prev => [...prev, `Realtime WebSocket tunnel established for [${selectedRegion}].`]);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        const msg = JSON.parse(event.data);
        if (msg.type === 'init') {
          setBins(msg.bins);
          setActiveRoute(msg.activeRoute);
          setRouteMetrics(msg.routeMetrics);
          if (msg.telemetries) setTruckTelemetries(msg.telemetries);
          if (msg.depot) setDepot(msg.depot);
        } else if (msg.type === 'telemetry') {
          if (msg.telemetry) {
            setTruckTelemetries(prev => ({
              ...prev,
              [msg.telemetry.truck_id]: msg.telemetry
            }));
          }
        } else if (msg.type === 'depot_updated') {
          setDepot(msg.depot);
        } else if (msg.type === 'collection') {
          setBins(prev => prev.map(b => b.id === msg.bin.id ? msg.bin : b));
          setLogs(prev => [...prev, `[COLLECTED] Driver verified clean bin at ${msg.bin.name}`]);
        } else if (msg.type === 'optimize') {
          setActiveRoute(msg.activeRoute);
          setRouteMetrics(msg.routeMetrics);
          setLogs(prev => [
            ...prev,
            'AI solver calculation received.',
            `Optimized route length: ${msg.routeMetrics.optimized_distance_km} km.`,
            `Avoided ${msg.routeMetrics.distance_saved_km} km of driving!`,
            `Liters of diesel saved: ${msg.routeMetrics.fuel_saved_liters} L.`,
            `CO2 footprint reduced by: ${msg.routeMetrics.co2_saved_kg} kg.`
          ]);
        } else if (msg.type === 'reset') {
          setBins(msg.bins);
          setActiveRoute(null);
          setRouteMetrics(null);
          setTruckTelemetries({});
          setLogs(prev => [...prev, 'Database states reset. All bins marked Pending.']);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setWsStatus('disconnected');
        reconnectTimeout = setTimeout(connectWs, 3000);
      };
    };

    connectWs();

    // Fallback: Fetch REST APIs
    setTimeout(() => {
      fetchData();
    }, 0);

    return () => {
      isMountedRef.current = false;
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.close();
      }
    };
  }, [selectedRegion]);

  const getTileUrl = (style) => {
    switch (style) {
      case 'google-streets':
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      case 'google-hybrid':
        return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case 'google-terrain':
        return 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      case 'osm-standard':
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      case 'carto-dark':
      default:
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    }
  };

  // Relocate depot handler
  const handleRelocateDepot = async (lat, lng) => {
    try {
      setLogs(prev => [...prev, `Relocating depot to [${lat.toFixed(4)}, ${lng.toFixed(4)}]...`]);
      const res = await fetch('http://localhost:3001/api/depot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng, name: 'Custom Depot', region: selectedRegion })
      });
      const data = await res.json();
      if (data.success) {
        setDepot(data.depot);
        setLogs(prev => [...prev, 'Depot relocated successfully. Re-optimizing route recommended.']);
      }
    } catch (err) {
      console.error('Error relocating depot:', err);
    }
  };

  // Delete bin handler
  const handleDeleteBin = async (binId) => {
    try {
      setLogs(prev => [...prev, `Deleting smart bin ID: ${binId}...`]);
      const res = await fetch(`http://localhost:3001/api/bins/${binId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setBins(prev => prev.filter(b => b.id !== binId));
        setLogs(prev => [...prev, `Smart bin ${binId} deleted successfully.`]);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.closePopup();
        }
      }
    } catch (err) {
      console.error('Error deleting bin:', err);
    }
  };

  // Bind to window to bridge vanilla popup HTML with React
  useEffect(() => {
    window.deleteBin = handleDeleteBin;
    return () => {
      window.deleteBin = null;
    };
  }, [bins]);

  const handleAddBinSubmit = async () => {
    if (!newBinName || !modalCoords) return;
    try {
      setLogs(prev => [...prev, `Creating new smart bin: ${newBinName} at [${modalCoords.lat.toFixed(4)}, ${modalCoords.lng.toFixed(4)}]...`]);
      const res = await fetch('http://localhost:3001/api/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBinName,
          latitude: modalCoords.lat,
          longitude: modalCoords.lng,
          zone_type: newBinZone,
          time_window: newBinTimeWindow,
          region: selectedRegion
        })
      });
      const data = await res.json();
      if (data.success) {
        setBins(prev => {
          const exists = prev.some(b => b.id === data.bin.id);
          if (exists) {
            return prev.map(b => b.id === data.bin.id ? data.bin : b);
          }
          return [...prev, data.bin];
        });
        setLogs(prev => [...prev, `Smart bin "${data.bin.name}" successfully established.`]);
        setShowAddBinModal(false);
      }
    } catch (err) {
      console.error('Error adding bin:', err);
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      const activeReg = regions.find(r => r.name === selectedRegion) || regions[0];
      const map = L.map(mapRef.current, {
        center: activeReg.center,
        zoom: 13,
        zoomControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Tile Layer (Google Streets default)
      const baseLayer = L.tileLayer(getTileUrl(mapStyle), {
        attribution: 'Map data &copy; Google, CARTO, OSM contributors'
      }).addTo(map);
      tileLayerRef.current = baseLayer;

      mapInstanceRef.current = map;

      // Handle map clicks
      map.on('click', (e) => {
        const mode = placementModeRef.current;
        if (mode === 'add-bin') {
          setModalCoords(e.latlng);
          setNewBinName(`Bin ${binsRef.current.length + 1}`);
          setShowAddBinModal(true);
        } else if (mode === 'move-depot') {
          handleRelocateDepot(e.latlng.lat, e.latlng.lng);
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync Map Center when selectedRegion changes
  useEffect(() => {
    if (mapInstanceRef.current && selectedRegion) {
      const activeReg = regions.find(r => r.name === selectedRegion) || regions[0];
      mapInstanceRef.current.setView(activeReg.center, 13);
    }
  }, [selectedRegion]);

  // Sync Map base layer style
  useEffect(() => {
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(getTileUrl(mapStyle));
    }
  }, [mapStyle]);

  // Sync Depot Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (depotMarkerRef.current) {
      map.removeLayer(depotMarkerRef.current);
      depotMarkerRef.current = null;
    }

    const depotIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `
        <svg width="34" height="44" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.4));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#f97316"/>
          <circle cx="12" cy="9" r="5.5" fill="#ffffff"/>
          <text x="12" y="12" fill="#f97316" font-size="9" font-weight="900" text-anchor="middle">D</text>
        </svg>
      `,
      iconSize: [34, 44],
      iconAnchor: [17, 40]
    });

    depotMarkerRef.current = L.marker([depot.latitude, depot.longitude], { icon: depotIcon })
      .addTo(map)
      .bindPopup(`<b>${depot.name}</b><br/>${translations[lang].depotPopup}`);
  }, [depot, lang]);

  // Sync Traffic Overlay
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    trafficOverlayRef.current.forEach(layer => map.removeLayer(layer));
    trafficOverlayRef.current = [];

    if (showTrafficOverlay) {
      const trafficStreets = REGIONAL_TRAFFIC[selectedRegion] || [];

      trafficStreets.forEach(street => {
        const polyline = L.polyline(street.points, {
          color: street.color,
          weight: 6,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        polyline.bindTooltip(`<b>${street.name}</b><br/>Congestion: ${street.congestion}`, {
          sticky: true
        });

        trafficOverlayRef.current.push(polyline);
      });
    }
  }, [showTrafficOverlay, selectedRegion]);

  // Sync Bins & Route on Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear old bin markers
    Object.keys(markersRef.current).forEach(key => {
      map.removeLayer(markersRef.current[key]);
    });
    markersRef.current = {};

    // Clear old route polyline
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    if (bins.length === 0) return;

    // Find the next pending bin ID in activeRoute sequence
    let nextPendingBinId = null;
    if (activeRoute) {
      const isMultiRoute = !Array.isArray(activeRoute) && typeof activeRoute === 'object';
      const allRouteIds = isMultiRoute 
        ? Object.values(activeRoute).flat() 
        : activeRoute;

      if (Array.isArray(allRouteIds)) {
        nextPendingBinId = allRouteIds.find(id => {
          const b = bins.find(bin => bin.id === id);
          return b && b.status === 'Pending';
        });
      }
    }

    // Draw bin markers
    bins.forEach((bin) => {
      const isNext = bin.id === nextPendingBinId;
      
      const markerColor = bin.status === 'Collected' 
        ? '#34a853' 
        : (isNext ? '#1a73e8' : '#ea4335');
        
      const pinHtml = `
        <div style="position: relative; width: 30px; height: 40px; display: flex; align-items: center; justify-content: center;">
          ${isNext ? '<div class="pulse-dot" style="position: absolute; top: 2px; left: 2px; width: 26px; height: 26px; border-radius: 50%; background-color: rgba(26,115,232,0.25); z-index: 1;"></div>' : ''}
          <svg width="30" height="40" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="position: relative; z-index: 2; filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.3));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${markerColor}"/>
            <circle cx="12" cy="9" r="4.5" fill="#ffffff"/>
          </svg>
        </div>
      `;

      const binHtmlIcon = L.divIcon({
        className: 'custom-div-icon',
        html: pinHtml,
        iconSize: [30, 40],
        iconAnchor: [15, 36]
      });

      const popupContent = `
        <div style="color: #0f172a; font-family: sans-serif; font-size: 13px; text-align: left; padding: 4px;">
          <b style="font-size:14px; color: #0f172a;">${bin.name}</b><br/>
          <b>${translations[lang].zone}:</b> ${bin.zone_type === 'Residential' ? translations[lang].zoneResidential : translations[lang].zoneMainRoad}<br/>
          <b>${translations[lang].status}:</b> <span style="color: ${bin.status === 'Collected' ? 'green' : 'red'}; font-weight: bold;">${bin.status === 'Collected' ? translations[lang].collected : translations[lang].pending}</span><br/>
          <b>${translations[lang].restriction}:</b> ${bin.time_window}<br/>
          ${bin.collected_at ? `<b>${translations[lang].collectedAt}:</b> ${new Date(bin.collected_at).toLocaleTimeString()}` : ''}
          <div style="margin-top: 8px;">
            <button onclick="window.deleteBin('${bin.id}')" style="background-color: #ea4335; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size:11px;">
              ${translations[lang].deleteBinBtn}
            </button>
          </div>
        </div>
      `;

      const marker = L.marker([bin.latitude, bin.longitude], { icon: binHtmlIcon })
        .addTo(map)
        .bindPopup(popupContent);

      markersRef.current[bin.id] = marker;
    });

    // Draw Route Polyline
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    if (activeRoute) {
      const isMultiRoute = !Array.isArray(activeRoute) && typeof activeRoute === 'object';
      const routesToDraw = isMultiRoute ? activeRoute : { "Truck_1": activeRoute };
      
      const colors = {
        "Truck_1": { outline: "#1557b0", main: "#1a73e8" }, // Blue
        "Truck_2": { outline: "#065f46", main: "#10b981" }, // Green
        "Truck_3": { outline: "#5b21b6", main: "#8b5cf6" }, // Purple
        "Truck_4": { outline: "#9a3412", main: "#f97316" }, // Orange
        "Truck_5": { outline: "#991b1b", main: "#ef4444" }, // Red
        "Truck_6": { outline: "#9d174d", main: "#ec4899" }, // Pink
        "Truck_7": { outline: "#0f766e", main: "#14b8a6" }, // Teal
        "Truck_8": { outline: "#0e7490", main: "#06b6d4" }, // Cyan
        "Truck_9": { outline: "#a16207", main: "#eab308" }, // Yellow
        "Truck_10": { outline: "#3730a3", main: "#6366f1" }, // Indigo
        "default": { outline: "#b45309", main: "#f59e0b" }
      };

      const group = L.featureGroup().addTo(map);
      polylineRef.current = group;

      Object.entries(routesToDraw).forEach(([truckKey, seq]) => {
        if (!seq || seq.length === 0) return;

        const routeLatLngs = [
          [depot.latitude, depot.longitude]
        ];

        seq.forEach(binId => {
          const bin = bins.find(b => b.id === binId);
          if (bin) {
            routeLatLngs.push([bin.latitude, bin.longitude]);
          }
        });

        routeLatLngs.push([depot.latitude, depot.longitude]);

        const truckColors = colors[truckKey] || colors["default"];
        let fallbackLines = [];

        const polylineOutline = L.polyline(routeLatLngs, {
          color: truckColors.outline,
          weight: 8,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(group);

        const polylineForeground = L.polyline(routeLatLngs, {
          color: truckColors.main,
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(group);

        fallbackLines.push(polylineOutline, polylineForeground);

        // Fetch road-aligned path from OSRM
        const coordsQuery = routeLatLngs.map(pt => `${pt[1]},${pt[0]}`).join(';');
        fetch(`https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson`)
          .then(res => res.json())
          .then(data => {
            if (data && data.routes && data.routes[0]) {
              const roadPoints = data.routes[0].geometry.coordinates.map(pt => [pt[1], pt[0]]);
              
              // Remove fallback straight lines
              fallbackLines.forEach(line => group.removeLayer(line));

              L.polyline(roadPoints, {
                color: truckColors.outline,
                weight: 8,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(group);

              L.polyline(roadPoints, {
                color: truckColors.main,
                weight: 5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(group);
            }
          })
          .catch(err => {
            console.warn("OSRM routing failed, keeping fallback straight line:", err);
          });
      });
    }

  }, [bins, activeRoute, depot, lang]);

  // Sync Truck Positions on Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Build the list of active trucks to display on the map
    const activeTrucks = {};
    const maxTrucks = activeRoute && typeof activeRoute === 'object'
      ? Math.max(trucksCount, Object.keys(activeRoute).length)
      : trucksCount;

    // Default all active trucks to starting depot if telemetry is not yet present
    if (depot && depot.latitude) {
      for (let i = 1; i <= maxTrucks; i++) {
        const tId = `Truck_${i}`;
        activeTrucks[tId] = {
          truck_id: tId,
          latitude: depot.latitude,
          longitude: depot.longitude,
          speed: 0,
          timestamp: new Date().toISOString()
        };
      }
    }

    // Overlay real telemetry if available
    Object.entries(truckTelemetries).forEach(([tId, telemetry]) => {
      if (telemetry && telemetry.latitude) {
        activeTrucks[tId] = telemetry;
      }
    });

    // Remove obsolete truck markers that are no longer part of activeTrucks
    Object.keys(truckMarkersRef.current).forEach(tId => {
      if (!activeTrucks[tId]) {
        map.removeLayer(truckMarkersRef.current[tId]);
        delete truckMarkersRef.current[tId];
      }
    });

    // Draw active truck markers
    Object.entries(activeTrucks).forEach(([tId, telemetry]) => {
      if (!telemetry || !telemetry.latitude) return;

      const colors = {
        "Truck_1": { fill: "#1a73e8", shadow: "0 0 10px rgba(26,115,232,0.8)" },
        "Truck_2": { fill: "#10b981", shadow: "0 0 10px rgba(16,185,129,0.8)" },
        "Truck_3": { fill: "#8b5cf6", shadow: "0 0 10px rgba(139,92,246,0.8)" },
        "Truck_4": { fill: "#f97316", shadow: "0 0 10px rgba(249,115,22,0.8)" },
        "Truck_5": { fill: "#ef4444", shadow: "0 0 10px rgba(239,68,68,0.8)" },
        "Truck_6": { fill: "#ec4899", shadow: "0 0 10px rgba(236,72,153,0.8)" },
        "Truck_7": { fill: "#14b8a6", shadow: "0 0 10px rgba(20,184,166,0.8)" },
        "Truck_8": { fill: "#06b6d4", shadow: "0 0 10px rgba(6,182,212,0.8)" },
        "Truck_9": { fill: "#eab308", shadow: "0 0 10px rgba(234,179,8,0.8)" },
        "Truck_10": { fill: "#6366f1", shadow: "0 0 10px rgba(99,102,241,0.8)" },
        "default": { fill: "#f59e0b", shadow: "0 0 10px rgba(245,158,11,0.8)" }
      };
      
      const truckColor = colors[tId] || colors["default"];

      const truckHtmlIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${truckColor.fill}; width: 26px; height: 26px; border-radius: 50%; border: 3px solid #fff; box-shadow: ${truckColor.shadow}; display: flex; align-items: center; justify-content: center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg><span style="position: absolute; top: -14px; background: rgba(0,0,0,0.7); color: #fff; font-size: 8px; padding: 1px 4px; border-radius: 3px; font-weight: bold; white-space: nowrap;">${tId.replace('_', ' ')}</span></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const popupContent = `
        <div style="font-family: sans-serif; font-size:12px; color:#1e293b; padding:4px;">
          <b style="font-size:13px; color:#0f172a;">🚚 ${tId.replace('_', ' ')}</b><br/>
          <b>Speed:</b> ${telemetry.speed ? telemetry.speed.toFixed(1) : 0} km/h<br/>
          ${telemetry.next_bin_name && telemetry.next_bin_name !== 'None' ? `
            <div style="margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <b>Heading To:</b> ${telemetry.next_bin_name}<br/>
              <b>ETA:</b> ${telemetry.eta_minutes || 0} mins (${telemetry.distance_remaining_km ? telemetry.distance_remaining_km.toFixed(2) : 0} km remaining)
            </div>
          ` : ''}
        </div>
      `;

      if (truckMarkersRef.current[tId]) {
        truckMarkersRef.current[tId].setLatLng([telemetry.latitude, telemetry.longitude]);
        truckMarkersRef.current[tId].setPopupContent(popupContent);
      } else {
        const marker = L.marker([telemetry.latitude, telemetry.longitude], { icon: truckHtmlIcon })
          .addTo(map)
          .bindPopup(popupContent);
        truckMarkersRef.current[tId] = marker;
      }
    });
  }, [truckTelemetries, activeRoute, trucksCount, depot]);

  // Action: Trigger Optimization
  const handleOptimize = async () => {
    setOptimizing(true);
    setLogs(prev => [
      ...prev,
      '------------------------------------------------',
      '⚡ [API] Triggering Pre-Shift AI Optimization Engine...',
      '🔍 Querying database for pending waste bins...',
    ]);

    // Simulate logs in step-by-step
    setTimeout(() => setLogs(prev => [...prev, '📦 Data Retrieval: Fetched 12 pending bins.']));
    setTimeout(() => setLogs(prev => [...prev, '🛠️ Zone Checking: Imposed Rush-Hour restriction rules.']));
    setTimeout(() => setLogs(prev => [...prev, '   - Rules: "Main Roads" restricted during 7:00 AM - 10:00 AM.']));
    setTimeout(() => setLogs(prev => [...prev, '   - Rules: "Residential Zones" prioritized during rush hour.']));
    setTimeout(() => setLogs(prev => [...prev, '🧠 Routing Engine: Invoking Python solver (Google OR-Tools VRPTW)...']), 1000);
    setTimeout(() => setLogs(prev => [...prev, '🛰️ Dijkstra Pathfinder: Running Dijkstra shortest-path calculations on the road graph...']), 1800);
    setTimeout(() => setLogs(prev => [...prev, '   - Snapped start depot and bins to nearest street grid intersection nodes.']), 2300);
    setTimeout(() => setLogs(prev => [...prev, '   - Computed distance matrix using cost/congestion-weighted edges.']), 2800);

    try {
      const res = await fetch(`http://localhost:3001/api/optimize?region=${encodeURIComponent(selectedRegion)}&trucks=${trucksCount}`, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setActiveRoute(data.activeRoute);
        setRouteMetrics(data.metrics);
      } else {
        setLogs(prev => [...prev, `❌ Error: ${data.error || 'Optimization calculation failed.'}`]);
      }
    } catch {
      setLogs(prev => [...prev, `❌ Network Error: Could not connect to Express routing API.`]);
    } finally {
      setOptimizing(false);
    }
  };

  // Action: Reset
  const handleReset = async () => {
    try {
      await fetch(`http://localhost:3001/api/bins/reset?region=${encodeURIComponent(selectedRegion)}`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  // Calculations for display
  const totalBinsCount = bins.length;
  const collectedBinsCount = bins.filter(b => b.status === 'Collected').length;
  const completionPercentage = totalBinsCount ? Math.round((collectedBinsCount / totalBinsCount) * 100) : 0;

  // Calculate dynamic moving metrics
  const getDynamicMetrics = () => {
    if (!routeMetrics) return null;
    
    // Check if movement has started: either at least one bin has been collected, 
    // or at least one truck has connected and has a speed greater than 0.
    const activeTelemetries = Object.values(truckTelemetries);
    const hasMovementStarted = collectedBinsCount > 0 || activeTelemetries.some(t => t && t.latitude && t.speed > 0);
    
    if (!hasMovementStarted) {
      return {
        distance_saved_km: '0.00',
        fuel_saved_liters: '0.0',
        co2_saved_kg: '0.0'
      };
    }
    
    let totalProgress = 0;
    const activeTruckIds = activeRoute && typeof activeRoute === 'object' ? Object.keys(activeRoute) : [];
    const numActiveTrucks = activeTruckIds.length || 1;
    
    if (activeRoute && typeof activeRoute === 'object') {
      activeTruckIds.forEach(tId => {
        const route = activeRoute[tId] || [];
        const tel = truckTelemetries[tId];
        
        // Find how many bins on this truck's route are collected
        const routeCollectedCount = route.filter(binId => {
          const b = bins.find(x => x.id === binId);
          return b && b.status === 'Collected';
        }).length;
        
        let truckProgress = route.length > 0 ? (routeCollectedCount / route.length) : 1.0;
        
        if (tel && tel.speed > 0 && routeCollectedCount < route.length) {
          const estLegProgress = tel.distance_remaining_km 
            ? Math.max(0, Math.min(0.9, 1 - (tel.distance_remaining_km / 1.5))) 
            : 0.5;
          truckProgress += (estLegProgress / route.length);
        }
        
        totalProgress += Math.min(1.0, truckProgress);
      });
      
      const avgProgress = totalProgress / numActiveTrucks;
      
      return {
        distance_saved_km: (routeMetrics.distance_saved_km * avgProgress).toFixed(2),
        fuel_saved_liters: (routeMetrics.fuel_saved_liters * avgProgress).toFixed(1),
        co2_saved_kg: (routeMetrics.co2_saved_kg * avgProgress).toFixed(1)
      };
    } else {
      const progress = totalBinsCount > 0 ? (collectedBinsCount / totalBinsCount) : 0;
      return {
        distance_saved_km: (routeMetrics.distance_saved_km * progress).toFixed(2),
        fuel_saved_liters: (routeMetrics.fuel_saved_liters * progress).toFixed(1),
        co2_saved_kg: (routeMetrics.co2_saved_kg * progress).toFixed(1)
      };
    }
  };

  const dynamicMetrics = getDynamicMetrics();

  // Determine current active traffic state (simulated)
  const currentHour = new Date().getHours();
  const isRushHour = currentHour >= 7 && currentHour < 10;
  const t = translations[lang];
  const rtlStyles = getRTLStyles(lang);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#f1f5f9', position: 'relative', ...rtlStyles }}>
      
      {/* FULL-SCREEN MAP CONTAINER */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        <div id="map" ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
      </div>

      {/* FLOATING LEFT SIDEBAR (GOOGLE MAPS STYLE) */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: lang === 'ur' ? 'auto' : '20px',
        right: lang === 'ur' ? '20px' : 'auto',
        zIndex: 1000,
        width: '390px',
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none'
      }}>
        {/* Floating Google Maps Search/Control Card */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'auto',
          height: '48px'
        }}>
          <button onClick={onNavigateHome} style={{ background: 'transparent', padding: '8px', color: '#5f6368', display: 'flex', alignItems: 'center' }} title="Back to Portal">
            <ArrowLeft size={20} style={{ transform: lang === 'ur' ? 'rotate(180deg)' : 'none' }} />
          </button>
          
          <div style={{ flex: 1, fontSize: '15px', color: '#202124', fontWeight: '500', display: 'flex', alignItems: 'center', paddingLeft: '4px' }}>
            {t.dashTitle}
          </div>

          <div style={{ width: '1px', height: '28px', backgroundColor: '#dadce0' }}></div>

          {/* Quick Region Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={14} color="#1a73e8" style={{ flexShrink: 0 }} />
            <select 
              value={selectedRegion} 
               onChange={(e) => onChangeRegion(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '13.5px',
                fontWeight: '700',
                color: '#1a73e8',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                maxWidth: '130px'
              }}
            >
              {regions.map(r => (
                <option key={r.name} value={r.name}>
                  {r.name === 'Kukatpally' ? 'KPHB' : r.displayName.split(' (')[0].replace('Hyderabad - ', '')}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: '1px', height: '28px', backgroundColor: '#dadce0' }}></div>

          {/* Quick Language Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Globe size={14} color="#5f6368" />
            <select 
              value={lang} 
              onChange={(e) => onChangeLang(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                fontWeight: '600',
                color: '#5f6368',
                backgroundColor: 'transparent',
                cursor: 'pointer'
              }}
            >
              <option value="en">EN</option>
              <option value="te">TE</option>
              <option value="hi">HI</option>
              <option value="ur">UR</option>
            </select>
          </div>

          <div style={{ width: '1px', height: '28px', backgroundColor: '#dadce0' }}></div>

          {/* Toggle Expand/Collapse Sidebar Panel */}
          <button
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              cursor: 'pointer',
              color: '#1a73e8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={isPanelCollapsed ? "Expand Details" : "Collapse Details"}
          >
            {isPanelCollapsed ? "▼" : "▲"}
          </button>
        </div>

        {/* Floating Metrics, Progress & Actions Panel */}
        {!isPanelCollapsed && (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            pointerEvents: 'auto',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto'
          }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: '#5f6368' }}>{t.dashStatus}</div>
              <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', backgroundColor: wsStatus === 'connected' ? '#e6f4ea' : '#fce8e6', color: wsStatus === 'connected' ? '#137333' : '#c5221f', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: wsStatus === 'connected' ? '#137333' : '#c5221f' }}></span>
                {wsStatus === 'connected' ? 'Live' : 'Offline'}
              </span>
            </div>

            {/* Number of Trucks Selection */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f3f4', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#3c4043', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🚚</span>
                <span>{lang === 'te' ? 'ట్రక్కుల సంఖ్య' : lang === 'hi' ? 'ट्रकों की संख्या' : lang === 'ur' ? 'ٹرکوں کی تعداد' : 'Number of Trucks'}</span>
              </div>
              <select
                value={trucksCount}
                onChange={(e) => setTrucksCount(Number(e.target.value))}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #dadce0',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#3c4043',
                  backgroundColor: '#fff',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {[...Array(allowedTrucks)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} {i === 0 
                      ? (lang === 'te' ? 'ట్రక్' : lang === 'hi' ? 'ट्रक' : lang === 'ur' ? 'ٹرک' : 'Truck')
                      : (lang === 'te' ? 'ట్రక్కులు' : lang === 'hi' ? 'ट्रक' : lang === 'ur' ? 'ٹرک' : 'Trucks')
                    }
                  </option>
                ))}
              </select>
            </div>

            {/* AI Action buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-primary" 
                onClick={handleOptimize} 
                disabled={optimizing} 
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  padding: '10px', 
                  fontSize: '13px',
                  backgroundColor: '#1a73e8',
                  borderRadius: '4px',
                  boxShadow: 'none'
                }}
              >
                {optimizing ? <RefreshCw className="pulse-dot" size={14} /> : <Play size={14} />}
                {t.optimizeBtn}
              </button>

              <button 
                className="btn-secondary" 
                onClick={handleReset} 
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  padding: '10px', 
                  fontSize: '13px',
                  borderColor: '#dadce0', 
                  color: '#5f6368',
                  borderRadius: '4px'
                }}
              >
                <RotateCcw size={14} />
                {t.resetBtn}
              </button>
            </div>

            {/* Traffic State Info */}
            {isRushHour ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#fef7e0', color: '#b06000', fontSize: '12px' }}>
                <AlertTriangle size={15} />
                <span>Active Rush Hour (07:00 - 10:00)</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#e6f4ea', color: '#137333', fontSize: '12px' }}>
                <Clock size={15} />
                <span>Off-Peak Traffic Conditions</span>
              </div>
            )}

            {/* Progress / Completion */}
            <div style={{ borderTop: '1px solid #f1f3f4', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#5f6368', fontWeight: '500' }}>{t.shiftStatus}</span>
                <span style={{ color: '#137333', fontWeight: '700' }}>{completionPercentage}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#202124' }}>{collectedBinsCount}/{totalBinsCount}</div>
                <div style={{ fontSize: '11px', color: '#5f6368' }}>{t.collected}</div>
              </div>
              <div style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: '#f1f3f4', overflow: 'hidden', marginTop: '6px' }}>
                <div style={{ width: `${completionPercentage}%`, height: '100%', backgroundColor: '#137333', borderRadius: '2px' }}></div>
              </div>
            </div>

            {/* ROI Savings */}
            {dynamicMetrics && (
              <div style={{ borderTop: '1px solid #f1f3f4', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#202124' }}>{t.roiHeader}</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
                  {/* Distance Saved */}
                  <div style={{
                    background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                    border: '1px solid #7dd3fc',
                    borderRadius: '8px',
                    padding: '8px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    textAlign: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MapPin size={15} />
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                      {lang === 'te' ? 'దూరం' : lang === 'hi' ? 'दूरी' : lang === 'ur' ? 'فاصلہ' : 'Distance'}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0c4a6e' }}>
                      {dynamicMetrics.distance_saved_km} km
                    </div>
                  </div>

                  {/* Fuel Saved */}
                  <div style={{
                    background: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)',
                    border: '1px solid #fdba74',
                    borderRadius: '8px',
                    padding: '8px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    textAlign: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Fuel size={15} />
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                      {lang === 'te' ? 'డీజిల్' : lang === 'hi' ? 'डीजल' : lang === 'ur' ? 'ڈیزل' : 'Diesel'}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#7c2d12' }}>
                      {dynamicMetrics.fuel_saved_liters} L
                    </div>
                  </div>

                  {/* Carbon Offset */}
                  <div style={{
                    background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                    border: '1px solid #86efac',
                    borderRadius: '8px',
                    padding: '8px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    textAlign: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Leaf size={15} />
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                      {lang === 'te' ? 'సీఓ2' : lang === 'hi' ? 'सीओ2' : lang === 'ur' ? 'کاربن' : 'CO₂ Saved'}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#14532d' }}>
                      {dynamicMetrics.co2_saved_kg} kg
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active Route Sequence List */}
            {activeRoute && (
              <div style={{ borderTop: '1px solid #f1f3f4', paddingTop: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#202124', marginBottom: '6px' }}>{t.optRoute} Sequence</div>
                <div style={{
                  maxHeight: '130px',
                  overflowY: 'auto',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  backgroundColor: '#f8fafc',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #e8eaed',
                  color: '#2d3748',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  {(() => {
                    const isMultiRoute = !Array.isArray(activeRoute) && typeof activeRoute === 'object';
                    if (isMultiRoute) {
                      const colors = {
                        "Truck_1": { hex: "#1a73e8", en: "Blue", te: "బ్లూ", hi: "ब्लू", ur: "نیلا" },
                        "Truck_2": { hex: "#10b981", en: "Green", te: "గ్రీన్", hi: "ग्रीन", ur: "سبز" },
                        "Truck_3": { hex: "#8b5cf6", en: "Purple", te: "పర్పుల్", hi: "पर्पल", ur: "جامنی" },
                        "Truck_4": { hex: "#f97316", en: "Orange", te: "ఆరెంజ్", hi: "ऑरेंज", ur: "نارنجی" },
                        "Truck_5": { hex: "#ef4444", en: "Red", te: "రెడ్", hi: "रेड", ur: "سرخ" },
                        "Truck_6": { hex: "#ec4899", en: "Pink", te: "పిंक", hi: "पिंक", ur: "گلابی" },
                        "Truck_7": { hex: "#14b8a6", en: "Teal", te: "టీల్", hi: "टीले", ur: "تیل" },
                        "Truck_8": { hex: "#06b6d4", en: "Cyan", te: "క్యాన్", hi: "स्यान", ur: "کیرولین" },
                        "Truck_9": { hex: "#eab308", en: "Yellow", te: "ఎల్లో", hi: "येलो", ur: "پیلا" },
                        "Truck_10": { hex: "#6366f1", en: "Indigo", te: "గ్రే", hi: "ग्रे", ur: "سرمئی" }
                      };
                      return Object.entries(activeRoute).map(([truckId, seq]) => {
                        const info = colors[truckId] || { hex: "#f59e0b", en: "Orange", te: "ఆరెంజ్", hi: "ऑरेंज", ur: "نارنجی" };
                        const colorLabel = lang === 'te' ? info.te : lang === 'hi' ? info.hi : lang === 'ur' ? info.ur : info.en;
                        return (
                          <div key={truckId} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                            <strong style={{ color: '#2d3748' }}>{truckId.replace('_', ' ')}</strong>
                            <span style={{
                              backgroundColor: info.hex,
                              color: '#fff',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              fontSize: '9px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              lineHeight: '1.2'
                            }}>
                              {colorLabel}
                            </span>
                            <span style={{ color: '#4a5568' }}>: Depot ➔ {(seq || []).map(id => {
                              const b = bins.find(x => x.id === id);
                              return b ? b.name.split(' - ')[0] : `Bin #${id}`;
                            }).join(' ➔ ')} ➔ Depot</span>
                          </div>
                        );
                      });
                    } else {
                      return (
                        <div style={{ color: '#4a5568' }}>
                          Depot ➔ {(activeRoute || []).map(id => {
                            const b = bins.find(x => x.id === id);
                            return b ? b.name.split(' - ')[0] : `Bin #${id}`;
                          }).join(' ➔ ')} ➔ Depot
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            )}

            {/* Live Fleet Navigation Status */}
            {Object.keys(truckTelemetries).length > 0 && (
              <div style={{ borderTop: '1px solid #f1f3f4', paddingTop: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#202124', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0f9d58' }}></span>
                  Live Fleet Navigation
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {Object.entries(truckTelemetries).map(([truckId, telemetry]) => {
                    if (!telemetry) return null;
                    return (
                      <div key={truckId} style={{
                        padding: '10px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '11px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                          <span style={{ color: '#1e293b' }}>🚚 {truckId.replace('_', ' ')}</span>
                          <span style={{ color: '#0f9d58' }}>{telemetry.speed ? `${telemetry.speed.toFixed(0)} km/h` : 'Stopped'}</span>
                        </div>
                        {telemetry.next_bin_name && telemetry.next_bin_name !== 'None' ? (
                          <div style={{ color: '#475569', marginTop: '2px' }}>
                            <div><b>Next Bin:</b> {telemetry.next_bin_name}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginTop: '2px' }}>
                              <span><b>ETA:</b> {telemetry.eta_minutes || 0} mins</span>
                              <span><b>Distance:</b> {telemetry.distance_remaining_km ? telemetry.distance_remaining_km.toFixed(2) : 0} km</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: '#64748b', fontStyle: 'italic' }}>Waiting for shift to begin...</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Placement Mode buttons */}
            <div style={{ borderTop: '1px solid #f1f3f4', paddingTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#202124', marginBottom: '8px' }}>{t.placementMode}</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  onClick={() => setPlacementMode('view')}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    backgroundColor: placementMode === 'view' ? '#e8f0fe' : '#fff',
                    color: placementMode === 'view' ? '#1a73e8' : '#5f6368',
                    border: `1px solid ${placementMode === 'view' ? '#1a73e8' : '#dadce0'}`
                  }}
                >
                  🔍 {t.modeView}
                </button>
                <button 
                  onClick={() => setPlacementMode('add-bin')}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    backgroundColor: placementMode === 'add-bin' ? '#e6f4ea' : '#fff',
                    color: placementMode === 'add-bin' ? '#137333' : '#5f6368',
                    border: `1px solid ${placementMode === 'add-bin' ? '#137333' : '#dadce0'}`
                  }}
                >
                  🗑️ {t.modeAddBin}
                </button>
                <button 
                  onClick={() => setPlacementMode('move-depot')}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    backgroundColor: placementMode === 'move-depot' ? '#fef7e0' : '#fff',
                    color: placementMode === 'move-depot' ? '#b06000' : '#5f6368',
                    border: `1px solid ${placementMode === 'move-depot' ? '#b06000' : '#dadce0'}`
                  }}
                >
                  🏠 {t.modeMoveDepot}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FLOATING RIGHT MAP WIDGETS (ZOOM, LAYERS, TRAFFIC) */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        right: lang === 'ur' ? 'auto' : '20px',
        left: lang === 'ur' ? '20px' : 'auto',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'auto'
      }}>
        {/* Zoom Controls */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <button 
            onClick={handleZoomIn}
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#fff',
              borderBottom: '1px solid #f1f3f4',
              color: '#5f6368',
              fontSize: '20px',
              fontWeight: '300',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            +
          </button>
          <button 
            onClick={handleZoomOut}
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#fff',
              color: '#5f6368',
              fontSize: '20px',
              fontWeight: '300',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            −
          </button>
        </div>

        {/* Traffic Overlay Toggle Widget */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: '#202124',
          fontWeight: '500',
          cursor: 'pointer'
        }}>
          <input 
            type="checkbox" 
            id="trafficToggle"
            checked={showTrafficOverlay} 
            onChange={(e) => setShowTrafficOverlay(e.target.checked)} 
            style={{ cursor: 'pointer' }}
          />
          <label htmlFor="trafficToggle" style={{ cursor: 'pointer' }}>{t.trafficOverlay}</label>
        </div>

        {/* Map Type / Layer Selector Widget */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          width: '160px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.mapStyle}</div>
          <select 
            value={mapStyle} 
            onChange={(e) => setMapStyle(e.target.value)}
            style={{
              padding: '6px 8px',
              border: '1px solid #dadce0',
              borderRadius: '4px',
              fontSize: '12px',
              backgroundColor: '#fff',
              color: '#202124',
              outline: 'none',
              fontWeight: '500',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            <option value="google-streets">Google Streets</option>
            <option value="google-hybrid">Google Hybrid</option>
            <option value="google-terrain">Google Terrain</option>
            <option value="osm-standard">OSM Standard</option>
            <option value="carto-dark">CARTO Dark Neon</option>
          </select>
        </div>
      </div>

      {/* FLOATING LOG WINDOW (MINIMIZABLE LOGGER ON BOTTOM LEFT) */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: lang === 'ur' ? 'auto' : '20px',
        right: lang === 'ur' ? '20px' : 'auto',
        zIndex: 1000,
        width: '390px',
        pointerEvents: 'auto',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#0f172a',
          color: '#38bdf8',
          fontSize: '11px',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          <span>{t.activityLogs}</span>
          <span style={{ fontSize: '9px', color: '#94a3b8' }}>Realtime Solver Telemetry</span>
        </div>
        <div className="terminal-window" style={{
          maxHeight: '100px',
          borderRadius: '0',
          border: 'none',
          backgroundColor: 'transparent',
          padding: '8px 12px'
        }}>
          {logs.map((log, idx) => (
            <div key={idx} style={{ marginBottom: '2px' }}>{log}</div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Create New Bin Modal */}
      {showAddBinModal && modalCoords && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          ...rtlStyles
        }}>
          <div style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#202124', marginBottom: '16px' }}>
              {t.addBinTitle}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#5f6368', marginBottom: '4px' }}>
                  {t.binNameField}
                </label>
                <input 
                  type="text" 
                  value={newBinName} 
                  onChange={(e) => setNewBinName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #dadce0',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#202124',
                    outline: 'none',
                    textAlign: lang === 'ur' ? 'right' : 'left'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#5f6368', marginBottom: '4px' }}>
                  {t.zoneTypeField}
                </label>
                <select 
                  value={newBinZone} 
                  onChange={(e) => {
                    setNewBinZone(e.target.value);
                    if (e.target.value === 'Residential') {
                      setNewBinTimeWindow('6:00 AM - 10:00 AM');
                    } else {
                      setNewBinTimeWindow('10:00 AM - 6:00 PM');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #dadce0',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#202124',
                    backgroundColor: '#fff',
                    outline: 'none'
                  }}
                >
                  <option value="Residential">{t.zoneResidential}</option>
                  <option value="Main Road">{t.zoneMainRoad}</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#5f6368', marginBottom: '4px' }}>
                  {t.restriction}
                </label>
                <input 
                  type="text" 
                  value={newBinTimeWindow} 
                  disabled
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #f1f3f4',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#94a3b8',
                    backgroundColor: '#f1f3f4',
                    outline: 'none',
                    textAlign: lang === 'ur' ? 'right' : 'left'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
              <button 
                onClick={() => setShowAddBinModal(false)}
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '13px', 
                  borderRadius: '4px', 
                  backgroundColor: '#fff', 
                  border: '1px solid #dadce0', 
                  color: '#5f6368',
                  fontWeight: '500'
                }}
              >
                {t.cancelBtn}
              </button>
              <button 
                onClick={handleAddBinSubmit}
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '13px', 
                  borderRadius: '4px', 
                  backgroundColor: '#1a73e8', 
                  color: '#fff',
                  fontWeight: '500'
                }}
              >
                {t.saveBinBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;

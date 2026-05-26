import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Popup } from 'react-leaflet';
import { Shield, TrendingUp, AlertTriangle, Truck, Download, ChevronLeft, Building2, Globe } from 'lucide-react';
import { translations, getRTLStyles } from '../translations';
import 'leaflet/dist/leaflet.css';

const STATE_CENTER = [17.8000, 79.0000];

export default function HigherAuthorityPortal({ onNavigateHome, lang, onChangeLang, regions, truckAssignments, updateTrucks }) {
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const t = translations[lang];
  const rtlStyles = getRTLStyles(lang);

  const [draftTrucks, setDraftTrucks] = useState({});

  useEffect(() => {
    // Generate derived view data based on shared truckAssignments and local draft
    const generatedRegions = regions.map((r) => {
      const regionName = r.name;
      const trucks = draftTrucks[regionName] ?? truckAssignments[regionName] ?? 5;
      // Calculate a deterministic compliance score based on truck count
      // Base compliance + (trucks * 3), capped at 100
      let compliance = 60 + (trucks * 4);
      if (compliance > 100) compliance = 100;
      if (compliance < 40) compliance = 40;

      return {
        name: regionName,
        displayName: r.displayName.split(' (')[0].replace('Hyderabad - ', ''),
        lat: r.center[0],
        lng: r.center[1],
        compliance: compliance,
        risk: compliance > 90 ? 'Low' : compliance > 75 ? 'Medium' : 'High',
        trucks: trucks
      };
    });

    setSummaryData({
      totalFuelSaved: 12450.5,
      totalCo2Saved: 33616.4,
      totalDistanceAvoided: 41501.8,
      criticalOverflows: generatedRegions.filter(r => r.risk === 'High').length,
      regions: generatedRegions
    });
    setLoading(false);
  }, [regions, truckAssignments, draftTrucks]); // Re-run when drafts or commits change

  const handlePrintAudit = () => {
    window.print();
  };

  const handleTruckUpdate = (regionName, increment) => {
    setDraftTrucks(prev => {
      const current = prev[regionName] ?? truckAssignments[regionName] ?? 5;
      let next = current + increment;
      if (next < 1) next = 1;
      if (next > 50) next = 50;
      return { ...prev, [regionName]: next };
    });
  };

  const commitAssignment = (regionName) => {
    const next = draftTrucks[regionName] ?? truckAssignments[regionName] ?? 5;
    updateTrucks(regionName, next);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <TrendingUp size={48} className="pulse-dot" color="var(--accent-purple)" />
      </div>
    );
  }

  // Use values from translations, fallback if undefined (since we haven't updated all translations yet)
  const authTitle = t.authTitle || "State Executive Dashboard";
  const authSubtitle = t.authSubtitle || "Higher Authority Analytics & Fleet Assignment";

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top left, #f1f5f9 0%, #cbd5e1 100%)', color: 'var(--text-primary)', padding: '20px', fontFamily: "'Inter', sans-serif", ...rtlStyles }}>
      {/* Header */}
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '16px 24px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
          <button onClick={onNavigateHome} style={{ background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={24} style={{ transform: lang === 'ur' ? 'rotate(180deg)' : 'none' }} />
          </button>
          <div style={{
            padding: '10px',
            borderRadius: '12px',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            color: 'var(--accent-purple)'
          }}>
            <Shield size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{authTitle}</h1>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{authSubtitle}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
          {/* Language Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.5)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
            <Globe size={14} color="var(--accent-purple)" />
            <select 
              value={lang} 
              onChange={(e) => onChangeLang(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              <option value="en">English</option>
              <option value="te">తెలుగు</option>
              <option value="hi">हिन्दी</option>
              <option value="ur">اردو</option>
            </select>
          </div>

          <button onClick={handlePrintAudit} className="btn-primary" style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'linear-gradient(135deg, var(--accent-purple), #9d00ff)', boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)'
          }}>
            <Download size={18} />
            Export Audit
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>Statewide Distance Avoided</div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--accent-cyan)' }}>{summaryData.totalDistanceAvoided.toLocaleString()} <span style={{fontSize:'16px', color: 'var(--text-muted)'}}>km</span></div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid var(--accent-orange)' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>Total Diesel Saved</div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--accent-orange)' }}>{summaryData.totalFuelSaved.toLocaleString()} <span style={{fontSize:'16px', color: 'var(--text-muted)'}}>L</span></div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid var(--accent-green)' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>Carbon Offset (CO₂)</div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--accent-green)' }}>{summaryData.totalCo2Saved.toLocaleString()} <span style={{fontSize:'16px', color: 'var(--text-muted)'}}>kg</span></div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid var(--accent-red)' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>Critical Bin Overflows</div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {summaryData.criticalOverflows}
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Map View */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <Building2 size={20} color="var(--accent-purple)" />
            Regional Risk Heatmap
          </h3>
          <div style={{ flex: 1, minHeight: '500px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
            <MapContainer center={STATE_CENTER} zoom={7} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
              {summaryData.regions.map((reg, idx) => (
                <Circle 
                  key={idx} 
                  center={[reg.lat, reg.lng]} 
                  radius={8000} 
                  pathOptions={{ 
                    color: reg.risk === 'High' ? 'var(--accent-red)' : reg.risk === 'Medium' ? 'var(--accent-orange)' : 'var(--accent-green)',
                    fillColor: reg.risk === 'High' ? 'var(--accent-red)' : reg.risk === 'Medium' ? 'var(--accent-orange)' : 'var(--accent-green)',
                    fillOpacity: 0.4
                  }}
                >
                  <Popup>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{reg.name}</div>
                    <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-secondary)' }}>Compliance: <strong style={{ color: reg.compliance > 90 ? 'var(--accent-green)' : reg.compliance > 75 ? 'var(--accent-orange)' : 'var(--accent-red)' }}>{reg.compliance}%</strong></div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active Trucks: <strong>{reg.trucks}</strong></div>
                  </Popup>
                </Circle>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Leaderboard and Truck Assignment */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', maxHeight: '560px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <Truck size={20} color="var(--accent-purple)" />
            Manual Fleet Assignment
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '8px' }}>
            {summaryData.regions.sort((a,b) => b.compliance - a.compliance).map((reg, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '10px',
                padding: '12px', 
                background: 'rgba(255,255,255,0.7)', 
                borderRadius: '8px',
                border: '1px solid var(--border-glass)',
                borderLeft: `4px solid ${reg.risk === 'High' ? 'var(--accent-red)' : reg.risk === 'Medium' ? 'var(--accent-orange)' : 'var(--accent-green)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>{reg.name}</span>
                  <span style={{ color: reg.risk === 'High' ? 'var(--accent-red)' : reg.risk === 'Medium' ? 'var(--accent-orange)' : 'var(--accent-green)', fontWeight: '800', fontSize: '14px' }}>
                    {reg.compliance}%
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', padding: '6px 10px', borderRadius: '6px' }}>
                  {draftTrucks[reg.name] !== undefined && draftTrucks[reg.name] !== (truckAssignments[reg.name] || 5) ? (
                    <button 
                      onClick={() => commitAssignment(reg.name)}
                      style={{ fontSize: '12px', background: 'var(--accent-purple)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 0 8px rgba(168,85,247,0.5)' }}
                    >
                      Confirm
                    </button>
                  ) : (
                    <button 
                      disabled
                      style={{ fontSize: '12px', background: '#cbd5e1', color: '#64748b', border: 'none', padding: '4px 10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'not-allowed' }}
                    >
                      Assigned
                    </button>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      onClick={() => handleTruckUpdate(reg.name, -1)}
                      style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-primary)' }}
                    >-</button>
                    <span style={{ fontWeight: 'bold', fontSize: '14px', width: '20px', textAlign: 'center', color: 'var(--accent-purple)' }}>{reg.trucks}</span>
                    <button 
                      onClick={() => handleTruckUpdate(reg.name, 1)}
                      style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-primary)' }}
                    >+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

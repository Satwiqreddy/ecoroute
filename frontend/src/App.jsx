import React, { useState, useEffect } from 'react';
import AdminDashboard from './components/AdminDashboard';
import DriverApp from './components/DriverApp';
import HigherAuthorityPortal from './components/HigherAuthorityPortal';
import LoginPortal from './components/LoginPortal';
import { Compass, ShieldAlert, Navigation, BarChart3, Truck, Globe, MapPin, Building2 } from 'lucide-react';
import { translations, getRTLStyles } from './translations';

const TELANGANA_REGIONS = [
  { name: 'Miyapur', displayName: 'Hyderabad - Miyapur (మియాపూర్)', center: [17.4968, 78.3614], description: 'Miyapur Municipal Zone' },
  { name: 'Gachibowli', displayName: 'Hyderabad - Gachibowli (గచ్చిబౌలి)', center: [17.4401, 78.3489], description: 'IT Corridor & Financial District' },
  { name: 'Kukatpally', displayName: 'Hyderabad - Kukatpally (కూకట్‌పల్లి)', center: [17.4855, 78.3885], description: 'KPHB & Kukatpally Commercial Hub' },
  { name: 'Secunderabad', displayName: 'Hyderabad - Secunderabad (సికింద్రాబాద్)', center: [17.4399, 78.4983], description: 'Secunderabad Cantonment & Hub' },
  { name: 'JubileeHills', displayName: 'Hyderabad - Jubilee Hills (జూబ్లీహిల్స్)', center: [17.4325, 78.4071], description: 'Premium Residential Zone' },
  { name: 'BanjaraHills', displayName: 'Hyderabad - Banjara Hills (బంజారాహిల్స్)', center: [17.4156, 78.4396], description: 'Commercial & Residential Center' },
  { name: 'LBNagar', displayName: 'Hyderabad - L.B. Nagar (ఎల్.బి. నగర్)', center: [17.3457, 78.5522], description: 'East Hyderabad Hub' },
  { name: 'Charminar', displayName: 'Hyderabad - Charminar (చార్మినార్)', center: [17.3616, 78.4747], description: 'Old City Heritage Zone' },
  { name: 'Khairatabad', displayName: 'Hyderabad - Khairatabad (ఖైరతాబాద్)', center: [17.4116, 78.4593], description: 'Central Business District' },
  { name: 'Serilingampally', displayName: 'Hyderabad - Serilingampally (శేరిలింగంపల్లి)', center: [17.4834, 78.3188], description: 'West Hyderabad IT Zone' },
  { name: 'Malkajgiri', displayName: 'Hyderabad - Malkajgiri (మల్కాజిగిరి)', center: [17.4520, 78.5332], description: 'North-East Residential Hub' },
  { name: 'Quthbullapur', displayName: 'Hyderabad - Quthbullapur (కుత్బుల్లాపూర్)', center: [17.5190, 78.4552], description: 'Industrial & Residential Zone' },
  { name: 'Uppal', displayName: 'Hyderabad - Uppal (ఉప్పల్)', center: [17.3984, 78.5583], description: 'East Industrial Hub' },
  { name: 'Rajendranagar', displayName: 'Hyderabad - Rajendranagar (రాజేంద్రనగర్)', center: [17.3190, 78.4039], description: 'South-West Hub' },
  { name: 'Warangal', displayName: 'Warangal Municipal Corp (వరంగల్)', center: [17.9689, 79.5941], description: 'Tri-City Hanamkonda-Warangal' },
  { name: 'Nizamabad', displayName: 'Nizamabad Municipal Corp (నిజామాబాద్)', center: [18.6725, 78.0986], description: 'North Telangana Core Region' },
  { name: 'Karimnagar', displayName: 'Karimnagar Municipal Corp (కరీంనగర్)', center: [18.4386, 79.1288], description: 'North-East Telangana Hub' },
  { name: 'Khammam', displayName: 'Khammam Municipal Corp (ఖమ్మం)', center: [17.2473, 80.1514], description: 'East Telangana Municipal Region' },
  { name: 'Mahbubnagar', displayName: 'Mahbubnagar Municipal Corp (మహబూబ్‌నగర్)', center: [16.7367, 77.9889], description: 'South Telangana Gateway Zone' },
  { name: 'Nalgonda', displayName: 'Nalgonda Municipal Corp (నల్గొండ)', center: [17.0500, 79.2667], description: 'Central-East Municipal Zone' }
];

function App() {
  const [currentRoute, setCurrentRoute] = useState(window.location.hash || '#/');
  const [lang, setLang] = useState(localStorage.getItem('binflow_lang') || 'en');
  const [selectedRegion, setSelectedRegion] = useState(localStorage.getItem('binflow_region') || null);
  const [regionModalTarget, setRegionModalTarget] = useState(null); // 'admin' or 'driver' or null

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(window.location.hash || '#/');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (hash) => {
    window.location.hash = hash;
  };

  const changeLang = (newLang) => {
    localStorage.setItem('binflow_lang', newLang);
    setLang(newLang);
  };

  const changeRegion = (newRegion) => {
    localStorage.setItem('binflow_region', newRegion);
    setSelectedRegion(newRegion);
  };

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Global shared state for truck allocations per region (No mock data)
  const [truckAssignments, setTruckAssignments] = useState(() => {
    try {
      const saved = localStorage.getItem('binflow_trucks');
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {
      console.warn('Failed to parse truck assignments cache', e);
    }
    // Default: 5 trucks per municipality if unassigned
    return TELANGANA_REGIONS.reduce((acc, r) => {
      acc[r.name] = 5;
      return acc;
    }, {});
  });

  const updateTrucks = (regionName, newCount) => {
    setTruckAssignments(prev => {
      const updated = { ...prev, [regionName]: newCount };
      localStorage.setItem('binflow_trucks', JSON.stringify(updated));
      return updated;
    });
  };

  const secureRoutes = ['#/admin', '#/driver', '#/authority'];
  if (secureRoutes.includes(currentRoute) && !isAuthenticated) {
    const targetRouteName = currentRoute.replace('#/', '');
    return (
      <LoginPortal 
        onLogin={() => setIsAuthenticated(true)}
        lang={lang}
        targetRoute={targetRouteName}
      />
    );
  }

  if (currentRoute === '#/admin') {
    return (
      <AdminDashboard 
        onNavigateHome={() => { navigateTo('#/'); setIsAuthenticated(false); }} 
        lang={lang} 
        onChangeLang={changeLang} 
        selectedRegion={selectedRegion || 'Miyapur'} 
        onChangeRegion={changeRegion} 
        truckAssignments={truckAssignments}
        regions={TELANGANA_REGIONS}
      />
    );
  }

  if (currentRoute === '#/driver') {
    return (
      <DriverApp 
        onNavigateHome={() => { navigateTo('#/'); setIsAuthenticated(false); }} 
        lang={lang} 
        onChangeLang={changeLang} 
        selectedRegion={selectedRegion || 'Miyapur'} 
        onChangeRegion={changeRegion}
        truckAssignments={truckAssignments}
        regions={TELANGANA_REGIONS}
      />
    );
  }

  if (currentRoute === '#/authority') {
    return (
      <HigherAuthorityPortal 
        onNavigateHome={() => { navigateTo('#/'); setIsAuthenticated(false); }} 
        lang={lang} 
        onChangeLang={changeLang} 
        regions={TELANGANA_REGIONS}
        truckAssignments={truckAssignments}
        updateTrucks={updateTrucks}
      />
    );
  }

  const handleNavigateClick = (target) => {
    if (!selectedRegion) {
      setRegionModalTarget(target);
    } else {
      navigateTo(target === 'admin' ? '#/admin' : '#/driver');
    }
  };

  const t = translations[lang];
  const rtlStyles = getRTLStyles(lang);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px 20px',
      background: 'radial-gradient(circle at center, #ffffff 0%, #f1f5f9 100%)',
      position: 'relative',
      overflow: 'hidden',
      ...rtlStyles
    }}>
      {/* Floating Region and Language Selector in Header */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: lang === 'ur' ? 'auto' : '20px',
        left: lang === 'ur' ? '20px' : 'auto',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        {selectedRegion && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: '#fff',
            border: '1px solid var(--border-glass)',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            fontSize: '13px',
            fontWeight: '600',
            color: '#334155'
          }}>
            <MapPin size={15} color="var(--accent-cyan)" />
            <span>Region: {TELANGANA_REGIONS.find(r => r.name === selectedRegion)?.displayName.split(' (')[0] || selectedRegion}</span>
            <button 
              onClick={() => setRegionModalTarget('admin')}
              style={{
                background: 'none',
                border: 'none',
                color: '#1a73e8',
                cursor: 'pointer',
                padding: 0,
                marginLeft: '6px',
                textDecoration: 'underline',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              Change
            </button>
          </div>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: '#fff',
          border: '1px solid var(--border-glass)',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
        }}>
          <Globe size={16} color="var(--text-secondary)" />
          <select 
            value={lang} 
            onChange={(e) => changeLang(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              backgroundColor: 'transparent',
              cursor: 'pointer'
            }}
          >
            <option value="en">English (EN)</option>
            <option value="te">తెలుగు (TE)</option>
            <option value="hi">हिन्दी (HI)</option>
            <option value="ur">اردو (UR)</option>
          </select>
        </div>
      </div>

      {/* Dynamic Background Glowing Blobs */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '40vw',
        height: '40vw',
        borderRadius: '50%',
        background: 'rgba(14, 165, 233, 0.03)',
        filter: 'blur(120px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-10%',
        width: '40vw',
        height: '40vw',
        borderRadius: '50%',
        background: 'rgba(139, 92, 246, 0.03)',
        filter: 'blur(120px)',
        pointerEvents: 'none'
      }} />

      {/* Title Header */}
      <header style={{ textAlign: 'center', marginBottom: '60px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
          <Truck size={42} color="var(--accent-cyan)" style={{ filter: 'drop-shadow(var(--shadow-neon-cyan))' }} />
          <h1 style={{
            fontSize: '56px',
            fontWeight: '800',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '-0.03em',
            background: 'linear-gradient(to right, var(--accent-cyan), var(--accent-purple))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {t.title}
          </h1>
        </div>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '18px',
          maxWidth: '600px',
          margin: '0 auto',
          fontWeight: '400'
        }}>
          {t.subtitle}
        </p>
      </header>

      {/* Main Grid Options */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '30px',
        width: '100%',
        maxWidth: '960px',
        zIndex: 10
      }}>
        {/* Admin Dashboard Entry */}
        <div className="glass-panel border-glow-cyan" style={{
          padding: '40px 30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '20px',
          cursor: 'pointer',
          backgroundColor: '#fff'
        }} onClick={() => handleNavigateClick('admin')}>
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'rgba(14, 165, 233, 0.1)',
            color: 'var(--accent-cyan)'
          }}>
            <BarChart3 size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--text-primary)' }}>{t.adminTitle}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6' }}>
              {t.adminDesc}
            </p>
          </div>
          <button className="btn-primary" style={{ width: '100%', marginTop: 'auto' }}>
            {t.adminBtn}
          </button>
        </div>

        {/* Driver App Entry */}
        <div className="glass-panel border-glow-purple" style={{
          padding: '40px 30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '20px',
          cursor: 'pointer',
          backgroundColor: '#fff'
        }} onClick={() => handleNavigateClick('driver')}>
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            color: 'var(--accent-purple)'
          }}>
            <Navigation size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--text-primary)' }}>{t.driverTitle}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6' }}>
              {t.driverDesc}
            </p>
          </div>
          <button className="btn-primary" style={{
            width: '100%',
            marginTop: 'auto',
            background: 'linear-gradient(135deg, var(--accent-purple), #7c3aed)',
            boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)'
          }}>
            {t.driverBtn}
          </button>
        </div>

        {/* Higher Authority Entry */}
        <div className="glass-panel" style={{
          padding: '40px 30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '20px',
          cursor: 'pointer',
          backgroundColor: '#fff',
          borderTop: '4px solid #10b981'
        }} onClick={() => navigateTo('#/authority')}>
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: '#10b981'
          }}>
            <Building2 size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--text-primary)' }}>Higher Authority Portal</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6' }}>
              State-wide dashboard for municipal commissioners. Monitor compliance, forecast overflows, and print certified ROI audits.
            </p>
          </div>
          <button className="btn-primary" style={{
            width: '100%',
            marginTop: 'auto',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
          }}>
            Enter Executive Portal
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        marginTop: '60px',
        color: 'var(--text-muted)',
        fontSize: '13px',
        textAlign: 'center',
        zIndex: 10
      }}>
        {t.footer}
      </footer>

      {/* Telangana Region Selection Modal */}
      {regionModalTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.25)',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            textAlign: lang === 'ur' ? 'right' : 'left',
            direction: lang === 'ur' ? 'rtl' : 'ltr'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
              <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                {t.selectRegionTitle}
              </h3>
              <button 
                onClick={() => setRegionModalTarget(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  color: '#94a3b8'
                }}
              >
                ✕
              </button>
            </div>
            
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: '1.5' }}>
              {t.selectRegionDesc}
            </p>

            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              maxHeight: '360px',
              overflowY: 'auto',
              paddingRight: '6px'
            }}>
              {TELANGANA_REGIONS.map(reg => (
                <div
                  key={reg.name}
                  onClick={() => {
                    changeRegion(reg.name);
                    setRegionModalTarget(null);
                    navigateTo(regionModalTarget === 'admin' ? '#/admin' : '#/driver');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '2px solid #f1f5f9',
                    cursor: 'pointer',
                    backgroundColor: '#f8fafc',
                    flexDirection: lang === 'ur' ? 'row-reverse' : 'row'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = regionModalTarget === 'admin' ? 'var(--accent-cyan)' : 'var(--accent-purple)';
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#f1f5f9';
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                >
                  <div style={{
                    padding: '10px',
                    borderRadius: '10px',
                    backgroundColor: regionModalTarget === 'admin' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                    color: regionModalTarget === 'admin' ? 'var(--accent-cyan)' : 'var(--accent-purple)'
                  }}>
                    <MapPin size={22} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>{reg.displayName}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{reg.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

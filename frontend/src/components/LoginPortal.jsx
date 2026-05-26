import React, { useState } from 'react';
import { Shield, Lock, User, ArrowRight, Truck, BarChart3, Building2 } from 'lucide-react';
import { translations, getRTLStyles } from '../translations';

export default function LoginPortal({ onLogin, lang, targetRoute }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rtlStyles = getRTLStyles(lang);
  const t = translations[lang];

  // Determine what role the user is trying to log into based on the target route
  const getRoleInfo = () => {
    switch (targetRoute) {
      case 'admin':
        return { icon: <BarChart3 size={24} color="var(--accent-cyan)" />, title: t.adminTitle || 'Admin Dashboard', color: 'var(--accent-cyan)', bg: 'rgba(14, 165, 233, 0.1)' };
      case 'authority':
        return { icon: <Building2 size={24} color="#10b981" />, title: 'Executive Portal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
      case 'driver':
      default:
        return { icon: <Truck size={24} color="var(--accent-purple)" />, title: t.driverTitle || 'Driver Terminal', color: 'var(--accent-purple)', bg: 'rgba(168, 85, 247, 0.1)' };
    }
  };

  const roleInfo = getRoleInfo();

  const handleLogin = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    // Simulate network delay
    setTimeout(() => {
      setLoading(false);
      onLogin(targetRoute); // Successfully log in
    }, 1200);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #ffffff 0%, #f1f5f9 100%)',
      padding: '20px',
      ...rtlStyles
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px 30px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderTop: `4px solid ${roleInfo.color}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: roleInfo.bg }}>
            {roleInfo.icon}
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              {roleInfo.title}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Authentication Gateway
            </p>
          </div>
        </div>

        {error && (
          <div style={{ width: '100%', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: lang === 'ur' ? 'right' : 'left' }}>
              Email Address / ID
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: lang === 'ur' ? 'auto' : '12px', right: lang === 'ur' ? '12px' : 'auto', color: '#94a3b8' }}>
                <User size={18} />
              </div>
              <input
                type="text"
                placeholder="admin@binflow.gov"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 40px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)',
                  backgroundColor: '#f8fafc',
                  outline: 'none',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  textAlign: lang === 'ur' ? 'right' : 'left'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: lang === 'ur' ? 'right' : 'left' }}>
              Secure Password
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: lang === 'ur' ? 'auto' : '12px', right: lang === 'ur' ? '12px' : 'auto', color: '#94a3b8' }}>
                <Lock size={18} />
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 40px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)',
                  backgroundColor: '#f8fafc',
                  outline: 'none',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  textAlign: lang === 'ur' ? 'right' : 'left'
                }}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary" 
            style={{ 
              marginTop: '10px', 
              width: '100%', 
              backgroundColor: roleInfo.color,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {loading ? (
              <Shield className="pulse-dot" size={20} color="#fff" />
            ) : (
              <>
                Login Securely
                <ArrowRight size={18} style={{ transform: lang === 'ur' ? 'rotate(180deg)' : 'none' }} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

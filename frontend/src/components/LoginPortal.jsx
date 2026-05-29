import React, { useState } from 'react';
import { Shield, Lock, User, ArrowRight, Truck, BarChart3, Building2, Mail } from 'lucide-react';
import { translations, getRTLStyles } from '../translations';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function LoginPortal({ onLogin, lang, targetRoute }) {
  const [mode, setMode] = useState('login'); // 'login', 'signup', 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const rtlStyles = getRTLStyles(lang);
  const t = translations[lang];

  const getRoleInfo = () => {
    switch (targetRoute) {
      case 'admin':
        return { icon: <BarChart3 size={24} color="var(--accent-cyan)" />, title: t.adminTitle || 'Admin Dashboard', color: 'var(--accent-cyan)', bg: 'rgba(14, 165, 233, 0.1)', roleKey: 'Admin' };
      case 'authority':
        return { icon: <Building2 size={24} color="#10b981" />, title: 'Executive Portal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', roleKey: 'Authority' };
      case 'driver':
      default:
        return { icon: <Truck size={24} color="var(--accent-purple)" />, title: t.driverTitle || 'Driver Terminal', color: 'var(--accent-purple)', bg: 'rgba(168, 85, 247, 0.1)', roleKey: 'Driver' };
    }
  };

  const roleInfo = getRoleInfo();

  const handleAction = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    if (mode !== 'forgot' && !password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Account created successfully! You can now log in.');
        setMode('login');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMessage('Password reset instructions have been sent to your email.');
        setMode('login');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Proceed into the application
        onLogin(targetRoute);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
              {mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : roleInfo.title}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              {mode === 'signup' ? 'Join the platform' : mode === 'forgot' ? 'Recover your access' : 'Authentication Gateway'}
            </p>
          </div>
        </div>

        {error && (
          <div style={{ width: '100%', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
          </div>
        )}
        
        {message && (
          <div style={{ width: '100%', padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleAction} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: lang === 'ur' ? 'right' : 'left' }}>
              Email Address / ID
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: lang === 'ur' ? 'auto' : '12px', right: lang === 'ur' ? '12px' : 'auto', color: '#94a3b8' }}>
                <Mail size={18} />
              </div>
              <input
                type="email"
                placeholder="email@binflow.gov"
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

          {mode !== 'forgot' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexDirection: lang === 'ur' ? 'row-reverse' : 'row' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', margin: 0 }}>
                  Secure Password
                </label>
                {mode === 'login' && (
                  <span 
                    onClick={() => setMode('forgot')}
                    style={{ fontSize: '12px', color: roleInfo.color, cursor: 'pointer', fontWeight: '600' }}
                  >
                    Forgot Password?
                  </span>
                )}
              </div>
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
          )}

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
                {mode === 'login' ? 'Login Securely' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                <ArrowRight size={18} style={{ transform: lang === 'ur' ? 'rotate(180deg)' : 'none' }} />
              </>
            )}
          </button>
        </form>
        
        <div style={{ marginTop: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <span onClick={() => setMode('signup')} style={{ color: roleInfo.color, cursor: 'pointer', fontWeight: 'bold' }}>
                Create one
              </span>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <span onClick={() => setMode('login')} style={{ color: roleInfo.color, cursor: 'pointer', fontWeight: 'bold' }}>
                Log in
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

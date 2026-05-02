import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import './App.css'; // Pour lier ton CSS

/* ─────────────────────────────────────────
    CONSTANTS
───────────────────────────────────────── */
const LOGO_URL = '../logo.png'; // the uploaded logo — served via same directory

const API_BASE_URL = 'http://localhost:4000';

// Palette helpers
const P = {
  primary:   '#1c5588',
  secondary: '#00bdc8',
  accent:    '#7acfb0',
  light:     '#fbce9e',
  dark:      '#f88f52',
};

/* ─────────────────────────────────────────
   SERVICE STUBS
   Replace function bodies with real API / BLE calls
───────────────────────────────────────── */
const api = {
  login: async (username, password) => {
    // Correction de l'URL : ajout de /auth/
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Identifiants incorrects');
    return res.json();
  },

  getResidents: async (token) => {
    // Correction : ajout du préfixe /api/
    const res = await fetch(`${API_BASE_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Erreur lors de la récupération des résidents');
    return await res.json();
  },

  getHydrationToday: async (userId, token) => {
    const today = new Date().toISOString().split('T')[0];
    // Correction : ajout du préfixe /api/
    const res = await fetch(`${API_BASE_URL}/api/users/${userId}/consumption?startDate=${today}&endDate=${today}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.totalVolume || 0;
  },

  getAlerts: async (token) => {
    // Correction : ajout du préfixe /api/
    const res = await fetch(`${API_BASE_URL}/api/alerts`, { 
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return await res.json();
  },

  getStaff: async (token) => {
    // Correction : ajout du préfixe /api/
    const res = await fetch(`${API_BASE_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return res.json();
  },

  inviteNurse: async (email, name) => {
    await new Promise(r => setTimeout(r, 700));
  },
  
  resolveAlert: async (alertId, token) => {
    const res = await fetch(`${API_BASE_URL}/api/alerts/${alertId}/resolve`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Erreur résolution alerte');
    return res.json();
  },
};

/**
 * ESP32 / BLE stub.
 * Replace with real BLE / WebSocket logic.
 */
async function assignEsp(residentId, espId) {
  // TODO: PATCH /api/residents/:residentId  body: { esp32Id: espId }
  // Backend updates the DB and manages the actual WiFi connection to the ESP
}

async function connectEsp(residentId) {
  // TODO: POST /api/residents/:residentId/connect
  // Backend finds the resident's esp32Id in DB, then initiates WiFi connection to that ESP
}

async function disconnectEsp(residentId) {
  // TODO: POST /api/residents/:residentId/disconnect
}

/* ─────────────────────────────────────────
   AUTH CONTEXT
───────────────────────────────────────── */
const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(null);

  const login = async (username, password) => {
    const res = await api.login(username, password);

    if (res.user.role !== 'STAFF' && res.user.role !== 'ADMIN') {
      throw new Error("Accès refusé. Ce tableau de bord est réservé au personnel de l'établissement.");
    }
  
    setUser(res.user);
    setToken(res.token);
  };

  const register = async (orgName, adminName, email, password) => {
    const res = await api.register(orgName, adminName, email, password);
    setUser(res.user);
    setToken(res.token);
  };

  const logout = () => { setUser(null); setToken(null); };

  return (
    <AuthCtx.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

/* ─────────────────────────────────────────
   ROUTER (minimal)
───────────────────────────────────────── */
const RouteCtx = createContext(null);
const useRoute = () => useContext(RouteCtx);

export function Router({ children }) {
  const [page, setPage] = useState('dashboard');
  const [params, setParams] = useState({});
  const navigate = (p, prms={}) => { setPage(p); setParams(prms); };
  return (
    <RouteCtx.Provider value={{ page, params, navigate }}>
      {children}
    </RouteCtx.Provider>
  );
}

/* ─────────────────────────────────────────
   UTILITY COMPONENTS
───────────────────────────────────────── */
function Spinner({ size=20, color=P.secondary }) {
  return (
    <span style={{ display:'inline-block', width:size, height:size,
      border:`2px solid ${color}33`, borderTopColor:color,
      borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
  );
}

function Btn({ children, variant='primary', onClick, disabled, style, loading }) {
  const styles = {
    primary:   { background: P.primary,   color:'#fff' },
    secondary: { background: P.secondary, color:'#fff' },
    ghost:     { background: 'transparent', color: P.primary, border:`1.5px solid ${P.primary}` },
    danger:    { background: '#e84040',   color:'#fff' },
    accent:    { background: P.accent,    color:'#fff' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...styles[variant],
        padding: '10px 20px',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 8,
        opacity: (disabled || loading) ? 0.65 : 1,
        ...style,
      }}
    >
      {loading && <Spinner size={14} color="#fff" />}
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────
   STATUS DOT
───────────────────────────────────────── */
function StatusDot({ status, size=12 }) {
  const colors = { ok:'#34c777', warning:'#f88f52', danger:'#e84040', disconnected:'#aab8c8' };
  return (
    <span style={{
      width: size, height: size, borderRadius:'50%',
      background: colors[status] || colors.disconnected,
      display:'inline-block', flexShrink:0,
      boxShadow: status === 'danger' ? `0 0 0 3px #e8404033` : 'none',
    }} />
  );
}

/* ─────────────────────────────────────────
   HYDRATION CIRCLE
───────────────────────────────────────── */
function HydrationCircle({ current, goal, size=72 }) {
  const pct   = Math.min(1, current / (goal || 1));
  const r     = (size/2) - 6;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * pct;
  const color = pct >= 0.8 ? P.accent : pct >= 0.5 ? P.secondary : P.dark;
  const label = current >= 1000 ? `${(current/1000).toFixed(1)}L` : `${current}mL`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r}
        fill="none" stroke="#dce8f5" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition:'stroke-dasharray 0.6s ease' }}
      />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fontSize={size < 60 ? 9 : 11} fontWeight="600" fill={P.primary}
        fontFamily="DM Sans, sans-serif"
      >{label}</text>
    </svg>
  );
}

/* ─────────────────────────────────────────
   LOGIN PAGE
───────────────────────────────────────── */
function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode]     = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm] = useState({ 
    username: '',
    password: '', 
    orgName: '', 
    adminName: '',
    email: '' 
  });

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}));

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.username, form.password);
      } else {
        if (!form.orgName || !form.adminName) throw new Error('Tous les champs sont requis');
        await register(form.orgName, form.adminName, form.username, form.password);
      }
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const handleKey = e => { if (e.key === 'Enter') submit(); };

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:`linear-gradient(135deg, ${P.primary} 0%, #0d3258 50%, ${P.secondary}22 100%)`,
      padding: 16,
    }}>
      {/* Decorative blobs */}
      <div style={{ position:'fixed', top:-80, right:-80, width:300, height:300,
        borderRadius:'50%', background:`${P.secondary}22`, pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:-60, left:-60, width:200, height:200,
        borderRadius:'50%', background:`${P.light}18`, pointerEvents:'none' }} />

      <div className="pop-in" style={{
        background:'#fff', borderRadius:20, padding:40,
        width:'100%', maxWidth:420,
        boxShadow:'0 24px 80px rgba(0,0,0,0.22)',
      }}>
        {/* Logo + title */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src="logo.png" alt="HydroCare"
            style={{ width:80, height:80, objectFit:'contain', marginBottom:12 }}
            onError={e => { e.target.style.display='none'; }}
          />
          <h1 style={{ fontSize:24, fontWeight:600, color:P.primary }}>HydroCare</h1>
          <p style={{ color:'#5a7494', fontSize:13, marginTop:4 }}>Suivi d'hydratation en établissement</p>
        </div>

        {/* Tab switch */}
        <div style={{ display:'flex', background:'#f4f7fb', borderRadius:10, padding:4, marginBottom:28 }}>
          {['login','register'].map(m => (
            <button key={m}
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex:1, padding:'8px 0', borderRadius:8, fontSize:13, fontWeight:600,
                background: mode===m ? '#fff' : 'transparent',
                color: mode===m ? P.primary : '#5a7494',
                boxShadow: mode===m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition:'all 0.2s',
              }}>
              {m === 'login' ? 'Connexion' : 'Créer un établissement'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {mode === 'register' && <>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Établissement</label>
              <input placeholder="Résidence Les Oliviers" value={form.orgName} onChange={set('orgName')} onKeyDown={handleKey} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Votre nom</label>
              <input placeholder="Dr. Martin" value={form.adminName} onChange={set('adminName')} onKeyDown={handleKey} />
            </div>
          </>}

          <div>
          <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>
            Identifiant (Username)
          </label>
          <input 
            type="text" 
            placeholder="Ex: jean_nurse" 
            value={form.username} // Corrigé
            onChange={set('username')} // Corrigé
            onKeyDown={handleKey} 
          />
        </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Mot de passe</label>
            <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} onKeyDown={handleKey} />
          </div>

          {error && <p style={{ color:'#e84040', fontSize:13, textAlign:'center' }}>{error}</p>}

          <Btn variant="primary" onClick={submit} loading={loading} style={{ width:'100%', justifyContent:'center', marginTop:4 }}>
            {mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </Btn>
        </div>

        {mode === 'login' && (
          <p style={{ textAlign:'center', marginTop:16, fontSize:12, color:'#aab8c8' }}>
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   RESIDENT DETAIL MODAL
───────────────────────────────────────── */
function ResidentModal({ resident, hydration, alerts, onClose }) {
  const [espInput, setEspInput] = useState(resident.esp32Id ? String(resident.esp32Id) : '');
  const [espStatus, setEspStatus] = useState(resident.esp32Id ? 'disconnected' : 'none');
  const [saving, setSaving]       = useState(false);
  const cleanupRef = useRef(null);

  const residentAlerts = alerts.filter(a => a.userId === resident.id && !a.isResolved);
  const pct = Math.round(Math.min(100, (hydration / resident.daily_goal) * 100));

  const handleConnect = () => {
    if (!espInput.trim()) return;
    setEspStatus('connecting');
    // Cleanup previous connection
    if (cleanupRef.current) cleanupRef.current();
      + connectEsp(resident.id);
      + setEspStatus('connected');
  };

  const handleSaveEsp = async () => {
    setSaving(true);
    + await assignEsp(resident.id, espInput.trim());
    setSaving(false);
  };

  useEffect(() => () => { if (cleanupRef.current) cleanupRef.current(); }, []);

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ padding:0 }}>
        {/* Header */}
        <div style={{
          background:`linear-gradient(135deg, ${P.primary}, ${P.secondary})`,
          borderRadius:'12px 12px 0 0', padding:'24px 24px 20px',
          color:'#fff', position:'relative',
        }}>
          <button onClick={onClose} style={{
            position:'absolute', top:16, right:16,
            background:'rgba(255,255,255,0.2)', border:'none', color:'#fff',
            width:28, height:28, borderRadius:'50%', fontSize:16,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>×</button>

          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{
              width:56, height:56, borderRadius:'50%',
              background:'rgba(255,255,255,0.2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:22, fontWeight:700,
            }}>
              {resident.name[0]}{resident.surname[0]}
            </div>
            <div>
              <h2 style={{ fontSize:18, fontWeight:600 }}>{resident.name} {resident.surname}</h2>
              <p style={{ opacity:0.8, fontSize:13 }}>Chambre {resident.chambre}</p>
            </div>
            <div style={{ marginLeft:'auto' }}>
              <HydrationCircle current={hydration} goal={resident.daily_goal} size={64} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:20 }}>
          {/* Info grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {[
              ['Objectif', `${resident.daily_goal} mL`],
              ['Consommé aujourd\'hui', `${hydration} mL (${pct}%)`],
              ['Âge', resident.age ? `${resident.age} ans` : '—'],
              ['Poids', resident.weight ? `${resident.weight} kg` : '—'],
              ['Sexe', resident.sex === 'M' ? 'Homme' : 'Femme'],
              ['Condition', resident.condition ?? '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ background:'#f4f7fb', borderRadius:8, padding:'10px 14px' }}>
                <p style={{ fontSize:11, color:'#5a7494', marginBottom:2 }}>{label}</p>
                <p style={{ fontSize:13, fontWeight:600, color:P.primary }}>{val}</p>
              </div>
            ))}
          </div>

          {/* Alerts */}
          {residentAlerts.length > 0 && (
            <div>
              <h3 style={{ fontSize:13, fontWeight:600, color:'#5a7494', marginBottom:10 }}>Alertes actives</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {residentAlerts.map(a => (
                  <div key={a.id} style={{
                    background:'#fde8e8', borderRadius:8, padding:'10px 14px',
                    borderLeft:`3px solid #e84040`,
                  }}>
                    <p style={{ fontSize:13, color:'#b52a2a' }}>{a.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ESP32 section */}
          <div style={{ borderTop:`1px solid #dce8f5`, paddingTop:20 }}>
            <h3 style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'#5a7494' }}>
              Capteur ESP32
            </h3>

            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <StatusDot status={
                espStatus === 'connected' ? 'ok' :
                espStatus === 'error' ? 'danger' : 'disconnected'
              } size={10} />
              <span style={{ fontSize:13, color:'#5a7494' }}>
                {espStatus === 'connected'   ? 'Connecté' :
                 espStatus === 'connecting'  ? 'Connexion en cours…' :
                 espStatus === 'error'       ? 'Erreur de connexion' :
                 espStatus === 'none'        ? 'Aucun ESP assigné' : 'Déconnecté'}
              </span>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <input
                placeholder="ID de l'ESP (ex: ESP-001)"
                value={espInput}
                onChange={e => setEspInput(e.target.value)}
                style={{ flex:1, fontSize:13 }}
              />
              <Btn variant="ghost" onClick={handleSaveEsp} loading={saving} style={{ whiteSpace:'nowrap', padding:'10px 14px' }}>
                Sauvegarder
              </Btn>
            </div>

            <Btn variant="secondary" onClick={handleConnect}
              disabled={!espInput.trim() || espStatus === 'connecting'}
              style={{ marginTop:10, width:'100%', justifyContent:'center' }}>
              {espStatus === 'connecting' ? 'Connexion…' :
               espStatus === 'connected'  ? 'Reconnecter' : 'Connecter'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   RESIDENT CARD
───────────────────────────────────────── */
function ResidentCard({ resident, hydration, alerts, onClick }) {
  const hasAlert   = alerts.some(a => a.userId === resident.id && !a.isResolved && a.severity === 'RED');
  const hasWarning  = alerts.some(a => a.userId === resident.id && !a.isResolved);
  const isConnected = !!resident.esp32Id;

  const dotStatus = !isConnected ? 'disconnected' : hasAlert ? 'danger' : hasWarning ? 'warning' : 'ok';

  return (
    <div onClick={onClick}
      style={{
        background:'#fff', borderRadius:14,
        border:`1.5px solid ${hasAlert ? '#f8888833' : '#dce8f5'}`,
        padding:16, cursor:'pointer',
        transition:'all 0.2s',
        boxShadow: hasAlert ? '0 4px 16px rgba(232,64,64,0.1)' : '0 2px 8px rgba(28,85,136,0.06)',
        display:'flex', flexDirection:'column', alignItems:'center', gap:10,
        position:'relative',
      }}
      onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform='none'}
    >
      {/* Status dot */}
      <div style={{ position:'absolute', top:12, right:12 }}>
        <StatusDot status={dotStatus} size={10} />
      </div>

      {/* Avatar */}
      <div style={{
        width:48, height:48, borderRadius:'50%',
        background:`linear-gradient(135deg, ${P.primary}22, ${P.secondary}44)`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:16, fontWeight:700, color:P.primary, flexShrink:0,
      }}>
        {resident.name[0]}{resident.surname[0]}
      </div>

      {/* Hydration circle */}
      <HydrationCircle current={hydration} goal={resident.daily_goal} size={70} />

      {/* Name */}
      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:13, fontWeight:600, color:P.primary, lineHeight:1.2 }}>
          {resident.name}
        </p>
        <p style={{ fontSize:11, color:'#5a7494' }}>{resident.surname}</p>
         <p style={{ fontSize:11, color:'#aab8c8', marginTop:2 }}>
      +     {resident.chambre ? `Ch. ${resident.chambre}` : ''}
      + </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   NOTIFICATIONS PANEL
───────────────────────────────────────── */
function NotifPanel({ alerts, residents, onResolve }) {
  const timeAgo = iso => {
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 60) return `Il y a ${mins} min`;
    return `Il y a ${Math.round(mins/60)} h`;
  };

  const sevColor  = { RED:'#fde8e8', YELLOW:'#fef0e2' };
  const sevBorder = { RED:'#e84040', YELLOW:'#f88f52' };

  return (
    <div style={{
      background:'#fff', borderRadius:14,
      border:'1.5px solid #dce8f5',
      display:'flex', flexDirection:'column', height:'100%',
      overflow:'hidden',
    }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #dce8f5', flexShrink:0 }}>
        <h2 style={{ fontSize:14, fontWeight:600, color:P.primary }}>Notifications</h2>
        {alerts.filter(a=>!a.isResolved).length > 0 && (
          <span style={{
            background:P.dark, color:'#fff',
            fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999, marginLeft:8,
          }}>
            {alerts.filter(a=>!a.isResolved).length}
          </span>
        )}
      </div>
      <div style={{ overflowY:'auto', flex:1, padding:12, display:'flex', flexDirection:'column', gap:8 }}>
        {alerts.filter(a=>!a.isResolved).length === 0 && (
          <p style={{ textAlign:'center', color:'#aab8c8', fontSize:13, padding:24 }}>
            Aucune alerte active 🎉
          </p>
        )}
        {alerts.filter(a=>!a.isResolved).map(alert => {
          const res = residents.find(r => r.id === alert.userId);
          return (
            <div key={alert.id} style={{
              background: sevColor[alert.severity] || '#f4f7fb',
              borderLeft: `3px solid ${sevBorder[alert.severity] || '#aab8c8'}`,
              borderRadius:'0 8px 8px 0', padding:'10px 12px',
            }}>
              {res && (
                <p style={{ fontSize:11, fontWeight:600, color:P.primary, marginBottom:3 }}>
                  {res.name} {res.surname} · Ch.{res.chambre}
                </p>
              )}
              <p style={{ fontSize:12, color:'#1a2a3a', marginBottom:4 }}>{alert.message}</p>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'#aab8c8' }}>{timeAgo(alert.created_at)}</span>
                <button onClick={() => onResolve(alert.id)} style={{
                  background:'transparent', fontSize:11, color:'#5a7494',
                  textDecoration:'underline', cursor:'pointer',
                }}>
                  Résoudre
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   NAVBAR
───────────────────────────────────────── */
function Navbar({ alertCount }) {
  const { user, logout } = useAuth();
  const { navigate }     = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav style={{
      background:'#fff', borderBottom:'1px solid #dce8f5',
      padding:'0 24px', height:60,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      position:'sticky', top:0, zIndex:100,
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <img src="logo.png" alt="" style={{ width:32, height:32, objectFit:'contain' }}
          onError={e => { e.target.style.display='none'; }} />
        <span style={{ fontWeight:700, fontSize:16, color:P.primary }}>HydroCare</span>
        <span style={{ fontSize:12, color:'#aab8c8', marginLeft:4 }}>{user?.organization}</span>
      </div>

      {/* Right side */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        {alertCount > 0 && (
          <span style={{
            background:P.dark, color:'#fff', borderRadius:999,
            fontSize:11, fontWeight:700, padding:'3px 9px',
          }}>
            {alertCount} alerte{alertCount>1?'s':''}
          </span>
        )}

        <div style={{ position:'relative' }}>
          <button onClick={() => setMenuOpen(v => !v)} style={{
            display:'flex', alignItems:'center', gap:8,
            background:'#f4f7fb', border:'1.5px solid #dce8f5',
            borderRadius:999, padding:'6px 14px 6px 8px',
            fontSize:13, fontWeight:600, color:P.primary,
          }}>
            <div style={{
              width:28, height:28, borderRadius:'50%',
              background:`linear-gradient(135deg,${P.primary},${P.secondary})`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, fontWeight:700, color:'#fff',
            }}>
              {user?.name?.split(' ').map(w=>w[0]).join('').slice(0,2)}
            </div>
            {user?.name}
          </button>
          {menuOpen && (
            <div style={{
              position:'absolute', right:0, top:'calc(100% + 8px)',
              background:'#fff', borderRadius:10, boxShadow:'0 8px 32px rgba(0,0,0,0.12)',
              border:'1px solid #dce8f5', minWidth:180, overflow:'hidden', zIndex:200,
              animation:'fadeIn 0.15s ease',
            }}>
              <button onClick={() => { navigate('profile'); setMenuOpen(false); }}
                style={{ width:'100%', textAlign:'left', padding:'12px 16px', fontSize:13,
                  color:P.primary, background:'transparent', borderBottom:'1px solid #dce8f5' }}>
                Mon profil
              </button>
              {user?.role === 'admin' && (
                <button onClick={() => { navigate('admin'); setMenuOpen(false); }}
                  style={{ width:'100%', textAlign:'left', padding:'12px 16px', fontSize:13,
                    color:P.primary, background:'transparent', borderBottom:'1px solid #dce8f5' }}>
                  Gestion de l'établissement
                </button>
              )}
              <button onClick={() => { logout(); setMenuOpen(false); }}
                style={{ width:'100%', textAlign:'left', padding:'12px 16px', fontSize:13,
                  color:'#e84040', background:'transparent' }}>
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────── */
function Dashboard() {
  const { token } = useAuth();
  const [residents, setResidents]   = useState([]);
  const [hydration, setHydration]   = useState({});
  const [alerts, setAlerts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // 1. Récupère la liste des utilisateurs depuis UserDAO via l'API[cite: 8]
      const res = await api.getResidents(token);
      setResidents(res);

      // 2. Récupère la consommation pour chaque résident via HydrationDAO[cite: 13]
      const hydMap = {};
      await Promise.all(res.map(async r => {
        hydMap[r.id] = await api.getHydrationToday(r.id, token);
      }));
      setHydration(hydMap);

      const alertsData = await api.getAlerts(token);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
    } catch (e) {
      console.error("Erreur de chargement:", e);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // TODO: subscribe to WebSocket for real-time alerts
  // e.g. const ws = new WebSocket(WS_URL); ws.onmessage = handleWsMessage;

  const resolveAlert = async (alertId) => {
    try {
      await api.resolveAlert(alertId, token);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isResolved: true } : a));
    } catch (e) {
      console.error("Erreur résolution alerte:", e);
    }
  };

  const activeAlerts = alerts.filter(a => !a.isResolved);
  const espConnected = residents.filter(r => r.esp32Id).length; // Utilise esp32Id
  const goalsReached = residents.filter(r => (hydration[r.id] || 0) >= r.daily_goal).length; // Utilise daily_goal

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Navbar alertCount={activeAlerts.length} />

      <div style={{ padding:'24px', maxWidth:1300, margin:'0 auto' }}>
        {/* Summary row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
          {[
            { label:'Résidents', value: residents.length, color:P.primary },
            { label:'Alertes actives', value: activeAlerts.length, color: activeAlerts.length ? '#e84040' : P.accent },
            { label:'ESP connectés', value: espConnected, color:P.secondary },
            { label:'Objectifs atteints', value: goalsReached, color:P.accent },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background:'#fff', borderRadius:12, padding:'16px 20px',
              border:'1.5px solid #dce8f5',
            }}>
              <p style={{ fontSize:12, color:'#5a7494', marginBottom:4 }}>{label}</p>
              <p style={{ fontSize:28, fontWeight:700, color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Main layout: grid + notifs */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:20, alignItems:'start' }}>
          {/* Resident grid */}
          <div>
            <h2 style={{ fontSize:15, fontWeight:600, color:P.primary, marginBottom:16 }}>
              Résidents
            </h2>
            {loading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
                <Spinner size={32} />
              </div>
            ) : (
              <div style={{
                display:'grid',
                gridTemplateColumns:'repeat(auto-fill, minmax(148px,1fr))',
                gap:12,
              }}>
                {residents.map(r => (
                  <div key={r.id} className="fade-in">
                    <ResidentCard
                      resident={r}
                      hydration={hydration[r.id] || 0}
                      alerts={alerts}
                      onClick={() => setSelected(r)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div style={{ position:'sticky', top:80, height:'calc(100vh - 104px)' }}>
            <NotifPanel alerts={alerts} residents={residents} onResolve={resolveAlert} />
          </div>
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <ResidentModal
          resident={selected}
          hydration={hydration[selected.id] || 0}
          alerts={alerts}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   PROFILE PAGE
───────────────────────────────────────── */
function ProfilePage() {
  const { user, logout } = useAuth();
  const { navigate }     = useRoute();
  const [saved, setSaved] = useState(false);
  const [form, setForm]   = useState({ name: user?.name || '', email: user?.email || '' });

  const save = async () => {
    // TODO: PATCH /api/users/:id  { name, email }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Navbar alertCount={0} />
      <div style={{ maxWidth:560, margin:'40px auto', padding:'0 16px' }}>
        <button onClick={() => navigate('dashboard')}
          style={{ background:'transparent', color:'#5a7494', fontSize:13, marginBottom:24,
            display:'flex', alignItems:'center', gap:6 }}>
          ← Retour au tableau de bord
        </button>

        <div className="fade-in" style={{
          background:'#fff', borderRadius:16, border:'1.5px solid #dce8f5', overflow:'hidden',
        }}>
          {/* Header */}
          <div style={{
            background:`linear-gradient(135deg,${P.primary},${P.secondary})`,
            padding:'32px 24px', textAlign:'center',
          }}>
            <div style={{
              width:72, height:72, borderRadius:'50%',
              background:'rgba(255,255,255,0.25)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:24, fontWeight:700, color:'#fff',
              margin:'0 auto 12px',
            }}>
              {user?.name?.split(' ').map(w=>w[0]).join('').slice(0,2)}
            </div>
            <h2 style={{ color:'#fff', fontWeight:600, fontSize:18 }}>{user?.name}</h2>
            <p style={{ color:'rgba(255,255,255,0.75)', fontSize:13 }}>
              {user?.role === 'admin' ? 'Administrateur' : 'Infirmier(ère)'} · {user?.organization}
            </p>
          </div>

          {/* Form */}
          <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>surname complet</label>
              <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Rôle</label>
              <input value={user?.role === 'admin' ? 'Administrateur' : 'Infirmier(ère)'} disabled
                style={{ background:'#f4f7fb', cursor:'not-allowed' }} />
            </div>
            <Btn variant="primary" onClick={save} style={{ alignSelf:'flex-start' }}>
              {saved ? '✓ Sauvegardé' : 'Sauvegarder'}
            </Btn>
          </div>
        </div>

        <Btn variant="danger" onClick={logout}
          style={{ marginTop:16, width:'100%', justifyContent:'center' }}>
          Se déconnecter
        </Btn>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   ADMIN PAGE
───────────────────────────────────────── */
function AdminPage() {
  const { navigate } = useRoute();
  const [staff, setStaff]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [invite, setInvite]   = useState({ name:'', email:'' });
  const [sending, setSending] = useState(false);
  const [msg, setMsg]         = useState('');

  useEffect(() => {
    api.getStaff().then(s => { setStaff(s); setLoading(false); });
  }, []);

  const sendInvite = async () => {
    if (!invite.name || !invite.email) return;
    setSending(true);
    await api.inviteNurse(invite.email, invite.name);
    setStaff(prev => [...prev, { id: Date.now(), name: invite.name, email: invite.email, role: 'nurse' }]);
    setInvite({ name:'', email:'' });
    setMsg('Invitation envoyée !');
    setSending(false);
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Navbar alertCount={0} />
      <div style={{ maxWidth:720, margin:'40px auto', padding:'0 16px' }}>
        <button onClick={() => navigate('dashboard')}
          style={{ background:'transparent', color:'#5a7494', fontSize:13, marginBottom:24,
            display:'flex', alignItems:'center', gap:6 }}>
          ← Retour
        </button>

        <h1 style={{ fontSize:20, fontWeight:700, color:P.primary, marginBottom:24 }}>
          Gestion de l'établissement
        </h1>

        {/* Invite nurse */}
        <div className="fade-in" style={{
          background:'#fff', borderRadius:14, border:'1.5px solid #dce8f5', padding:24, marginBottom:20,
        }}>
          <h2 style={{ fontSize:15, fontWeight:600, color:P.primary, marginBottom:16 }}>
            Inviter un infirmier
          </h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>surname</label>
              <input placeholder="Marie Curie" value={invite.name} onChange={e => setInvite(f=>({...f,name:e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Email</label>
              <input type="email" placeholder="marie@exemple.fr" value={invite.email} onChange={e => setInvite(f=>({...f,email:e.target.value}))} />
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Btn variant="secondary" onClick={sendInvite} loading={sending}>
              Envoyer l'invitation
            </Btn>
            {msg && <span style={{ fontSize:13, color:P.accent, fontWeight:600 }}>{msg}</span>}
          </div>
        </div>

        {/* Staff list */}
        <div className="fade-in" style={{
          background:'#fff', borderRadius:14, border:'1.5px solid #dce8f5', overflow:'hidden',
        }}>
          <div style={{ padding:'16px 24px', borderBottom:'1px solid #dce8f5' }}>
            <h2 style={{ fontSize:15, fontWeight:600, color:P.primary }}>Équipe</h2>
          </div>
          {loading ? (
            <div style={{ padding:40, display:'flex', justifyContent:'center' }}>
              <Spinner />
            </div>
          ) : (
            staff.map((s, i) => (
              <div key={s.id} style={{
                padding:'14px 24px', display:'flex', alignItems:'center', gap:14,
                borderBottom: i < staff.length-1 ? '1px solid #f4f7fb' : 'none',
              }}>
                <div style={{
                  width:36, height:36, borderRadius:'50%',
                  background:`linear-gradient(135deg,${P.primary}22,${P.secondary}44)`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, fontWeight:700, color:P.primary, flexShrink:0,
                }}>
                  {s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:600, color:P.primary }}>{s.name}</p>
                  <p style={{ fontSize:12, color:'#5a7494' }}>{s.email}</p>
                </div>
                <span className={`pill ${s.role==='admin'?'pill-warn':'pill-muted'}`}>
                  {s.role === 'admin' ? 'Admin' : 'Infirmier'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   APP ROOT
───────────────────────────────────────── */
function App() {
  const { user }     = useAuth();
  const { page }     = useRoute();

  if (!user) return <LoginPage />;

  if (page === 'profile') return <ProfilePage />;
  if (page === 'admin')   return <AdminPage />;
  return <Dashboard />;
}

export default App;
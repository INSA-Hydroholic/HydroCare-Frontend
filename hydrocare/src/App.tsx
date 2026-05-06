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

  getResidents: async (token, organizationId) => {
    const res = await fetch(`${API_BASE_URL}/api/users?filter=RESIDENT&organizationId=${organizationId}`, {
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

  getAlerts: async (token, establishmentId) => {
    const res = await fetch(`${API_BASE_URL}/api/organization/${establishmentId}/alerts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.alerts || [];
  },

  getStaff: async (token) => {
    const res = await fetch(`${API_BASE_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return res.json();
  },

  addUser: async (role: 'nurse' | 'resident', data: { username: string, email: string, password: string, first_name: string, surname: string }, token: string) => {
    const res = await fetch(`${API_BASE_URL}/api/users/addUser/${role}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erreur lors de la création');
    return res.json();
  },

  getConnectionCode: async (organizationId: number, token: string) => {
    const res = await fetch(`${API_BASE_URL}/api/device/${organizationId}/connectionCode`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Erreur code de connexion');
    return res.json();
  },

  listDevices: async (organizationId: number, token: string) => {
    const res = await fetch(`${API_BASE_URL}/api/device/${organizationId}/listDevices`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return res.json();
  },

  // Uses device ID and not mac
  bindUserDevice: async (userId: number, deviceId: String, token: string) => {
    const res = await fetch(`${API_BASE_URL}/api/users/${userId}/${deviceId}/bindDevice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Erreur à l\'affectation du device. Il est peut-être déjà utilisé');
    return res.json();
  },

  unbindUserDevice: async (userId: number, deviceId: String, token: string) => {
    const res = await fetch(`${API_BASE_URL}/api/users/${userId}/${deviceId}/unbindDevice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Erreur à la désaffectation du device.');
    return res.json();
  },

  register: async (formData) => {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData), // We send everything
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erreur lors de la création');
      }
      return res.json();
    },
  };


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

  const register = async (formData) => {
    const res = await api.register(formData);
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
    adminFirstName: '',
    adminAddress: '',
    adminEmail: '',
  });

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}));

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.username, form.password);
      } else {
        if (!form) throw new Error('Tous les champs sont requis');
        await register(form);
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
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Adresse</label>
              <input placeholder="123 Rue de la Paix" value={form.adminAddress} onChange={set('adminAddress')} onKeyDown={handleKey} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Nom</label>
              <input placeholder="Dupont" value={form.adminName} onChange={set('adminName')} onKeyDown={handleKey} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Prénom</label>
              <input placeholder="Marie" value={form.adminFirstName} onChange={set('adminFirstName')} onKeyDown={handleKey} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Email</label>
              <input placeholder="marie.dupont@exemple.com" value={form.adminEmail} onChange={set('adminEmail')} onKeyDown={handleKey} />
            </div>
          </>}

          <div>
          <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>
            Identifiant
          </label>
          <input
            type="text"
            placeholder="Ex: jean_nurse"
            value={form.username}
            onChange={set('username')}
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
function ResidentModal({ resident, devices, hydration, alerts, onClose }) {

  const { token } = useAuth();

  // Check the resident's ESP32 status
  const hasDevice = !!resident.esp32Id;
  const isDisconnected = alerts.some(a => a.userId === resident.id && a.severity === 'GREY');
  const espStatus = !hasDevice ? 'unbound' : isDisconnected ? 'disconnected' : 'connected';

  // Define the macAddress of the selected device based on the resident's current binding
  const [selectedDeviceId, setSelectedDeviceId] = useState(
    resident.esp32?.macAddress || ''
  );


  const [saving, setSaving]       = useState(false);
  const cleanupRef = useRef(null);

  const residentAlerts = alerts.filter(a => a.userId === resident.id);
  const pct = Math.round(Math.min(100, (hydration / resident.daily_goal) * 100));
  
  const [deviceError, setDeviceError] = useState('');

  const handleDeviceSelect = (e) => {
    setSelectedDeviceId(e.target.value);
    setDeviceError('');
  };

  const handleBind = async () => {
    if (!selectedDeviceId) return;
    setSaving(true);
    setDeviceError('');
    try {
      await api.bindUserDevice(resident.id, selectedDeviceId, token);
    } catch (err) {
      setDeviceError('L\'affectation du device a échoué.');
    }
    setSaving(false);
  };

  const handleUnbind = async () => {
    setSaving(true);
    setDeviceError('');
    try {
      await api.unbindUserDevice(resident.id, selectedDeviceId, token);
      setSelectedDeviceId('');
    } catch (err) {
      setDeviceError('La désaffectation du device a échoué.');
    }
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
              <p style={{ opacity:0.8, fontSize:13 }}>Chambre {resident.room}</p>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#5a7494', margin: 0 }}>
                  Hydrobase
                </h3>
                
                {resident.esp32 && (
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 500, color: P.primary }}>
                    <span>🆔 {resident.esp32.macAddress}</span>
                    {resident.esp32.batteryLevel != null && (
                      <span>🔋 {resident.esp32.batteryLevel}%</span>
                    )}
                  </div>
                )}
              </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <StatusDot 
                status={
                  espStatus === 'connected' ? 'ok' : 
                  espStatus === 'unbound' ? 'none' : 'disconnected'
                } 
                size={10} 
              />
              
              <span style={{ fontSize: 13, color: '#5a7494', textTransform: 'capitalize' }}>
                {espStatus === 'unbound' ? 'Pas de base associée' :
                espStatus === 'disconnected' ? 'Déconnecté' : 'Connecté'}
              </span>
              
              {saving && <Spinner size={12} />}
            </div>

            <select
              value={selectedDeviceId}
              onChange={handleDeviceSelect}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1.5px solid #dce8f5', fontSize: 13,
                color: P.primary, background: '#fff', cursor: 'pointer',
              }}
            >
              <option value="">— Choisissez un dispositif—</option>
              {devices.map(d => (
                <option key={d.id} value={d.macAddress}>
                  Device {d.macAddress}
                </option>
              ))}
            </select>

            {deviceError && (
              <p style={{ color: '#e84040', fontSize: 12, marginTop: 6 }}>{deviceError}</p>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Btn
                variant="secondary"
                onClick={handleBind}
                loading={saving}
                disabled={!selectedDeviceId}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Connecter
              </Btn>
              <Btn
                variant="danger"
                onClick={handleUnbind}
                loading={saving}
                disabled={!resident.esp32?.macAddress}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Déconnecter
              </Btn>
            </div>


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
           {resident.room ? `Ch. ${resident.room}` : ''}
       </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   NOTIFICATIONS PANEL
───────────────────────────────────────── */
function NotifPanel({ alerts, residents, onResolve }) {
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
                  {res.name} {res.surname} · Ch.{res.room}
                </p>
              )}
              <p style={{ fontSize:12, color:'#1a2a3a', marginBottom:4 }}>{alert.message}</p>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'#aab8c8' }}></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddUserModal({ role, onClose, onSuccess }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '' , first_name: '', surname: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => { 
    if (!form.username || !form.email || !form.password || !form.first_name || !form.surname) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await api.addUser(role, form, token);
      onSuccess();
      onClose();
    } catch(e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const label = role === 'nurse' ? 'nurse' : 'resident';

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ padding: 24, maxWidth: 400 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: P.primary, marginBottom: 20 }}>
          Add a {label}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['username', 'email', 'password', 'first_name', 'surname'].map(field => (
            <div key={field}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5a7494', display: 'block', marginBottom: 4 }}>
                {field === 'username' ? 'Username' : field === 'email' ? 'Email' : field === 'first_name' ? 'First Name' : field === 'surname' ? 'Surname' : 'Password'}
              </label>
              <input
                type={field === 'password' ? 'password' : 'text'}
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              />
            </div>
          ))}
          {error && <p style={{ color: '#e84040', fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Btn variant="primary" onClick={submit} loading={loading}>Créer</Btn>
            <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// Auxiliary function to get connected devices from the alert list
function getConnectedDevices(devices, alerts) {
  const disconnectedUserIds = new Set(
    alerts.filter(a => a.severity === 'GREY').map(a => a.userId)
  );
  return devices.filter(d => {
    const userId = d.user?.id;
    return userId && !disconnectedUserIds.has(userId);
  });
}

function DevicePanel({ devices, alerts }) {
  const disconnectedIds = new Set(
    alerts
      .filter(a => a.severity === 'GREY')
      .map(a => a.userId)
  );

  // Map userId -> device, mark connected/disconnected
  const deviceRows = devices.map(d => ({
    ...d,
    isConnected: !disconnectedIds.has(d.userId ?? d.user?.id),
  }));

  const connected = getConnectedDevices(devices, alerts);

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1.5px solid #dce8f5',
      overflow: 'hidden', marginTop: 16,
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #dce8f5' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: P.primary }}>
          Devices — {connected.length}/{deviceRows.length} connected
        </h2>
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {connected.length === 0 && (
          <p style={{ textAlign: 'center', color: '#aab8c8', fontSize: 13, padding: 20 }}>
            No connected devices
          </p>
        )}
        {connected.map(d => (
          <div key={d.id} style={{
            padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid #f4f7fb',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusDot status="ok" size={8} />
              <span style={{ fontSize: 13, color: P.primary, fontWeight: 600 }}>
                Device {d.id}
              </span>
            </div>
            <span style={{ fontSize: 12, color: '#5a7494' }}>
              {d.batteryLevel != null ? `🔋 ${d.batteryLevel}%` : 'No battery data'}
            </span>
          </div>
        ))}
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
              {user?.role === 'ADMIN' && (
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
  const { token, user } = useAuth();
  const [residents, setResidents]   = useState([]);
  const [hydration, setHydration]   = useState({});
  const [alerts, setAlerts]         = useState([]);
  const [devices, setDevices]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [modal, setModal]           = useState(null);
  const [connCode, setConnCode]     = useState('');


  const load = useCallback(async (showSpinner = true) => {
    if (!token) return;
    if (showSpinner) setLoading(true);
    try {
      // 1. Récupère la liste des utilisateurs depuis UserDAO
      const res = await api.getResidents(token, user?.organizationId);
      setResidents(res);

      // 2. Récupère la consommation pour chaque résident
      const hydMap = {};
      await Promise.all(res.map(async r => {
        hydMap[r.id] = await api.getHydrationToday(r.id, token);
      }));
      setHydration(hydMap);

      const deviceList = await api.listDevices(user?.organizationId, token);
      setDevices(Array.isArray(deviceList) ? deviceList : []);

      const alertsData = await api.getAlerts(token, user?.organizationId);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
    } catch (e) {
      console.error("Erreur de chargement:", e);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);
  
  useEffect(() => {
    const interval = setInterval(() => load(false), 10000);
    return () => clearInterval(interval);
  }, [load]);


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

            {/* Buttons */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <h2 style={{ fontSize:15, fontWeight:600, color:P.primary }}>
                Résidents
              </h2>
              <div style={{ display:'flex', gap:8 }}>
                <Btn variant="ghost" style={{ fontSize:12, padding:'7px 14px' }}
                  onClick={async () => {
                    const data = await api.getConnectionCode(user?.organizationId, token);
                    setConnCode(data.connectionCode);
                    setModal('code');
                    console.log('user:', user);

                  }}>
                  Code de Connexion Hydrobase
                </Btn>
                <Btn variant="ghost" style={{ fontSize:12, padding:'7px 14px' }}
                  onClick={() => setModal('resident')}>
                  
                  + Résident
                </Btn>
                <Btn variant="secondary" style={{ fontSize:12, padding:'7px 14px' }}
                  onClick={() => setModal('nurse')}>
                  + Infirmier
                </Btn>
              </div>
            </div>


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
            <NotifPanel alerts={alerts} residents={residents} />
            <DevicePanel devices={devices} alerts={alerts} />
          </div>
          
        </div>
      </div>

      {/* Modal */}
      {/* Pop Up for clicking a resident */}
      {selected && (
        <ResidentModal
          resident={selected}
          devices={devices}
          hydration={hydration[selected.id] || 0}
          alerts={alerts}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Pop-Up for adding nurse or resident */}
      {(modal === 'nurse' || modal === 'resident') && (
        <AddUserModal
          role={modal}
          onClose={() => setModal(null)}
          onSuccess={load}
        />
      )}

      {/* Pop-Up for connection code */}
      {modal === 'code' && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ padding:32, maxWidth:420 }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:13, color:'#5a7494', marginBottom:8 }}>
                        Pour connecter un nouvel appareil, allumez-le.
                        Il va créer un nouveau réseau WiFi qui vous redirigera, après connexion,
                        vers une page web. Saisissez le nom (SSID) de votre WiFi, son mot de passe,
                        ainsi que le code ci-dessous pour le configurer :
            </p>
            <div style={{
              fontSize:32, fontWeight:700, letterSpacing:8, textAlign:'center',
              color:P.secondary, background:'#f4f7fb',
              padding:'16px 24px', borderRadius:10, margin:'20px 0',
            }}>
              {connCode}
            </div>
            <Btn variant="ghost" onClick={() => setModal(null)} style={{ width:'100%', justifyContent:'center' }}>
              Close
            </Btn>
          </div>
        </div>
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
  const [form, setForm]   = useState({ name: user?.name || '', surname: user?.surname || '', email: user?.email || '' });

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
              {user?.role === 'ADMIN' ? 'Administrateur' : 'Infirmier(ère)'} · {user?.organization}
            </p>
          </div>

          {/* Form */}
          <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Nom</label>
              <input value={form.surname} onChange={e => setForm(f=>({...f,surname:e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Prenom</label>
              <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#5a7494', display:'block', marginBottom:4 }}>Rôle</label>
              <input value={user?.role === 'ADMIN' ? 'Administrateur' : 'Infirmier(ère)'} disabled
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
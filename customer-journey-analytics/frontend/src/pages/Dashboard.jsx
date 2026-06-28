import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
  LabelList,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";
import SiteSelector from "../components/SiteSelector";

// Gradient palette for funnel stages
const STAGE_COLORS = ["#667eea", "#764ba2", "#f093fb", "#4facfe"];

function shortLabel(stage) {
  if (!stage) return "";
  return stage.length > 16 ? stage.slice(0, 14) + "\u2026" : stage;
}

function FunnelTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 16px",boxShadow:"0 4px 12px rgba(0,0,0,0.10)",fontSize:13,color:"#1e293b",minWidth:180 }}>
      <div style={{ fontWeight:700,marginBottom:6,fontSize:14 }}>{d.stage}</div>
      <div style={{ display:"flex",justifyContent:"space-between",gap:24 }}>
        <span style={{ color:"#64748b" }}>Sessions</span>
        <span style={{ fontWeight:700 }}>{d.users}</span>
      </div>
      <div style={{ display:"flex",justifyContent:"space-between",gap:24,marginTop:4 }}>
        <span style={{ color:"#64748b" }}>{d.index===0?"Entry stage":"Step conversion"}</span>
        <span style={{ fontWeight:700,color:d.index===0?"#16a34a":d.conversionRate>=50?"#16a34a":"#dc2626" }}>
          {d.index===0?"100%":`${d.conversionRate}%`}
        </span>
      </div>
    </div>
  );
}

const NAV_PANELS = [
  { to:"/session-analytics",  title:"Session Analytics",  desc:"Browse all sessions: duration, funnel stage, events",      color:"#3b82f6" },
  { to:"/risk-prediction",    title:"Risk Prediction",    desc:"High / Medium / Low drop-off risk per session",             color:"#ef4444" },
  { to:"/sentiment-insights", title:"Sentiment Insights", desc:"Positive / neutral / negative feedback distribution",       color:"#8b5cf6" },
  { to:"/heatmap",            title:"Heatmap",            desc:"Click & cursor density heatmap per page",                   color:"#f59e0b" },
];

const MORE_TOOLS = [
  { to:"/scroll-heatmap",       label:"Scroll Heatmap" },
  { to:"/time-on-page",         label:"Time on Page" },
  { to:"/entry-exit",           label:"Entry & Exit" },
  { to:"/rage-clicks",          label:"Rage Clicks" },
  { to:"/nav-paths",            label:"Nav Paths" },
  { to:"/conversion-influence", label:"Conversion Influencer" },
  { to:"/engagement-scores",    label:"Engagement Scores" },
];

export default function Dashboard() {
  const { token, user, logout } = useAuth();
  const { currentSiteId, loadingSites, availableSites } = useSite();

  const [funnelData, setFunnelData]       = useState([]);
  const [funnelLoading, setFunnelLoading] = useState(true);
  const [funnelError, setFunnelError]     = useState('');

  useEffect(() => {
    if (!token || !currentSiteId) {
      setFunnelData([]);
      setFunnelLoading(true);
      setFunnelError('');
      return;
    }

    const controller = new AbortController();
    setFunnelLoading(true);
    setFunnelError('');
    setFunnelData([]);

    fetch(`http://localhost:5000/api/funnel?site_id=${encodeURIComponent(currentSiteId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!controller.signal.aborted) {
          setFunnelData(Array.isArray(data) ? data.map((d, i) => ({ ...d, index: i })) : []);
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setFunnelError(err.message || 'Failed to load funnel data');
      })
      .finally(() => {
        if (!controller.signal.aborted) setFunnelLoading(false);
      });

    return () => controller.abort();
  }, [token, currentSiteId]);

  const siteName = availableSites.find(s => s.site_id === currentSiteId)?.display_name || currentSiteId || '';

  const stageRows = funnelData.map((stage, i) => {
    const prev = i > 0 ? funnelData[i - 1].users : null;
    const dropped = prev !== null && prev > 0 ? prev - stage.users : null;
    return { ...stage, dropped };
  });

  return (
    <div style={S.page}>
      {/* Top bar */}
      <div style={S.topBar}>
        <div>
          <h1 style={S.topTitle}>Analytics Dashboard</h1>
          <p style={S.topSub}>{user?.email} &middot; <span style={{ textTransform:'capitalize' }}>{user?.role}</span></p>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <SiteSelector />
          <button onClick={logout} style={S.logoutBtn}>Log out</button>
        </div>
      </div>

      {/* Secondary tools strip */}
      <div style={S.toolStrip}>
        {MORE_TOOLS.map(t => <Link key={t.to} to={t.to} style={S.toolChip}>{t.label}</Link>)}
        <Link to="/users" style={{ ...S.toolChip, color:'#94a3b8' }}>Manage Users</Link>
        <a href="http://localhost:3000" target="_blank" rel="noreferrer" style={{ ...S.toolChip, color:'#16a34a', marginLeft:'auto', textDecoration:'none' }}>🛍️ Visit Store ↗</a>
      </div>

      {/* Primary panel nav cards */}
      <div style={S.navGrid}>
        {NAV_PANELS.map(p => (
          <Link key={p.to} to={p.to} style={S.navCard}>
            <div style={{ ...S.navDot, background:p.color }} />
            <div>
              <div style={S.navTitle}>{p.title}</div>
              <div style={S.navDesc}>{p.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Funnel Panel card */}
      <div style={S.card}>
        <div style={S.cardHead}>
          <div>
            <h2 style={S.cardTitle}>Conversion Funnel</h2>
            {siteName && <p style={S.cardSub}>Site: <strong style={{ color:'#64748b' }}>{siteName}</strong></p>}
          </div>
          {funnelData.length > 0 && <span style={S.badge}>{funnelData[0].users} sessions</span>}
        </div>

        {(loadingSites || funnelLoading) && (
          <div style={S.skeletonRow}>
            {[80,130,95,55].map((h,i) => (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <div className="cja-skeleton" style={{ width:'80%', height:h }} />
                <div className="cja-skeleton" style={{ width:'55%', height:11 }} />
              </div>
            ))}
          </div>
        )}

        {!loadingSites && !funnelLoading && funnelError && (
          <div className="cja-panel-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {funnelError}
          </div>
        )}

        {!loadingSites && !funnelLoading && !funnelError && funnelData.length === 0 && (
          <div className="cja-panel-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
              <path d="M3 6l9-3 9 3v12l-9 3-9-3V6z"/>
            </svg>
            <span>No funnel data yet. Seed demo data or start tracking sessions to see drop-off curves.</span>
          </div>
        )}

        {!loadingSites && !funnelLoading && !funnelError && funnelData.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={funnelData} margin={{ top:24, right:16, left:0, bottom:4 }} barCategoryGap="32%">
                <XAxis dataKey="stage" tickFormatter={shortLabel} tick={{ fontSize:12, fill:'#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<FunnelTooltip />} />
                <Bar dataKey="users" radius={[6,6,0,0]}>
                  {funnelData.map((_, i) => <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />)}
                  <LabelList dataKey="users" position="top" style={{ fontSize:12, fontWeight:700, fill:'#334155' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div style={S.stageTable}>
              {stageRows.map((stage, i) => (
                <div key={i} style={S.stageRow}>
                  <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0, flex:1 }}>
                    <span style={{ width:9, height:9, borderRadius:'50%', flexShrink:0, background:STAGE_COLORS[i%STAGE_COLORS.length] }} />
                    <span style={{ fontSize:13, fontWeight:600, color:'#334155', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={stage.stage}>
                      {stage.stage}
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'#475569', minWidth:70, textAlign:'right' }}>{stage.users} users</span>
                    {i === 0 ? (
                      <span style={{ ...S.pctBadge, color:'#16a34a', background:'#dcfce7' }}>Entry</span>
                    ) : (
                      <>
                        <span style={{ ...S.pctBadge, color:stage.conversionRate>=50?'#16a34a':'#dc2626', background:stage.conversionRate>=50?'#dcfce7':'#fee2e2' }}>
                          {stage.conversionRate}% converted
                        </span>
                        <span style={{ fontSize:12, color:'#94a3b8', minWidth:72 }}>−{stage.dropped} dropped</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  page:      { maxWidth:1100, margin:'0 auto', padding:'32px 24px', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", color:'#1e293b' },
  topBar:    { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 },
  topTitle:  { margin:0, fontSize:26, fontWeight:800, color:'#f8fafc' },
  topSub:    { margin:'4px 0 0', fontSize:14, color:'#64748b' },
  logoutBtn: { padding:'8px 18px', fontSize:14, fontWeight:600, background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:8, color:'#475569', cursor:'pointer' },
  toolStrip: { display:'flex', gap:8, flexWrap:'wrap', marginBottom:24, padding:'10px 14px', background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0' },
  toolChip:  { fontSize:12, fontWeight:600, color:'#667eea', textDecoration:'none', padding:'4px 10px', borderRadius:6, background:'#fff', border:'1px solid #e2e8f0', whiteSpace:'nowrap' },
  navGrid:   { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16, marginBottom:28 },
  navCard:   { display:'flex', alignItems:'flex-start', gap:13, background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px 18px', textDecoration:'none', color:'#1e293b', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' },
  navDot:    { width:10, height:10, borderRadius:'50%', flexShrink:0, marginTop:4 },
  navTitle:  { fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:3 },
  navDesc:   { fontSize:12, color:'#64748b', lineHeight:1.4 },
  card:      { background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'24px 28px', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' },
  cardHead:  { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 },
  cardTitle: { margin:0, fontSize:20, fontWeight:700 },
  cardSub:   { margin:'4px 0 0', fontSize:13, color:'#94a3b8' },
  badge:     { fontSize:12, fontWeight:600, background:'#f0f4ff', color:'#4f46e5', padding:'4px 12px', borderRadius:20, border:'1px solid #c7d2fe', whiteSpace:'nowrap' },
  skeletonRow: { display:'flex', gap:12, alignItems:'flex-end', padding:'16px 0 8px' },
  stageTable: { marginTop:18, borderTop:'1px solid #f1f5f9', paddingTop:14, display:'flex', flexDirection:'column', gap:8 },
  stageRow:  { display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6, padding:'8px 12px', borderRadius:8, background:'#f8fafc' },
  pctBadge:  { fontSize:12, fontWeight:700, padding:'2px 10px', borderRadius:12 },
};

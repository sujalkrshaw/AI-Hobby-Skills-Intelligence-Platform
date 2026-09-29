import { useEffect, useMemo, useState } from 'react';
import { api, uploadFile } from '../lib/api';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const CATEGORIES = ['Coding', 'Cloud', 'DevOps', 'Data', 'AI/ML', 'Creative', 'Music', 'Fitness', 'Other'];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Modal({ title, children, onClose }) {
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="modal"><div className="modal-head"><div><span className="eyebrow">WORKSPACE ACTION</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>{children}</div>
  </div>;
}
function Field({ label, children, hint }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function SectionTitle({ eyebrow, title, action }) { return <div className="section-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>; }
function StatusDot({ label = 'Operational' }) { return <span className="status"><i />{label}</span>; }
function initials(name = 'Learner') { return name.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase(); }
function fmtMinutes(m) { const n = Number(m || 0); return n >= 60 ? `${Math.floor(n / 60)}h ${n % 60}m` : `${n}m`; }
function relativeTime(value) { const d = new Date(value); const diff = Math.max(0, Date.now() - d.getTime()); const mins = Math.floor(diff / 60000); if (mins < 60) return `${Math.max(1, mins)}m ago`; const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`; return `${Math.floor(hrs / 24)}d ago`; }

export default function Dashboard() {
  const [d, setD] = useState(null), [coach, setCoach] = useState(null), [pred, setPred] = useState(null), [profile, setProfile] = useState(null);
  const [skills, setSkills] = useState([]), [posts, setPosts] = useState([]), [activity, setActivity] = useState([]), [badges, setBadges] = useState(null), [trends, setTrends] = useState([]);
  const [err, setErr] = useState(''), [notice, setNotice] = useState(''), [modal, setModal] = useState(null), [busy, setBusy] = useState(false), [commentFor, setCommentFor] = useState(null);
  const [commentText, setCommentText] = useState(''), [file, setFile] = useState(null), [nfcStatus, setNfcStatus] = useState('NFC-ready');
  const [weeklyTarget, setWeeklyTarget] = useState(Number(localStorage.getItem('weeklyTarget') || 240));
  const [skillForm, setSkillForm] = useState({ name: '', category: 'Coding', current_level: 'BEGINNER', target_level: 'INTERMEDIATE', description: '' });
  const [goalForm, setGoalForm] = useState({ skill_id: '', title: '', target_minutes: 600 });
  const [practiceForm, setPracticeForm] = useState({ skill_id: '', duration_minutes: 30, activity: '', notes: '', practiced_at: new Date().toISOString().slice(0, 16) });
  const [postForm, setPostForm] = useState({ content: '' });

  const refresh = async () => {
    setErr('');
    try {
      const [a, c, p, s, f, me, act, bg, tr] = await Promise.all([
        api('/api/analytics/dashboard'), api('/api/ai/coach'), api('/api/ai/predict'), api('/api/skills'), api('/api/posts'),
        api('/api/profile'), api('/api/analytics/activity'), api('/api/analytics/gamification'), api('/api/trends')
      ]);
      setD(a); setCoach(c); setPred(p); setSkills(s); setPosts(f); setProfile(me); setActivity(act); setBadges(bg); setTrends(tr || []);
      if (s.length) {
        setGoalForm(x => ({ ...x, skill_id: x.skill_id || String(s[0].id) }));
        setPracticeForm(x => ({ ...x, skill_id: x.skill_id || String(s[0].id) }));
      }
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { refresh(); }, []);

  const runAction = async (fn, success) => {
    setBusy(true); setErr(''); setNotice('');
    try { await fn(); setModal(null); setNotice(success); await refresh(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const createSkill = () => runAction(() => api('/api/skills', { method: 'POST', body: JSON.stringify({ ...skillForm, name: skillForm.name.trim(), description: skillForm.description.trim() }) }), 'Skill added to your portfolio.');
  const createGoal = () => runAction(() => api('/api/goals', { method: 'POST', body: JSON.stringify({ skill_id: Number(goalForm.skill_id), title: goalForm.title.trim(), target_minutes: Number(goalForm.target_minutes) }) }), 'Measurable goal created.');
  const logPractice = () => runAction(() => api('/api/practice', { method: 'POST', body: JSON.stringify({ skill_id: Number(practiceForm.skill_id), duration_minutes: Number(practiceForm.duration_minutes), activity: practiceForm.activity.trim(), notes: practiceForm.notes.trim(), practiced_at: new Date(practiceForm.practiced_at).toISOString() }) }), 'Practice captured. AI insights refreshed.');
  const createPost = () => runAction(() => api('/api/posts', { method: 'POST', body: JSON.stringify({ content: postForm.content.trim() }) }), 'Community post published.');
  const addComment = postId => runAction(() => api(`/api/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content: commentText.trim() }) }), 'Comment added.');
  const handleUpload = () => file && runAction(() => uploadFile(file), 'Learning evidence stored in object storage.');
  const toggleLike = async post => { setBusy(true); try { await api(`/api/posts/${post.id}/like`, { method: post.liked ? 'DELETE' : 'POST' }); await refresh(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const setTarget = value => { const n = Math.max(30, Number(value) || 240); setWeeklyTarget(n); localStorage.setItem('weeklyTarget', String(n)); };

  const weeklyPct = Math.min(100, Math.round(((d?.week_minutes || 0) / weeklyTarget) * 100));
  const completedGoals = useMemo(() => d?.goals?.filter(g => g.progress >= 100).length || 0, [d]);
  const avgGoalProgress = useMemo(() => !d?.goals?.length ? 0 : Math.round(d.goals.reduce((s, g) => s + Math.min(100, g.progress || 0), 0) / d.goals.length), [d]);
  const practicedDates = useMemo(() => new Set((activity || []).map(x => new Date(x.practiced_at).toDateString())), [activity]);
  const weekCalendar = useMemo(() => { const today = new Date(); return Array.from({ length: 7 }, (_, i) => { const dt = new Date(today); dt.setDate(today.getDate() - (6 - i)); return dt; }); }, [d]);
  const selectedSkill = useMemo(() => skills.find(s => String(s.id) === String(practiceForm.skill_id)), [skills, practiceForm.skill_id]);
  const practiceTrend = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(today);
      dt.setHours(0, 0, 0, 0);
      dt.setDate(today.getDate() - (6 - i));
      const key = dt.toDateString();
      const minutes = (activity || []).filter(a => new Date(a.practiced_at).toDateString() === key).reduce((sum, a) => sum + Number(a.duration_minutes || 0), 0);
      return { label: WEEK_DAYS[dt.getDay()], date: dt.getDate(), minutes };
    });
  }, [activity]);
  const trendMax = Math.max(60, ...practiceTrend.map(x => x.minutes));

  const startNfc = async () => {
    if (!('NDEFReader' in window)) { setNfcStatus('Web NFC unavailable on this browser/device'); return; }
    try {
      const reader = new window.NDEFReader();
      await reader.scan(); setNfcStatus('Waiting for NFC tag…');
      reader.onreading = event => {
        const record = event.message?.records?.[0];
        const text = record?.recordType === 'text' ? new TextDecoder(record.encoding || 'utf-8').decode(record.data) : '';
        const match = text.match(/skillId=(\d+);minutes=(\d+)/i);
        if (match) { setPracticeForm(x => ({ ...x, skill_id: match[1], duration_minutes: Number(match[2]), activity: 'NFC tap-to-log practice' })); setModal('practice'); setNfcStatus('NFC tag read successfully'); }
        else setNfcStatus('Tag read; expected skillId=ID;minutes=30 payload');
      };
    } catch (e) { setNfcStatus(`NFC scan unavailable: ${e.message}`); }
  };

  if (err && !d) return <div className="screen-center"><div className="panel error-panel"><span className="eyebrow">SYSTEM ERROR</span><h2>Dashboard unavailable</h2><p>{err}</p><button onClick={refresh}>Retry</button></div></div>;
  if (!d) return <div className="screen-center"><div className="loading-card"><div className="loader"/><b>Loading learning intelligence</b><span>Synchronising your workspace…</span></div></div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">SF</div><div><strong>SkillForge</strong><span>AI Learning OS</span></div></div>
      <nav>
        <a className="nav-item active" href="#overview">◈ <span>Overview</span></a><a className="nav-item" href="#skills">◇ <span>Skills</span></a><a className="nav-item" href="#goals">◎ <span>Goals</span></a><a className="nav-item" href="#activity">◷ <span>Activity</span></a><a className="nav-item" href="#community">◌ <span>Community</span></a><a className="nav-item" href="#evidence">↥ <span>Evidence</span></a>
      </nav>
      <div className="sidebar-bottom"><div className="infra-card"><span className="eyebrow">PLATFORM STATUS</span><StatusDot/><p>API, PostgreSQL and S3-compatible storage are operational.</p><span className="infra-code">DOCKER • FASTAPI • POSTGRES • S3</span></div><button className="signout" onClick={() => { localStorage.removeItem('token'); location.reload(); }}>↪ Sign out</button></div>
    </aside>

    <main className="main-content" id="overview">
      <header className="topbar"><div><span className="eyebrow">PERSONAL LEARNING INTELLIGENCE</span><h1>Good to see you, {profile?.name?.split(' ')[0] || 'Learner'}</h1><p className="top-sub">Your progress, next action and learning evidence in one workspace.</p></div><div className="topbar-right"><StatusDot label="All systems operational"/><div className="profile-chip"><div className="avatar">{initials(profile?.name)}</div><div><b>{profile?.name || 'Learner'}</b><span>@{profile?.username || 'learner'}</span></div></div></div></header>

      <section className="hero-card"><div><span className="badge">AI-POWERED • CLOUD-READY</span><h2>Turn practice into measurable progress.</h2><p>Build skills, track goals, capture evidence, get explainable AI guidance and learn with a community.</p></div><div className="hero-visual" aria-hidden="true"><img src="/skillforge-learning-visual.svg" alt="" /></div><div className="hero-actions"><button onClick={() => setModal('practice')}>＋ Quick log</button><button className="secondary" onClick={() => setModal('skill')}>＋ Add skill</button></div></section>
      {notice && <div className="notice success"><span>✓</span>{notice}</div>}{err && <div className="notice error"><span>!</span>{err}</div>}

      <section className="kpi-grid">
        <div className="kpi"><span>Total practice</span><strong>{d.total_hours}h</strong><small>{d.month_minutes} min in the last 30 days</small><div className="kpi-foot">↗ Long-term activity</div></div>
        <div className="kpi"><span>Current streak</span><strong>🔥 {d.current_streak}d</strong><small>Consecutive practice signal</small><div className="kpi-foot">Consistency momentum</div></div>
        <div className="kpi"><span>Active skills</span><strong>{d.active_skills}</strong><small>{d.most_practiced_skill || 'Build your first skill'}</small><div className="kpi-foot">◆ Skill portfolio</div></div>
        <div className="kpi accent"><span>7-day forecast</span><strong>{Math.round(pred.prediction_minutes)}m</strong><small>{pred.engine} • {pred.confidence} confidence</small><div className="kpi-foot">◉ Predictive insight</div></div>
      </section>

      <section className="top-grid">
        <div className="panel progress-panel"><SectionTitle eyebrow="MOTIVATIONAL CORE" title="Weekly progress" action={<label className="target-control">Target <input type="number" min="30" step="30" value={weeklyTarget} onChange={e => setTarget(e.target.value)}/> min</label>}/><div className="progress-layout"><div className="ring" style={{ '--progress': `${weeklyPct * 3.6}deg` }}><div><strong>{weeklyPct}%</strong><span>{fmtMinutes(d.week_minutes)} tracked</span></div></div><div className="progress-copy"><b>{fmtMinutes(d.week_minutes)} <span>/ {fmtMinutes(weeklyTarget)}</span></b><p>{weeklyPct >= 100 ? 'Weekly target reached. Protect the habit with a sustainable minimum.' : `${fmtMinutes(Math.max(0, weeklyTarget - d.week_minutes))} remaining to hit this week's target.`}</p><div className="week-calendar">{weekCalendar.map(dt => <div className={`day ${practicedDates.has(dt.toDateString()) ? 'done' : ''} ${dt.toDateString() === new Date().toDateString() ? 'today' : ''}`} key={dt.toISOString()}><span>{WEEK_DAYS[dt.getDay()]}</span><i>{dt.getDate()}</i></div>)}</div></div></div></div>
        <div className="panel quick-panel"><SectionTitle eyebrow="LOW-FRICTION ACTION" title="Quick log" action={<span className="ai-chip">&lt; 5 sec</span>}/><p className="muted">Capture a short session without leaving the dashboard.</p><div className="quick-grid">{skills.slice(0, 4).map(s => <button key={s.id} className="quick-skill" onClick={() => { setPracticeForm(x => ({ ...x, skill_id: String(s.id), duration_minutes: 30, activity: `Focused ${s.name} practice` })); setModal('practice'); }}><span>{s.name.slice(0, 1).toUpperCase()}</span><b>{s.name}</b><small>+30 min</small></button>)}</div><div className="nfc-row"><button className="secondary full" onClick={startNfc}>◎ Tap-to-log with NFC</button><span>{nfcStatus}</span></div></div>
      </section>

      <section className="panel trend-panel" id="analytics"><SectionTitle eyebrow="ANALYTICS" title="Practice trend" action={<span className="summary-chip">Last 7 days</span>}/><div className="trend-chart" role="img" aria-label="Practice minutes over the last seven days"><div className="trend-y"><span>{trendMax}m</span><span>{Math.round(trendMax / 2)}m</span><span>0m</span></div><div className="trend-plot"><div className="trend-grid"><i/><i/><i/></div><svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6d5dfc" stopOpacity=".24"/><stop offset="100%" stopColor="#6d5dfc" stopOpacity="0"/></linearGradient></defs><polygon fill="url(#trendFill)" points={practiceTrend.map((pt,i)=>`${i*(700/6)},${205-(pt.minutes/trendMax)*170}`).concat(['700,205','0,205']).join(' ')}/><polyline fill="none" stroke="#6d5dfc" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={practiceTrend.map((pt,i)=>`${i*(700/6)},${205-(pt.minutes/trendMax)*170}`).join(' ')}/>{practiceTrend.map((pt,i)=><circle key={pt.label+i} cx={i*(700/6)} cy={205-(pt.minutes/trendMax)*170} r="5" fill="#ffffff" stroke="#6d5dfc" strokeWidth="3"/> )}</svg><div className="trend-labels">{practiceTrend.map((pt,i)=><span key={pt.label+i}>{pt.label}<b>{pt.minutes}m</b></span>)}</div></div></div></section>

      <section className="dashboard-grid"><div className="panel coach-panel"><SectionTitle eyebrow="AI ADVISOR" title="What to do next" action={<span className="ai-chip">● Explainable AI</span>}/><p className="coach-summary">{coach.summary}</p><div className="recommendations">{coach.recommendations.slice(0, 4).map((r, i) => <div className="recommend" key={i}><span className={`priority ${r.priority}`}>{r.priority.toUpperCase()}</span><p>{r.message}</p></div>)}</div></div><div className="panel suggested-panel"><SectionTitle eyebrow="PERSONALIZED" title="Suggested for you"/><div className="suggestion"><span className="suggestion-icon">→</span><div><b>Next practical session</b><p>{coach.recommendations?.[0]?.message || 'Log a short session to generate a personalized recommendation.'}</p></div></div><div className="suggestion"><span className="suggestion-icon">AI</span><div><b>Prediction signal</b><p>{pred.reason}</p></div></div>{trends.length > 0 && <div className="trend-strip"><b>Live skill signals</b><span>{trends.slice(0, 3).map(t => `#${t.tag} ${t.question_count}`).join('  •  ')}</span></div>}</div></section>

      <section className="panel portfolio-panel" id="skills"><SectionTitle eyebrow="PORTFOLIO" title="Skill development" action={<button className="mini" onClick={() => setModal('skill')}>＋ Add skill</button>}/><div className="skill-list">{skills.map(s => <div className="skill-item" key={s.id}><div className="skill-top"><div><b>{s.name}</b><span>{s.category} · {s.current_level} → {s.target_level}</span></div><span className="pill">{s.status}</span></div><div className="level-track"><i style={{ width: s.current_level === 'ADVANCED' ? '90%' : s.current_level === 'INTERMEDIATE' ? '62%' : '32%' }}/></div></div>)}</div></section>

      <section className="panel goals-panel" id="goals"><SectionTitle eyebrow="EXECUTION" title="Goals & milestones" action={<div className="section-actions"><span className="summary-chip">{completedGoals}/{d.goals.length} complete</span><button className="mini" onClick={() => setModal('goal')}>＋ Add goal</button></div>}/><div className="goal-summary"><div><strong>{avgGoalProgress}%</strong><span>average goal progress</span></div><div className="summary-line"><span style={{ width: `${avgGoalProgress}%` }}/></div></div><div className="goal-list">{d.goals.map(g => <div className="goal" key={g.id}><div className="goal-main"><div><b>{g.title}</b><small>{g.current_minutes} / {g.target_minutes} minutes</small></div><strong>{Math.round(g.progress)}%</strong></div><div className="bar"><i style={{ width: `${Math.min(100, g.progress)}%` }}/></div></div>)}</div></section>

      <section className="lower-grid" id="activity"><div className="panel activity-panel"><SectionTitle eyebrow="PROOF OF WORK" title="Recent activity" action={<button className="mini" onClick={() => setModal('practice')}>＋ Log</button>}/><div className="activity-feed">{activity.length ? activity.map(a => <div className="activity-row" key={a.id}><div className="activity-icon">◷</div><div><b>{a.activity}</b><span>{a.skill} · {fmtMinutes(a.duration_minutes)}</span><small>{relativeTime(a.practiced_at)}</small></div></div>) : <div className="empty">Your first practice session will appear here.</div>}</div></div><div className="panel badges-panel"><SectionTitle eyebrow="MILESTONES" title="Badges & achievements" action={<span className="summary-chip">{badges?.unlocked || 0}/{badges?.total || 0}</span>}/><div className="badge-grid">{badges?.badges?.map(b => <div className={`badge-card ${b.unlocked ? 'unlocked' : ''}`} key={b.key}><span>{b.icon}</span><b>{b.title}</b><small>{b.unlocked ? 'Unlocked' : 'Locked'}</small></div>)}</div></div></section>

      <section className="lower-grid" id="evidence"><div className="panel action-panel"><SectionTitle eyebrow="EVIDENCE" title="Practice & files"/><div className="action-list"><button onClick={() => setModal('practice')}><span>◷</span><div><b>Log practice session</b><small>Capture activity, duration and notes</small></div><em>→</em></button><button onClick={() => setModal('file')}><span>↥</span><div><b>Upload learning evidence</b><small>PDF, JPG, PNG or WEBP → S3 storage</small></div><em>→</em></button><button onClick={() => setModal('goal')}><span>◎</span><div><b>Create a measurable goal</b><small>Connect a target to a skill</small></div><em>→</em></button></div></div><div className="panel signal-panel"><SectionTitle eyebrow="CUSTOMER VALUE" title="Why this product works"/><div className="value-list"><div><b>Structure</b><span>Goals turn vague intentions into measurable targets.</span></div><div><b>Momentum</b><span>Streaks, weekly progress and badges reinforce consistency.</span></div><div><b>Intelligence</b><span>Practice history becomes recommendations and forecasts.</span></div><div><b>Community</b><span>Sharing, likes and comments add accountability.</span></div></div></div></section>

      <section className="panel community-panel" id="community"><SectionTitle eyebrow="NETWORK" title="Community learning" action={<button className="mini" onClick={() => setModal('post')}>＋ Create post</button>}/><div className="feed">{posts.map(p => <article className="post" key={p.id}><div className="post-avatar">{(p.username || 'U').slice(0, 1).toUpperCase()}</div><div className="post-body"><div className="post-meta"><b>@{p.username}</b><span>{p.created_at ? relativeTime(p.created_at) : 'Community'}</span></div><p>{p.content}</p><div className="post-actions"><button className="social" disabled={busy} onClick={() => toggleLike(p)}>{p.liked ? '♥' : '♡'} {p.likes}</button><button className="social" onClick={() => { setCommentFor(commentFor === p.id ? null : p.id); setCommentText(''); }}>💬 {p.comments}</button></div>{commentFor === p.id && <div className="comment-box"><input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a constructive comment…"/><button disabled={busy || !commentText.trim()} onClick={() => addComment(p.id)}>Comment</button></div>}</div></article>)}</div></section>

      <footer className="footer"><span>SkillForge AI · Personal Learning Intelligence Platform</span><span>React · FastAPI · PostgreSQL · S3-compatible storage · scikit-learn</span></footer>
    </main>

    {modal === 'skill' && <Modal title="Add a skill" onClose={() => setModal(null)}><Field label="Skill name"><input value={skillForm.name} onChange={e => setSkillForm({...skillForm,name:e.target.value})} placeholder="e.g. FastAPI" /></Field><Field label="Category"><select value={skillForm.category} onChange={e => setSkillForm({...skillForm,category:e.target.value})}>{CATEGORIES.map(x => <option key={x}>{x}</option>)}</select></Field><div className="form-grid"><Field label="Current level"><select value={skillForm.current_level} onChange={e => setSkillForm({...skillForm,current_level:e.target.value})}>{LEVELS.map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Target level"><select value={skillForm.target_level} onChange={e => setSkillForm({...skillForm,target_level:e.target.value})}>{LEVELS.map(x => <option key={x}>{x}</option>)}</select></Field></div><Field label="Description"><textarea value={skillForm.description} onChange={e => setSkillForm({...skillForm,description:e.target.value})} placeholder="What outcome are you working toward?" /></Field><button disabled={busy || !skillForm.name.trim()} onClick={createSkill}>Create skill</button></Modal>}
    {modal === 'goal' && <Modal title="Create a goal" onClose={() => setModal(null)}><Field label="Skill"><select value={goalForm.skill_id} onChange={e => setGoalForm({...goalForm,skill_id:e.target.value})}><option value="">Select a skill</option>{skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Goal title"><input value={goalForm.title} onChange={e => setGoalForm({...goalForm,title:e.target.value})} placeholder="e.g. Ship a FastAPI project" /></Field><Field label="Target minutes"><input type="number" min="1" value={goalForm.target_minutes} onChange={e => setGoalForm({...goalForm,target_minutes:e.target.value})}/></Field><button disabled={busy || !goalForm.skill_id || !goalForm.title.trim()} onClick={createGoal}>Create goal</button></Modal>}
    {modal === 'practice' && <Modal title="Quick practice log" onClose={() => setModal(null)}><Field label="Skill"><select value={practiceForm.skill_id} onChange={e => setPracticeForm({...practiceForm,skill_id:e.target.value})}><option value="">Select a skill</option>{skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Duration (minutes)"><input type="number" min="1" max="1440" value={practiceForm.duration_minutes} onChange={e => setPracticeForm({...practiceForm,duration_minutes:e.target.value})}/></Field><Field label="Activity"><input value={practiceForm.activity} onChange={e => setPracticeForm({...practiceForm,activity:e.target.value})} placeholder="e.g. Implemented protected API routes"/></Field><Field label="Notes"><textarea value={practiceForm.notes} onChange={e => setPracticeForm({...practiceForm,notes:e.target.value})} placeholder="What did you learn or ship?"/></Field><Field label="Date & time"><input type="datetime-local" value={practiceForm.practiced_at} onChange={e => setPracticeForm({...practiceForm,practiced_at:e.target.value})}/></Field><button disabled={busy || !practiceForm.skill_id || !practiceForm.activity.trim()} onClick={logPractice}>Record practice</button>{selectedSkill && <small className="form-note">Recording against <b>{selectedSkill.name}</b> updates analytics, streaks, badges and AI insights.</small>}</Modal>}
    {modal === 'post' && <Modal title="Create community post" onClose={() => setModal(null)}><Field label="Post"><textarea className="large-textarea" maxLength="1000" value={postForm.content} onChange={e => setPostForm({content:e.target.value})} placeholder="Share a project milestone, learning insight, or useful resource…"/></Field><button disabled={busy || !postForm.content.trim()} onClick={createPost}>Publish post</button></Modal>}
    {modal === 'file' && <Modal title="Upload learning evidence" onClose={() => setModal(null)}><Field label="File"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)}/></Field><p className="muted small">Authenticated upload → S3-compatible object storage. Maximum 5 MB.</p><button disabled={busy || !file} onClick={handleUpload}>Upload to storage</button></Modal>}
  </div>;
}

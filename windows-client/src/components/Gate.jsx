import { useEffect, useRef, useState } from 'react';
export default function Gate() {
  const [code, setCode] = useState('');
  const [admin, setAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('open');
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const clicks = useRef({ count: 0, startedAt: 0 });
  useEffect(() => { function resetOnElsewhere(e) { if (!e.target.closest?.('[data-admin-trigger]')) clicks.current = { count: 0, startedAt: 0 }; } document.addEventListener('pointerdown', resetOnElsewhere); return () => document.removeEventListener('pointerdown', resetOnElsewhere); }, []);
  function revealAdmin() { const now = Date.now(); const prev = clicks.current; const count = now - prev.startedAt <= 5000 ? prev.count + 1 : 1; clicks.current = { count, startedAt: count === 1 ? now : prev.startedAt }; if (count >= 5) { clicks.current = { count: 0, startedAt: 0 }; setAdmin(true); setError(''); } }
  async function redeem(e) { e.preventDefault(); setBusy(true); setError(''); try { await window.pisonet.redeem(code.trim().toUpperCase()); } catch (err) { setError(err.message || 'Unable to redeem voucher'); } finally { setBusy(false); } }
  async function startAdmin(e) { e.preventDefault(); setBusy(true); setError(''); try { await window.pisonet.adminStart({ password, mode, minutes: Number(minutes) }); setPassword(''); } catch (err) { setError(err.message || 'Unable to start admin session'); } finally { setBusy(false); } }
  return <main className="gate"><section className="panel">
    <div className="brand">◈ PISONET CLOUD</div><div className="tag">PC 01 · {admin ? 'Administrator Access' : 'Voucher Access'}</div>
    {!admin ? <><h1>Ready to play?</h1><p>Purchase a voucher at the counter, then enter your code below.</p><form onSubmit={redeem}><label htmlFor="code">Voucher code</label><input id="code" autoFocus placeholder="Enter 18-character code" value={code} onChange={e=>setCode(e.target.value)} maxLength={30} autoComplete="off"/><button disabled={busy||!code.trim()}>{busy?'Activating...':'Activate session'}</button></form></> : <><h1>Admin access</h1><p>Enter your password to use this computer without a voucher.</p><form onSubmit={startAdmin}><label htmlFor="password">Admin password</label><input id="password" type="password" autoFocus autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter admin password"/><label htmlFor="mode" className="field-label">Access type</label><select id="mode" value={mode} onChange={e=>setMode(e.target.value)}><option value="open">Open time — unlimited</option><option value="timed">Timed admin access</option></select>{mode==='timed'&&<><label htmlFor="minutes" className="field-label">Minutes (1–1440)</label><input id="minutes" type="number" min="1" max="1440" value={minutes} onChange={e=>setMinutes(e.target.value)}/></>}<button disabled={busy||!password||(mode==='timed'&&(!Number.isInteger(Number(minutes))||Number(minutes)<1||Number(minutes)>1440))}>{busy?'Checking...':'Unlock computer'}</button></form><button className="secondary" onClick={()=>{setAdmin(false);setPassword('');setError('');}}>Back to voucher entry</button></>}
    {error&&<div className="error" role="alert">{error}</div>}
    <small>Prototype access screen — not a secure Windows kiosk lock.</small>
  </section>{!admin&&<button data-admin-trigger type="button" className="admin-secret-trigger" aria-label="System settings" title="System settings" onClick={revealAdmin}>◇</button>}</main>;
}

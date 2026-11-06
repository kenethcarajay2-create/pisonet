import { useEffect, useState } from 'react';
function format(ms) { const n = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(n / 3600)).padStart(2, '0')}:${String(Math.floor(n % 3600 / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; }
export default function Timer() {
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const refresh = () => window.pisonet.session().then(r => { if (mounted) setSession(r.session); }).catch(() => {});
    refresh();
    const tick = setInterval(() => setNow(Date.now()), 500);
    const sync = setInterval(refresh, 10000);
    return () => { mounted = false; clearInterval(tick); clearInterval(sync); };
  }, []);
  const admin = session?.type === 'admin';
  const open = admin && session.mode === 'open';
  const remaining = session?.expiresAt ? new Date(session.expiresAt).getTime() - now : 0;
  async function endAdmin() {
    if (!window.confirm('End admin access and return to voucher screen?')) return;
    setBusy(true); setError('');
    try { await window.pisonet.adminEnd(); }
    catch (err) { setError(err.message || 'Unable to end admin access'); setBusy(false); }
  }
  return <div className="timer">
    <div className="timer-label">PC 01 · {admin ? 'ADMIN ACCESS' : 'TIME REMAINING'}</div>
    <strong className={open ? 'open-label' : ''}>{session ? (open ? 'OPEN TIME' : format(remaining)) : 'Loading...'}</strong>
    {admin && <button className="return-button" disabled={busy} onClick={endAdmin}>{busy ? 'Ending...' : '↩ Return to voucher screen'}</button>}
    {error && <span className="timer-error" title={error}>Connection error — retry</span>}
  </div>;
}

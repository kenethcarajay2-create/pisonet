import { useEffect, useState } from 'react';

function format(ms) {
  const n = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(n / 3600)).padStart(2, '0')}:${String(Math.floor(n % 3600 / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

export default function Timer() {
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState('compact');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const poll = () => window.pisonet.session().then(result => {
      if (active) setSession(result.session);
    }).catch(() => {});
    poll();
    const tick = setInterval(() => setNow(Date.now()), 500);
    const sync = setInterval(poll, 10000);
    const unsubscribe = window.pisonet.onTimerMode?.(setMode);
    return () => { active = false; clearInterval(tick); clearInterval(sync); unsubscribe?.(); };
  }, []);

  async function changeMode(next) {
    try { await window.pisonet.setTimerMode(next); setMode(next); }
    catch (err) { setError(err.message || 'Unable to resize timer'); }
  }

  async function addTime(event) {
    event.preventDefault();
    if (busy || code.length !== 6) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await window.pisonet.redeem(code.trim().toUpperCase());
      setSession(result.session);
      setCode('');
      setMessage(`+${result.addedMinutes ?? '?'} min added`);
      await changeMode('compact');
    } catch (err) {
      setError(err.message || 'Unable to add time');
    } finally { setBusy(false); }
  }

  async function endAdmin() {
    if (!window.confirm('End admin access?')) return;
    setBusy(true); setError('');
    try { await window.pisonet.adminEnd(); }
    catch (err) { setError(err.message || 'Unable to end admin access'); setBusy(false); }
  }

  const admin = session?.type === 'admin';
  const open = admin && session.mode === 'open';
  const remaining = session?.expiresAt ? new Date(session.expiresAt).getTime() - now : 0;
  const display = session ? (open ? 'OPEN' : format(remaining)) : '--:--:--';

  if (mode === 'peek') return (
    <main className="timer-peek" title="Click to expand timer" onClick={() => changeMode('compact')}>
      <span className="peek-arrow">❮</span>
      <span className="peek-clock">◷</span>
      <span className="peek-minutes">{open ? '∞' : `${Math.max(0, Math.ceil(remaining / 60000))}m`}</span>
    </main>
  );

  return <main className="timer-compact">
    <header className="compact-header">
      <span>PC 01 · {admin ? 'ADMIN' : 'TIME LEFT'}</span>
      <button type="button" className="compact-collapse" title="Collapse to screen edge" onClick={() => changeMode('peek')}>❯</button>
    </header>
    <div className="compact-time">{display}</div>
    {mode === 'add' ? (
      <form className="compact-add-form" onSubmit={addTime}>
        <label htmlFor="voucher-code">ADD TIME · 6-CHARACTER VOUCHER</label>
        <input id="voucher-code" autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} maxLength={6} placeholder="ABC123" autoComplete="off" />
        <div className="compact-actions">
          <button type="button" className="compact-secondary" onClick={() => changeMode('compact')}>Cancel</button>
          <button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Wait...' : 'Redeem'}</button>
        </div>
        {error && <div className="compact-feedback error-text" title={error}>{error}</div>}
      </form>
    ) : (
      <div className="compact-footer">
        {admin ? <button type="button" onClick={endAdmin} disabled={busy}>End admin</button> : <button type="button" onClick={() => changeMode('add')}>+ Add time</button>}
        {message && <span className="compact-feedback">{message}</span>}
      </div>
    )}
  </main>;
}

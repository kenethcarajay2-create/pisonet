import { useEffect, useState } from 'react';

function format(ms) {
  const n = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(n / 3600)).padStart(2, '0')}:${String(Math.floor(n % 3600 / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

export default function Timer() {
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const response = await window.pisonet.session();
    setSession(response.session);
  }

  useEffect(() => {
    let mounted = true;
    const poll = () => window.pisonet.session().then(response => {
      if (mounted) setSession(response.session);
    }).catch(() => {});
    poll();
    const tick = setInterval(() => setNow(Date.now()), 500);
    const sync = setInterval(poll, 10000);
    return () => { mounted = false; clearInterval(tick); clearInterval(sync); };
  }, []);

  const admin = session?.type === 'admin';
  const open = admin && session.mode === 'open';
  const remaining = session?.expiresAt ? new Date(session.expiresAt).getTime() - now : 0;

  async function addTime(event) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await window.pisonet.redeem(code.trim().toUpperCase());
      setSession(result.session);
      setCode('');
      setNotice(`Added ${result.addedMinutes} minutes!`);
      await refresh();
    } catch (err) {
      setError(err.message || 'Unable to add time');
    } finally { setBusy(false); }
  }

  async function endAdmin() {
    if (!window.confirm('End admin access and return to voucher screen?')) return;
    setBusy(true); setError('');
    try { await window.pisonet.adminEnd(); }
    catch (err) { setError(err.message || 'Unable to end admin access'); setBusy(false); }
  }

  return <main className="timer">
    <div className="timer-top">
      <span>PC 01 · {admin ? 'ADMIN ACCESS' : 'TIME REMAINING'}</span>
      <button type="button" className="timer-minimize" title="Minimize to taskbar" onClick={() => window.pisonet.minimize()}>—</button>
    </div>
    <strong className={open ? 'open-label' : ''}>{session ? (open ? 'OPEN TIME' : format(remaining)) : 'Loading...'}</strong>
    {!admin && <form className="topup-form" onSubmit={addTime}>
      <label htmlFor="topup-code">Add more time with another voucher</label>
      <div className="topup-row">
        <input id="topup-code" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 6))} maxLength={6} placeholder="6-char code" autoComplete="off" />
        <button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Wait...' : 'Add time'}</button>
      </div>
    </form>}
    {admin && <button className="return-button" disabled={busy} onClick={endAdmin}>{busy ? 'Ending...' : 'Return to voucher screen'}</button>}
    {notice && <span className="timer-notice">{notice}</span>}
    {error && <span className="timer-error" title={error}>{error}</span>}
    <span className="timer-help">Minimize to taskbar to play. Restore from taskbar anytime.</span>
  </main>;
}

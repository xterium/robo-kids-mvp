'use client';

import { FormEvent, useState } from 'react';

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };

      if (data.ok) {
        sessionStorage.setItem('robo_authed', '1');
        onUnlock();
      } else {
        setError(data.error || 'Wrong code. Try again.');
        setCode('');
      }
    } catch {
      setError('Could not connect. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lockShell">
      <div className="lockCard">
        <div className="robot lockRobot" aria-hidden="true">
          <div className="antenna" />
          <div className="robot-head">
            <div className="robot-face">
              <div className="eyeRow">
                <div className="eye" />
                <div className="eye" />
              </div>
              <div className="mouth" />
            </div>
          </div>
          <div className="robot-body">
            <div className="screen" />
          </div>
        </div>

        <h1 className="lockTitle">Robo Kids</h1>
        <p className="lockSub">Enter your access code to continue.</p>

        <form onSubmit={handleSubmit} className="lockForm">
          <input
            className="input lockInput"
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            autoFocus
            autoComplete="current-password"
          />
          {error && <p className="lockError">{error}</p>}
          <button className="btn btnPrimary lockBtn" type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Unlock 🔓'}
          </button>
        </form>
      </div>
    </div>
  );
}

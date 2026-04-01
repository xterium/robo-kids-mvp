'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { LockScreen } from './lock-screen';

type ChatMessage = {
  role: 'user' | 'robot';
  text: string;
};

const starterPrompts = [
  'Spune-i lui Robo cum te cheamă.',
  'Roagă-l pe Robo să-ți spună o poveste scurtă.',
  'Spune-i ce joc îți place.',
];

export function RoboApp() {
  const [authed, setAuthed] = useState(false);
  const [childName, setChildName] = useState('Evelina');
  const [message, setMessage] = useState('Bună Robo! Mă numesc Evelina.');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (sessionStorage.getItem('robo_authed') === '1') {
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'robot',
      text: 'Bună! Eu sunt Robo. Locuiesc în acest ecran. Ce jucăm azi?',
    },
  ]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const lastRobotMessage = useMemo(
    () => [...messages].reverse().find((msg) => msg.role === 'robot')?.text ?? '',
    [messages]
  );

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ro-RO';
    utterance.rate = 0.92;
    utterance.pitch = 1.15;
    // Prefer a native ro-RO voice; fall back to any ro voice, then default
    const voices = voicesRef.current;
    const roVoice =
      voices.find((v) => v.lang === 'ro-RO') ||
      voices.find((v) => v.lang.startsWith('ro'));
    if (roVoice) utterance.voice = roVoice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextMessages);
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: childName, message: trimmed }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };
      const reply = data.reply?.trim() || data.error || 'Robo a avut un mic accident. Putem încerca din nou?';
      setMessages([...nextMessages, { role: 'robot', text: reply }]);
      speak(reply);
    } catch {
      const fallback = 'Am avut un mic incident. Putem încerca din nou?';
      setMessages([...nextMessages, { role: 'robot', text: fallback }]);
      speak(fallback);
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return <LockScreen onUnlock={() => setAuthed(true)} />;
  }

  return (
    <div className="shell">
      <div className="hero">
        <div className="topbar">
          <div>
            <div className="badge">🤖 Robo Kids MVP</div>
          </div>
          <div className="small">Aplicație mobilă pentru copii</div>
        </div>

        <div className="grid">
          <section className="card avatarCard">
            <div className="badge">Robotul tău de joacă</div>
            <h1 className="h1">Robo locuiește în ecran.</h1>
            <p className="sub">
              Robo este prietenul tău robot. Scrie-i un mesaj și el îți va răspunde cu voce!
            </p>

            <div className="avatarWrap" aria-hidden="true">
              <div className="robot">
                <div className="antenna" />
                <div className="robot-head">
                  <div className="robot-face">
                    <div className="eyeRow">
                      <div className="eye" />
                      <div className="eye" />
                    </div>
                    <div className={`mouth ${speaking ? 'talking' : ''}`} />
                  </div>
                </div>
                <div className="robot-body">
                  <div className="screen" />
                </div>
              </div>
            </div>

            <div className="controls">
              <button className="btn btnPrimary" type="button" onClick={() => speak(lastRobotMessage || 'Bună! Eu sunt Robo.')}>Ascultă răspunsul</button>
              <button className="btn btnGhost" type="button" onClick={stopSpeaking}>Oprește vocea</button>
            </div>

            <div className="helperList">
              {starterPrompts.map((prompt) => (
                <div key={prompt}>• {prompt}</div>
              ))}
            </div>
          </section>

          <section className="card chatCard">
            <div className="badge">Chat cu Robo</div>
            <form onSubmit={sendMessage}>
              <label className="fieldLabel" htmlFor="name">Porecla copilului</label>
              <input
                id="name"
                className="input"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="Evelina"
              />

              <div className="chatLog" aria-live="polite">
                {messages.map((item, index) => (
                  <div key={`${item.role}-${index}`} className={`bubble ${item.role}`}>
                    {item.text}
                  </div>
                ))}
              </div>

              <label className="fieldLabel" htmlFor="message">Spune ceva lui Robo</label>
              <textarea
                id="message"
                className="textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Bună Robo!"
              />

              <div className="controls" style={{ marginTop: 12 }}>
                <button className="btn btnPrimary" type="submit" disabled={loading}>
                  {loading ? 'Robo se gândește…' : 'Trimite lui Robo'}
                </button>
                <button
                  className="btn btnGhost"
                  type="button"
                  onClick={() => setMessages([{ role: 'robot', text: 'Bună! Eu sunt Robo. Ce jucăm azi?' }])}
                >
                  Resetează chat
                </button>
              </div>
            </form>

            <p className="footerNote">
              Pasul următor: înlocuiește caseta de text cu audio push-to-talk și adaugă modul părinte, memorie și billing.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

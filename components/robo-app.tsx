'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { LockScreen } from './lock-screen';

type ChatMessage = {
  role: 'user' | 'robot';
  text: string;
};

const starterPrompts = [
  'Tell Robo your name.',
  'Ask Robo to tell a tiny story.',
  'Say what game you like to play.',
];

export function RoboApp() {
  const [authed, setAuthed] = useState(false);
  const [childName, setChildName] = useState('Evelina');
  const [message, setMessage] = useState('Hi Robo! My name is Evelina.');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('robo_authed') === '1') {
      setAuthed(true);
    }
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'robot',
      text: 'Hello! I am Robo. I live in this screen. What should we play today?',
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
    utterance.rate = 0.95;
    utterance.pitch = 1.18;
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
      const reply = data.reply?.trim() || data.error || 'Robo had a tiny hiccup. Can we try again?';
      setMessages([...nextMessages, { role: 'robot', text: reply }]);
      speak(reply);
    } catch {
      const fallback = 'I had a little robot hiccup. Can you try again?';
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
          <div className="small">Mobile-first PWA starter</div>
        </div>

        <div className="grid">
          <section className="card avatarCard">
            <div className="badge">Playful robot avatar</div>
            <h1 className="h1">Robo lives in the screen.</h1>
            <p className="sub">
              This starter already includes a kid-safe prompt, a talking robot face, PWA setup, and a server route for OpenAI.
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
              <button className="btn btnPrimary" type="button" onClick={() => speak(lastRobotMessage || 'Hi! I am Robo.')}>Speak last reply</button>
              <button className="btn btnGhost" type="button" onClick={stopSpeaking}>Stop voice</button>
            </div>

            <div className="helperList">
              {starterPrompts.map((prompt) => (
                <div key={prompt}>• {prompt}</div>
              ))}
            </div>
          </section>

          <section className="card chatCard">
            <div className="badge">Chat test panel</div>
            <form onSubmit={sendMessage}>
              <label className="fieldLabel" htmlFor="name">Child nickname</label>
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

              <label className="fieldLabel" htmlFor="message">Say something to Robo</label>
              <textarea
                id="message"
                className="textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi Robo!"
              />

              <div className="controls" style={{ marginTop: 12 }}>
                <button className="btn btnPrimary" type="submit" disabled={loading}>
                  {loading ? 'Robo is thinking…' : 'Send to Robo'}
                </button>
                <button
                  className="btn btnGhost"
                  type="button"
                  onClick={() => setMessages([{ role: 'robot', text: 'Hello! I am Robo. What should we play today?' }])}
                >
                  Reset chat
                </button>
              </div>
            </form>

            <p className="footerNote">
              Next step: replace the text box with push-to-talk audio and add parent mode, memory, and billing.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

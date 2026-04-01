'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { LockScreen } from './lock-screen';

type ChatMessage = {
  role: 'user' | 'robot';
  text: string;
};

type Lang = 'ro' | 'en';

const translations = {
  ro: {
    starters: [
      'Spune-i lui Robo cum te cheamă.',
      'Roagă-l pe Robo să-ți spună o poveste scurtă.',
      'Spune-i ce joc îți place.',
    ],
    subtitle: 'Aplicație mobilă pentru copii',
    avatarBadge: 'Robotul tău de joacă',
    h1: 'Robo locuiește în ecran.',
    sub: 'Robo este prietenul tău robot. Scrie-i un mesaj și el îți va răspunde cu voce!',
    speakBtn: 'Ascultă răspunsul',
    stopBtn: 'Oprește vocea',
    chatBadge: 'Chat cu Robo',
    nickname: 'Porecla copilului',
    sayLabel: 'Spune ceva lui Robo',
    placeholder: 'Bună Robo!',
    send: 'Trimite lui Robo',
    thinking: 'Robo se gândește…',
    reset: 'Resetează chat',
    initialMsg: 'Bună! Eu sunt Robo. Locuiesc în acest ecran. Ce jucăm azi?',
    hiccup: 'Robo a avut un mic accident. Putem încerca din nou?',
    fallback: 'Am avut un mic incident. Putem încerca din nou?',
    footerNote: 'Pasul următor: înlocuiește caseta de text cu audio push-to-talk și adaugă modul părinte, memorie și billing.',
  },
  en: {
    starters: [
      'Tell Robo your name.',
      'Ask Robo to tell a tiny story.',
      'Say what game you like to play.',
    ],
    subtitle: 'Mobile-first app for kids',
    avatarBadge: 'Your playful robot',
    h1: 'Robo lives in the screen.',
    sub: 'Robo is your robot friend. Send a message and he will reply with voice!',
    speakBtn: 'Listen to reply',
    stopBtn: 'Stop voice',
    chatBadge: 'Chat with Robo',
    nickname: 'Child nickname',
    sayLabel: 'Say something to Robo',
    placeholder: 'Hi Robo!',
    send: 'Send to Robo',
    thinking: 'Robo is thinking…',
    reset: 'Reset chat',
    initialMsg: 'Hello! I am Robo. I live in this screen. What should we play today?',
    hiccup: 'Robo had a tiny hiccup. Can we try again?',
    fallback: 'I had a little robot hiccup. Can you try again?',
    footerNote: 'Next step: replace the text box with push-to-talk audio and add parent mode, memory, and billing.',
  },
} as const;

export function RoboApp() {
  const [authed, setAuthed] = useState(false);
  const [lang, setLang] = useState<Lang>('ro');
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
    { role: 'robot', text: translations.ro.initialMsg },
  ]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const t = translations[lang];

  const lastRobotMessage = useMemo(
    () => [...messages].reverse().find((msg) => msg.role === 'robot')?.text ?? '',
    [messages]
  );

  const speak = (text: string, overrideLang?: Lang) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const activeLang = overrideLang ?? lang;
    const bcp47 = activeLang === 'ro' ? 'ro-RO' : 'en-US';
    utterance.lang = bcp47;
    utterance.rate = 0.92;
    utterance.pitch = 1.15;
    const voices = voicesRef.current;
    const voice =
      voices.find((v) => v.lang === bcp47) ||
      voices.find((v) => v.lang.startsWith(activeLang));
    if (voice) utterance.voice = voice;
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

      const data = (await res.json()) as { reply?: string; error?: string; lang?: Lang };
      const detectedLang: Lang = data.lang ?? lang;
      setLang(detectedLang);
      const reply = data.reply?.trim() || data.error || translations[detectedLang].hiccup;
      setMessages([...nextMessages, { role: 'robot', text: reply }]);
      speak(reply, detectedLang);
    } catch {
      const fallback = t.fallback;
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
          <div className="small">{t.subtitle}</div>
        </div>

        <div className="grid">
          <section className="card avatarCard">
            <div className="badge">{t.avatarBadge}</div>
            <h1 className="h1">{t.h1}</h1>
            <p className="sub">{t.sub}</p>

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
              <button className="btn btnPrimary" type="button" onClick={() => speak(lastRobotMessage)}>{t.speakBtn}</button>
              <button className="btn btnGhost" type="button" onClick={stopSpeaking}>{t.stopBtn}</button>
            </div>

            <div className="helperList">
              {t.starters.map((prompt) => (
                <div key={prompt}>• {prompt}</div>
              ))}
            </div>
          </section>

          <section className="card chatCard">
            <div className="badge">{t.chatBadge}</div>
            <form onSubmit={sendMessage}>
              <label className="fieldLabel" htmlFor="name">{t.nickname}</label>
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

              <label className="fieldLabel" htmlFor="message">{t.sayLabel}</label>
              <textarea
                id="message"
                className="textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.placeholder}
              />

              <div className="controls" style={{ marginTop: 12 }}>
                <button className="btn btnPrimary" type="submit" disabled={loading}>
                  {loading ? t.thinking : t.send}
                </button>
                <button
                  className="btn btnGhost"
                  type="button"
                  onClick={() => setMessages([{ role: 'robot', text: t.initialMsg }])}
                >
                  {t.reset}
                </button>
              </div>
            </form>

            <p className="footerNote">{t.footerNote}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

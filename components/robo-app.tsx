'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LockScreen } from './lock-screen';

type ChatMessage = {
  role: 'user' | 'robot';
  text: string;
};

type Lang = 'ro' | 'en';

// SpeechRecognition is not in all TS lib typings yet
interface ISpeechRecognitionEvent {
  results: SpeechRecognitionResultList | { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } };
}

interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
}
type SpeechRecognitionCtor = new () => ISpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

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
    sub: 'Apasă butonul și vorbește cu Robo!',
    speakBtn: 'Ascultă răspunsul',
    stopBtn: 'Oprește vocea',
    chatBadge: 'Chat cu Robo',
    nickname: 'Porecla copilului',
    micStart: 'Ține apăsat și vorbește 🎤',
    micListening: 'Te ascult… 👂',
    micNoSupport: 'Microfonul nu e disponibil pe acest dispozitiv.',
    thinking: 'Robo se gândește…',
    heard: 'Ai spus:',
    reset: 'Resetează chat',
    initialMsg: 'Bună! Eu sunt Robo. Locuiesc în acest ecran. Ce jucăm azi?',
    hiccup: 'Robo a avut un mic accident. Putem încerca din nou?',
    fallback: 'Am avut un mic incident. Putem încerca din nou?',
    footerNote: '',
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
    sub: 'Press the button and talk to Robo!',
    speakBtn: 'Listen to reply',
    stopBtn: 'Stop voice',
    chatBadge: 'Chat with Robo',
    nickname: 'Child nickname',
    micStart: 'Hold & speak 🎤',
    micListening: 'Listening… 👂',
    micNoSupport: 'Microphone not available on this device.',
    thinking: 'Robo is thinking…',
    heard: 'You said:',
    reset: 'Reset chat',
    initialMsg: 'Hello! I am Robo. I live in this screen. What should we play today?',
    hiccup: 'Robo had a tiny hiccup. Can we try again?',
    fallback: 'I had a little robot hiccup. Can you try again?',
    footerNote: '',
  },
} as const;

export function RoboApp() {
  const [authed, setAuthed] = useState(false);
  const [lang, setLang] = useState<Lang>('ro');
  const [childName, setChildName] = useState('Evelina');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

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

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextMessages);
    setTranscript('');
    setLoading(true);

    // Build sliding-window history: last 10 messages before the new one
    const HISTORY_WINDOW = 10;
    const history = messages.slice(-HISTORY_WINDOW);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: childName, message: trimmed, history }),
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

  const startListening = () => {
    if (loading || speaking) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t.micNoSupport);
      return;
    }
    window.speechSynthesis.cancel();
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'ro' ? 'ro-RO' : 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (e: ISpeechRecognitionEvent) => {
      const result = e.results[e.results.length - 1];
      setTranscript(result[0].transcript);
      if (result.isFinal) {
        recognition.stop();
      }
    };
    recognition.onend = () => {
      setListening(false);
      setTranscript((prev) => {
        if (prev.trim()) sendMessage(prev);
        return prev;
      });
    };
    recognition.onerror = () => setListening(false);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
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
          <div className="small">{t.subtitle} · {lang.toUpperCase()}</div>
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
              {loading && (
                <div className="bubble robot thinking">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                </div>
              )}
            </div>

            {transcript && !loading && (
              <p className="transcriptPreview">
                <span className="transcriptLabel">{t.heard}</span> {transcript}
              </p>
            )}

            <div className="micWrap">
              <button
                className={`micBtn ${listening ? 'micActive' : ''} ${loading ? 'micDisabled' : ''}`}
                type="button"
                onPointerDown={startListening}
                onPointerUp={stopListening}
                onPointerLeave={stopListening}
                disabled={loading}
                aria-label={listening ? t.micListening : t.micStart}
              >
                <span className="micIcon">{listening ? '👂' : '🎤'}</span>
                <span className="micLabel">{loading ? t.thinking : listening ? t.micListening : t.micStart}</span>
              </button>

              <button
                className="btn btnGhost resetBtn"
                type="button"
                onClick={() => { setMessages([{ role: 'robot', text: t.initialMsg }]); setTranscript(''); }}
              >
                {t.reset}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

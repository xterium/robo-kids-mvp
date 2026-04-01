'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LockScreen } from './lock-screen';

type ChatMessage = {
  role: 'user' | 'robot';
  text: string;
};

type Lang = 'ro' | 'en';

type ChildProfile = {
  name?: string;
  favoriteColor?: string;
  favoriteAnimal?: string;
  friendName?: string;
  kindergarten?: string;
  interests?: string[];
};

function mergeProfile(current: ChildProfile, update: Record<string, unknown>): ChildProfile {
  const merged = { ...current };
  if (update.name && typeof update.name === 'string') merged.name = update.name;
  if (update.favoriteColor && typeof update.favoriteColor === 'string') merged.favoriteColor = update.favoriteColor;
  if (update.favoriteAnimal && typeof update.favoriteAnimal === 'string') merged.favoriteAnimal = update.favoriteAnimal;
  if (update.friendName && typeof update.friendName === 'string') merged.friendName = update.friendName;
  if (update.kindergarten && typeof update.kindergarten === 'string') merged.kindergarten = update.kindergarten;
  if (Array.isArray(update.interests) && update.interests.length > 0) {
    merged.interests = [...new Set([...(merged.interests ?? []), ...update.interests as string[]])];
  }
  return merged;
}

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
  onerror: ((e: Event & { error?: string }) => void) | null;
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
    exportLog: 'Exportă conversația',
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
    exportLog: 'Export conversation',
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
  const [childProfile, setChildProfile] = useState<ChildProfile>({});

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const summaryRef = useRef('');
  const transcriptRef = useRef('');

  useEffect(() => {
    if (sessionStorage.getItem('robo_authed') === '1') {
      setAuthed(true);
    }
    try {
      const saved = sessionStorage.getItem('robo_profile');
      if (saved) setChildProfile(JSON.parse(saved) as ChildProfile);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('robo_profile', JSON.stringify(childProfile));
  }, [childProfile]);

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

  // Persist conversation log to sessionStorage on every update
  useEffect(() => {
    sessionStorage.setItem('robo_log', JSON.stringify(messages));
  }, [messages]);

  const exportLog = () => {
    const lines = messages.map((m) => {
      const who = m.role === 'robot' ? 'Robo' : childName || 'Copil';
      return `[${who}] ${m.text}`;
    });
    const blob = new Blob([lines.join('\n\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robo-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

    // Last 8 messages as raw history; anything older is covered by the rolling summary
    const history = messages.slice(-8);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: childName,
          message: trimmed,
          history,
          summary: summaryRef.current,
          childProfile,          lang,        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        lang?: Lang;
        profileUpdate?: Record<string, unknown>;
      };
      const reply = data.reply?.trim() || data.error || t.hiccup;

      const updatedMessages: ChatMessage[] = [...nextMessages, { role: 'robot', text: reply }];
      setMessages(updatedMessages);

      // Merge any newly learned profile facts
      if (data.profileUpdate && Object.keys(data.profileUpdate).length > 0) {
        setChildProfile((prev) => mergeProfile(prev, data.profileUpdate!));
      }

      // At every 10-turn milestone, compress older messages into the rolling summary
      const exchangeCount = updatedMessages.length - 1; // exclude initial greeting
      if (exchangeCount > 0 && exchangeCount % 10 === 0) {
        const toSummarize = updatedMessages.slice(0, updatedMessages.length - 8);
        void fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: toSummarize, existingSummary: summaryRef.current }),
        })
          .then((r) => r.json())
          .then((d: { summary?: string }) => { if (d.summary) summaryRef.current = d.summary; })
          .catch(() => {});
      }

      speak(reply, lang);
    } catch {
      const fallback = t.fallback;
      setMessages([...nextMessages, { role: 'robot', text: fallback }]);
      speak(fallback);
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    if (loading) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t.micNoSupport);
      return;
    }
    // Cancel any ongoing speech and reset state immediately.
    // On mobile, utterance.onend often never fires, leaving speaking=true forever.
    window.speechSynthesis.cancel();
    setSpeaking(false);
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'ro' ? 'ro-RO' : 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    transcriptRef.current = '';
    recognition.onstart = () => setListening(true);
    recognition.onresult = (e: ISpeechRecognitionEvent) => {
      const result = e.results[e.results.length - 1];
      transcriptRef.current = result[0].transcript;
      setTranscript(transcriptRef.current);
      if (result.isFinal) {
        recognition.stop();
      }
    };
    recognition.onend = () => {
      setListening(false);
      const spoken = transcriptRef.current.trim();
      if (spoken) {
        transcriptRef.current = '';
        setTranscript('');
        sendMessage(spoken);
      }
    };
    recognition.onerror = (e: Event & { error?: string }) => {
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        alert(lang === 'ro'
          ? 'Microfonul este blocat. Deschide Setări > Safari/Chrome > Microfon și permite accesul, apoi reîncarcă pagina.'
          : 'Microphone is blocked. Go to Settings > Safari/Chrome > Microphone, allow access, then reload the page.');
      }
    };
    // Set listening immediately — onstart may never fire on mobile browsers
    setListening(true);
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
          <button
            className="btn langToggle"
            type="button"
            onClick={() => setLang((l) => l === 'ro' ? 'en' : 'ro')}
            aria-label="Switch language"
          >
            {lang === 'ro' ? '🇷🇴 RO' : '🇬🇧 EN'}
          </button>
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

              <button
                className="btn btnGhost resetBtn"
                type="button"
                onClick={exportLog}
              >
                {t.exportLog}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

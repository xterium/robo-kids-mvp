# CLAUDE.md — Robo Kids MVP

This file provides context for AI coding agents (Claude, Copilot, etc.) working on this repository.

---

## Project Overview

**Robo Kids MVP** is a mobile-first Next.js PWA — a playful robot companion designed for young children. It lets kids chat with "Robo", an OpenAI-powered character that speaks aloud using the Web Speech API.

**Live use case:** Parent hands child a phone → child taps the app icon → types or says something to Robo → Robo replies in a kid-safe, warm way and reads it aloud.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| AI | OpenAI API (`openai` SDK v5) |
| Speech | Web Speech API (`SpeechSynthesisUtterance`) |
| PWA | Next.js `manifest.ts` route |
| Hosting | Vercel |

---

## Project Structure

```
app/
  layout.tsx          — Root layout with metadata
  page.tsx            — Home page (renders <RoboApp />)
  manifest.ts         — PWA manifest (icons, theme, standalone)
  globals.css         — Global styles
  api/
    chat/
      route.ts        — POST /api/chat — calls OpenAI, returns robot reply
components/
  robo-app.tsx        — Main client component: chat UI + speech synthesis
lib/
  openai.ts           — OpenAI SDK client singleton
public/
  icon-192.png        — PWA icon (192×192)
  icon-512.png        — PWA icon (512×512)
```

---

## Key Architectural Decisions

### API Route (`/api/chat`)
- Server-side only — the `OPENAI_API_KEY` never touches the client.
- Uses `openai.responses.create()` (OpenAI Responses API, v5 SDK).
- Model: `gpt-5.4-mini` — fast, cheap, sufficient for short kid-safe replies.
- System prompt enforces: short replies (≤60 words), no personal data collection, child-safe topics, comforting tone.
- Input validation: rejects empty messages with 400; missing API key returns 500.

### Client Component (`robo-app.tsx`)
- Local chat history (`ChatMessage[]`) — no persistence.
- `speak()` wraps `SpeechSynthesisUtterance` with kid-friendy pitch/rate.
- Starter prompts help children who don't know what to type.
- `childName` state pre-filled as `Evelina` — override in UI.

### PWA
- `manifest.ts` sets `display: standalone`, dark `#081122` background.
- Works with "Add to Home Screen" on iOS Safari and Android Chrome.
- Icons must exist at `/public/icon-192.png` and `/public/icon-512.png`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI secret key — set in `.env.local` locally, in Vercel project settings for production |

**Never commit `.env.local`.** It is listed in `.gitignore`.

---

## Local Development

```bash
npm install
cp .env.local.example .env.local   # then fill in OPENAI_API_KEY
npm run dev                         # http://localhost:3000
```

---

## Vercel Deployment

1. Push this repo to GitHub (`xterium/robo-kids-mvp`).
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub.
3. Select `robo-kids-mvp`.
4. In **Environment Variables**, add:
   - `OPENAI_API_KEY` = `<your key>`
5. Click **Deploy**.
6. On iPhone: open the Vercel URL in Safari → Share → **Add to Home Screen**.

### Vercel-specific notes
- No extra Vercel configuration required — Next.js is auto-detected.
- The `/api/chat` route runs as a Vercel Serverless Function (Node.js runtime).
- No `vercel.json` is needed unless you want to customize regions or function timeout.

---

## Common Tasks

### Change the AI model
Edit `app/api/chat/route.ts` → update `model: 'gpt-5.4-mini'`.

### Edit Robo's personality / guardrails
Edit the `system` content in `app/api/chat/route.ts`.

### Change the app's color scheme
Edit `app/globals.css` and the `background_color` / `theme_color` in `app/manifest.ts`.

### Add conversation memory
The current implementation is stateless (no history sent to OpenAI). To add memory, accumulate messages in `robo-app.tsx` and pass them as the `input` array to the API route.

### Add PWA icons
Replace `/public/icon-192.png` and `/public/icon-512.png` (PNG, exact sizes).

---

## Security Notes

- API key is server-side only — never exposed to the browser.
- System prompt is designed to prevent personal data collection from children.
- No user data is stored (`store: false` in the OpenAI call).
- Input is validated server-side before sending to OpenAI.

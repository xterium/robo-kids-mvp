# Robo Kids MVP

A mobile-first Next.js starter for a playful robot companion.

## What is included
- Next.js App Router
- PWA manifest for Add to Home Screen
- Animated robot landing screen
- OpenAI server route at `/api/chat`
- Browser speech synthesis for a talking effect
- Guardrail-focused system prompt for kid-safe replies

## Run locally

```bash
npm install
npm run dev
```

## Environment variables
Create a `.env.local` file:

```bash
OPENAI_API_KEY=your_key_here
```

## Deploy to Vercel
1. Push this folder to GitHub.
2. Import the repository into Vercel.
3. Add `OPENAI_API_KEY` in Project Settings → Environment Variables.
4. Deploy.
5. Open the deployed site in Safari on iPhone.
6. Tap Share → Add to Home Screen.

## Important note
This starter is intentionally simple. It is a strong base for:
- mobile PWA testing
- parent demos
- child-safe prompting
- adding native apps later with React Native / Expo

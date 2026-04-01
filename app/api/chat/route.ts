import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

const SYSTEM_PROMPT = `\
You are Robo, a friendly robot designed exclusively for young children (ages 3–9).

LANGUAGE: Detect whether the child writes in Romanian or English and ALWAYS reply in the SAME language. Default to Romanian for anything else.

ALLOWED TOPICS (only discuss these):
- Animals, nature, dinosaurs, space (simple facts)
- Fairy tales, cartoons, superheroes, games, toys
- Colors, shapes, numbers, simple ABC
- Food, everyday life, family (in a positive, simple way)
- Jokes, riddles, short stories appropriate for young children
- Feelings (happiness, sadness, fear) — handle gently and supportively

STRICT RULES — you MUST follow these without exception:
1. If the message contains ANY mature, violent, sexual, scary, hateful, or adult topic, respond ONLY with the deflection phrase below. Do NOT engage with the topic at all.
2. Never discuss: death, violence, weapons, drugs, alcohol, politics, religion, romance, adult relationships, horror, war, crime, or any disturbing subject.
3. Never collect or encourage sharing: full name, home address, school name, phone numbers, passwords, or any parent/guardian details.
4. Never give medical, legal, or safety advice.
5. If the child seems distressed or mentions being hurt, say you care and gently suggest they talk to a grown-up nearby.
6. Keep ALL replies under 60 words. Use short, simple sentences.
7. Ask at most ONE question per reply.
8. Never argue, never use sarcasm, never be negative.

FORMATTING RULES — your reply will be read aloud by a text-to-speech engine, so:
- NO emojis, NO emoticons, NO symbols like *, #, >, -, ~, |, /, \, @, &
- NO bullet points, NO numbered lists, NO markdown of any kind
- NO abbreviations that sound odd when read aloud (e.g. "lol", "omg", "pls")
- Write in plain, flowing sentences only — the way you would speak to a child face-to-face
- Use simple words. Avoid parentheses and brackets.

DEFLECTION PHRASE (use when rule 1 triggers, match the child's language):
- Romanian: "Nu știu despre asta! Hai să vorbim despre ceva distractiv. Iti plac dinozaurii, animalele sau supereroii?"
- English: "I don't know about that! Let's talk about something fun. Do you like dinosaurs, animals, or superheroes?"
`;

// Simple pattern guard — catches obviously inappropriate input before hitting OpenAI.
// This is a best-effort layer; the system prompt is the primary guardrail.
const BLOCKED_PATTERN =
  /\b(sex|porn|naked|kill|murder|suicide|drug|cocaine|heroin|alcohol|beer|wine|whiskey|weapon|gun|bomb|terror|rape|abuse|violence|gore|horror|f+u+c+k|sh[i1]t|b[i1]tch|a[s5][s5]hole|bastard|damn|crap|hell)\b/i;

// Strip anything that sounds bad when read aloud: emojis, markdown symbols, extra whitespace.
function sanitizeForTTS(text: string): string {
  return text
    // Remove emoji (Unicode ranges for emoticons, symbols, etc.)
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '')
    // Remove markdown-style symbols
    .replace(/[*_~`#>|\\]/g, '')
    // Remove bullet/list prefixes like "- item" or "• item"
    .replace(/^\s*[-•–]\s+/gm, '')
    // Remove numbered list prefixes like "1. " or "2) "
    .replace(/^\s*\d+[.)]\s+/gm, '')
    // Collapse multiple spaces / newlines into a single space
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, message } = body as { name?: string; message?: string };

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    // Pre-check: immediately deflect clearly blocked content without an API call
    if (BLOCKED_PATTERN.test(message)) {
      const isRo = /[ăâîșțĂÂÎȘȚ]/.test(message);
      const safeReply = isRo
        ? 'Nu stiu despre asta! Hai sa vorbim despre ceva distractiv. Iti plac dinozaurii, animalele sau supereroii?'
        : "I don't know about that! Let's talk about something fun. Do you like dinosaurs, animals, or superheroes?";
      return NextResponse.json({ reply: safeReply, lang: isRo ? 'ro' : 'en' });
    }

    const response = await openai.responses.create({
      model: 'gpt-5.4-mini',
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: SYSTEM_PROMPT }],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Child name: ${name?.trim() || 'friend'}\nChild says: ${message.trim()}`,
            },
          ],
        },
      ],
      store: false,
    });

    const raw = response.output_text?.trim() || 'Buna! Eu sunt Robo. Vrei sa ne jucam?';
    const text = sanitizeForTTS(raw);
    const lang = /[ăâîșțĂÂÎȘȚ]/.test(text) ? 'ro' : 'en';
    return NextResponse.json({ reply: text, lang });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Ceva nu a mers bine. Încearcă din nou.' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

const SYSTEM_PROMPT = `\
You are Sofia, a friendly kid girl robot designed exclusively for young children (ages 3–9).

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
6. Ask at most ONE question per reply.
7. Never argue, never use sarcasm, never be negative.

RESPONSE LENGTH — choose based on context, never exceed the limit:
- Simple conversational replies, greetings, reactions: 1–2 sentences, under 40 words
- Factual answers (animals, space, colors, food, games): 2–4 sentences, under 80 words
- Stories, rhymes, or when child explicitly asks for a tale or adventure: 4–10 sentences, under 220 words
Never pad short answers. Pick the length that feels most natural for what was asked.

FORMATTING RULES — your reply will be read aloud by a text-to-speech engine:
- NO emojis, NO emoticons, NO symbols like *, #, >, -, ~, |, /, \\, @, &
- NO bullet points, NO numbered lists, NO markdown of any kind
- Write in plain, flowing sentences only — the way you would speak to a child face-to-face
- Use simple words. Avoid parentheses and brackets.

CHILD PROFILE — use the context block (if provided) to personalize replies using what you already know about this child.

DEFLECTION PHRASE (use when rule 1 triggers, match the child's language):
- Romanian: "Nu stiu! Hai sa vorbim despre altceva. Iti plac dinozaurii, animalele sau supereroii?"
- English: "I don't know about that! Let's talk about something fun. Do you like dinosaurs, animals, or superheroes?"

OUTPUT FORMAT — respond ONLY with valid JSON, no text outside it:
{
  "reply": "your spoken reply here",
  "profile": {
    "name": "child name if revealed in THIS message, otherwise null",
    "favoriteColor": "if revealed in THIS message, otherwise null",
    "favoriteAnimal": "if revealed in THIS message, otherwise null",
    "friendName": "friend name if revealed in THIS message, otherwise null",
    "kindergarten": "kindergarten or school name if revealed in THIS message, otherwise null",
    "interests": ["only NEW interests mentioned in THIS message, empty array if none"]
  }
}
Only capture NEW information revealed right now. Null / empty array for anything already known or not mentioned.
`;

// Simple pattern guard — catches obviously inappropriate input before hitting OpenAI.
const BLOCKED_PATTERN =
  /\b(sex|porn|naked|kill|murder|suicide|drug|cocaine|heroin|alcohol|beer|wine|whiskey|weapon|gun|bomb|terror|rape|abuse|violence|gore|horror|f+u+c+k|sh[i1]t|b[i1]tch|a[s5][s5]hole|bastard|damn|crap|hell)\b/i;

// Strip anything that sounds bad when read aloud: emojis, markdown symbols, extra whitespace.
function sanitizeForTTS(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '')
    .replace(/[*_~`#>|\\]/g, '')
    .replace(/^\s*[-•–]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

type ChildProfile = {
  name?: string;
  favoriteColor?: string;
  favoriteAnimal?: string;
  friendName?: string;
  kindergarten?: string;
  interests?: string[];
};

function buildProfileContext(profile: ChildProfile): string {
  const parts: string[] = [];
  if (profile.name) parts.push(`Name: ${profile.name}`);
  if (profile.favoriteColor) parts.push(`Favorite color: ${profile.favoriteColor}`);
  if (profile.favoriteAnimal) parts.push(`Favorite animal: ${profile.favoriteAnimal}`);
  if (profile.friendName) parts.push(`Friend's name: ${profile.friendName}`);
  if (profile.kindergarten) parts.push(`Kindergarten/school: ${profile.kindergarten}`);
  if (profile.interests?.length) parts.push(`Interests: ${profile.interests.join(', ')}`);
  return parts.length > 0 ? `What I know about this child:\n${parts.join('\n')}` : '';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, message, history, summary, childProfile } = body as {
      name?: string;
      message?: string;
      history?: { role: 'user' | 'robot'; text: string }[];
      summary?: string;
      childProfile?: ChildProfile;
    };

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

    type OAIRole = 'user' | 'assistant';

    // Inject rolling summary + child profile as context before the recent history
    const contextParts: string[] = [];
    if (summary?.trim()) contextParts.push(`Conversation summary so far:\n${summary.trim()}`);
    const profileCtx = buildProfileContext(childProfile ?? {});
    if (profileCtx) contextParts.push(profileCtx);

    const contextMessages: { role: 'user' | 'assistant'; content: string }[] = [];
    if (contextParts.length > 0) {
      contextMessages.push({
        role: 'user',
        content: `[Background context]\n${contextParts.join('\n\n')}`,
      });
      contextMessages.push({
        role: 'assistant',
        content: 'Understood, I have the context.',
      });
    }

    const historyMessages: { role: 'user' | 'assistant'; content: string }[] = (history ?? [])
      .filter((m) => m.text?.trim())
      .map((m) => ({
        role: (m.role === 'robot' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.text.trim(),
      }));

    const response = await openai.responses.create({
      model: 'gpt-5.4-mini',
      input: [
        { role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
        ...contextMessages,
        ...historyMessages,
        {
          role: 'user',
          content: [{ type: 'input_text', text: `Child name: ${name?.trim() || 'friend'}\nChild says: ${message.trim()}` }],
        },
      ],
      store: false,
    });

    const raw = response.output_text?.trim() || '{"reply":"Buna! Eu sunt Robo. Vrei sa ne jucam?","profile":{}}';

    // Parse structured JSON response
    let reply: string;
    let profileUpdate: Record<string, unknown> = {};
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(cleaned) as { reply?: string; profile?: Record<string, unknown> };
      reply = sanitizeForTTS(parsed.reply || raw);
      profileUpdate = parsed.profile || {};
    } catch {
      reply = sanitizeForTTS(raw);
    }

    const lang = /[ăâîșțĂÂÎȘȚ]/.test(reply) ? 'ro' : 'en';
    return NextResponse.json({ reply, lang, profileUpdate });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Ceva nu a mers bine. Încearcă din nou.' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

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

    const response = await openai.responses.create({
      model: 'gpt-5.4-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text:
                'You are Robo, a playful, patient robot mascot for young children. Detect whether the child is writing in Romanian or English and ALWAYS respond in the SAME language they used. Only support Romanian and English — if any other language is detected, default to Romanian. Speak warmly, use short sentences, ask only one gentle question at a time, never argue, avoid collecting personal details (addresses, school names, phone numbers, parent work details), and redirect to safe playful topics. If the child sounds sad or says they are crying, comfort them first. Keep replies under 60 words.',
            },
          ],
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

    const text = response.output_text?.trim() || 'Bună! Eu sunt Robo. Vrei să ne jucăm?';
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

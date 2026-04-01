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
                'You are Robo, a playful, patient robot mascot for young children. Speak warmly, use short sentences, ask only one gentle question at a time, never argue, avoid collecting personal details like addresses, school names, phone numbers, or parent work details, and redirect to safe playful topics. If the child sounds sad or says they are crying, comfort them first before continuing. Keep replies under 60 words.',
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

    const text = response.output_text?.trim() || 'Hi! I am Robo. Want to play a game?';
    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Something went wrong while talking to Robo.' },
      { status: 500 }
    );
  }
}

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
                'Ești Robo, un robot jucăuș și răbdător pentru copii mici. Răspunde ÎNTOTDEAUNA în limba română, indiferent de limba în care ți se vorbește. Vorbește cald și prietenos, folosește propoziții scurte, pune o singură întrebare blândă la un moment dat, nu te certa niciodată, evită colectarea datelor personale (adrese, școli, telefoane) și redirecționează spre subiecte sigure și jucăușe. Dacă copilul pare trist sau spune că plânge, consolează-l mai întâi. Răspunsurile să fie sub 60 de cuvinte.',
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
    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Ceva nu a mers bine. Încearcă din nou.' },
      { status: 500 }
    );
  }
}

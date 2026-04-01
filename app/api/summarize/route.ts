import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

export async function POST(req: Request) {
  try {
    const { messages, existingSummary } = (await req.json()) as {
      messages: { role: 'user' | 'robot'; text: string }[];
      existingSummary?: string;
    };

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ summary: existingSummary || '' }, { status: 500 });
    }

    const exchangesText = (messages ?? [])
      .filter((m) => m.text?.trim())
      .map((m) => `${m.role === 'robot' ? 'Robo' : 'Child'}: ${m.text.trim()}`)
      .join('\n');

    const prompt = existingSummary?.trim()
      ? `Existing summary:\n${existingSummary}\n\nNew exchanges to integrate:\n${exchangesText}\n\nMerge into an updated concise summary (3-5 sentences). Focus on: what the child is called, their interests and preferences, topics they enjoyed, anything personal they shared. Plain sentences only, no lists.`
      : `Summarize this child-robot conversation in 3-5 plain sentences. Focus on: what the child is called, their interests and preferences, topics they enjoyed, anything personal they shared.\n\n${exchangesText}`;

    const response = await openai.responses.create({
      model: 'gpt-5.4-mini',
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      store: false,
    });

    return NextResponse.json({ summary: response.output_text?.trim() || '' });
  } catch {
    return NextResponse.json({ summary: '' });
  }
}

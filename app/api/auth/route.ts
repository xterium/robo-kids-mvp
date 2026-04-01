import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const accessCode = process.env.ACCESS_CODE;

  // If no ACCESS_CODE is set, the app is open to everyone
  if (!accessCode) {
    return NextResponse.json({ ok: true });
  }

  try {
    const { code } = (await req.json()) as { code?: string };

    if (code && code === accessCode) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'Cod greșit. Încearcă din nou.' }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }
}

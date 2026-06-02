import { NextResponse } from 'next/server';

// Camera instance images removed — location photos live at /api/survey/locations/[id]/photos
export async function GET()  { return NextResponse.json({ error: 'Gone — use /api/survey/locations/[id]/photos' }, { status: 410 }); }
export async function POST() { return NextResponse.json({ error: 'Gone — use /api/survey/locations/[id]/photos' }, { status: 410 }); }

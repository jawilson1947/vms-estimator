import { NextResponse } from 'next/server';

// Maintenance records removed with the camera instance table
export async function GET()  { return NextResponse.json({ error: 'Gone — maintenance subsystem removed' }, { status: 410 }); }
export async function POST() { return NextResponse.json({ error: 'Gone — maintenance subsystem removed' }, { status: 410 }); }

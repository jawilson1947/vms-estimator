import { NextResponse } from 'next/server';

// Maintenance records removed with the camera instance subsystem
export async function PUT()    { return NextResponse.json({ error: 'Gone — maintenance subsystem removed' }, { status: 410 }); }
export async function DELETE() { return NextResponse.json({ error: 'Gone — maintenance subsystem removed' }, { status: 410 }); }

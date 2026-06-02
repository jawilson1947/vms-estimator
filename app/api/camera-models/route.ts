import { NextRequest, NextResponse } from 'next/server';

// Redirected — camera model catalog now lives at /api/cameras
export async function GET(req: NextRequest) {
  const url = req.url.replace('/api/camera-models', '/api/cameras');
  return NextResponse.redirect(url, 308);
}
export async function POST(req: NextRequest) {
  const url = req.url.replace('/api/camera-models', '/api/cameras');
  return NextResponse.redirect(url, 308);
}

import { NextRequest, NextResponse } from 'next/server';

// Redirected — use /api/cameras/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.redirect(req.url.replace(`/api/camera-models/${id}`, `/api/cameras/${id}`), 308);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.redirect(req.url.replace(`/api/camera-models/${id}`, `/api/cameras/${id}`), 308);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.redirect(req.url.replace(`/api/camera-models/${id}`, `/api/cameras/${id}`), 308);
}

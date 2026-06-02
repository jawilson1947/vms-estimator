import { redirect } from 'next/navigation';

// Camera instance detail page removed — camera catalog lives at /cameras
export default function CameraDetailPage() {
  redirect('/cameras');
}

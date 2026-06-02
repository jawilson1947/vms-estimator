import { redirect } from 'next/navigation';

// Camera models catalog moved to /cameras
export default function CameraModelsPage() {
  redirect('/cameras');
}

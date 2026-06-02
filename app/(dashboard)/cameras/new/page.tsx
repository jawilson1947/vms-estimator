import { redirect } from 'next/navigation';

// Camera creation is now handled via the modal on /cameras
export default function NewCameraPage() {
  redirect('/cameras');
}

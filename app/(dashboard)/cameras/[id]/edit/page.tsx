import { redirect } from 'next/navigation';

// Camera edit now handled via the modal on /cameras
export default function EditCameraPage() {
  redirect('/cameras');
}

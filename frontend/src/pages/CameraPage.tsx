import { useNavigate } from 'react-router-dom';
import CameraCapture from '../components/CameraCapture';

export default function CameraPage() {
  const navigate = useNavigate();

  const handleCapture = (file: File) => {
    // Store file in sessionStorage as base64 for transfer
    const reader = new FileReader();
    reader.onload = () => {
      sessionStorage.setItem('capturedImage', reader.result as string);
      sessionStorage.setItem('capturedImageName', file.name);
      sessionStorage.setItem('pendingScanHistorySave', '1');
      navigate('/results');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="h-[calc(100dvh-4rem)] overflow-hidden overscroll-none px-3 py-3 sm:px-4 sm:py-4">
      <main className="app-shell flex h-full flex-col items-center justify-center overflow-hidden">
        <div className="fade-up-delay flex w-full min-h-0 flex-1 items-center">
          <CameraCapture onCapture={handleCapture} />
        </div>
      </main>
    </div>
  );
}

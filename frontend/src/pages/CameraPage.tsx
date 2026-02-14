import { useNavigate } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import CameraCapture from '../components/CameraCapture';

export default function CameraPage() {
  const navigate = useNavigate();

  const handleCapture = (file: File) => {
    // Store file in sessionStorage as base64 for transfer
    const reader = new FileReader();
    reader.onload = () => {
      sessionStorage.setItem('capturedImage', reader.result as string);
      sessionStorage.setItem('capturedImageName', file.name);
      navigate('/results');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-green-50 to-white px-4 pt-8 pb-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <Leaf className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold text-gray-900">ShelfScan</h1>
        </div>
        <p className="text-center text-gray-500">
          Scan a food product to see its nutrition, eco-score, and greener alternatives
        </p>
      </div>

      <CameraCapture onCapture={handleCapture} />
    </div>
  );
}

import { useRef, useCallback, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, SwitchCamera } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
}

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState(false);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      fetch(imageSrc)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
          onCapture(file);
        });
    }
  }, [onCapture]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {!cameraError ? (
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-black">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode, width: 640, height: 480 }}
            className="w-full"
            onUserMediaError={() => setCameraError(true)}
          />
          <button
            onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
            className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="flex h-64 w-full max-w-md items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
          <p className="text-center px-4">Camera not available. Use the upload button below.</p>
        </div>
      )}

      <div className="flex gap-3">
        {!cameraError && (
          <button
            onClick={capture}
            className="flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-green-700"
          >
            <Camera className="h-5 w-5" />
            Take Photo
          </button>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-full border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition hover:border-gray-400"
        >
          <Upload className="h-5 w-5" />
          Upload Photo
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}

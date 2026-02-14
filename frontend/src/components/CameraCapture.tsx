import { useRef, useCallback, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, SwitchCamera } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
}

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState(false);
  const previewAspectRatio = 16 / 9;
  const videoConstraints = {
    facingMode,
    aspectRatio: previewAspectRatio,
    width: { ideal: 4096 },
    height: { ideal: 2160 },
  };

  const maximizeTrackResolution = useCallback(async (stream: MediaStream) => {
    const [track] = stream.getVideoTracks();
    if (!track) return;

    if (track.getCapabilities) {
      const capabilities = track.getCapabilities();
      const maxWidth = capabilities.width?.max;
      const maxHeight = capabilities.height?.max;

      if (maxWidth && maxHeight) {
        try {
          await track.applyConstraints({
            width: { exact: maxWidth },
            height: { exact: maxHeight },
          });
        } catch {
          await track.applyConstraints({
            width: { ideal: maxWidth },
            height: { ideal: maxHeight },
          });
        }
      }
    }

  }, []);

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
    <div className="glass-panel mx-auto flex w-full max-w-4xl flex-col items-center gap-4 rounded-3xl p-4">
      {!cameraError ? (
        <div
          className="relative h-[52vh] w-full max-w-4xl rounded-2xl border border-white/40 bg-black/90 p-2 sm:h-[58vh] md:h-[66vh]"
        >
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl">
            <div className="h-full max-w-full overflow-hidden rounded-xl" style={{ aspectRatio: previewAspectRatio }}>
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                screenshotQuality={1}
                forceScreenshotSourceSize
                videoConstraints={videoConstraints}
                mirrored={false}
                className="h-full w-full object-cover"
                onUserMedia={maximizeTrackResolution}
                onUserMediaError={() => setCameraError(true)}
              />
            </div>
          </div>
          <button
            onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
            className="absolute right-5 top-5 rounded-full border border-white/30 bg-black/40 p-2 text-white backdrop-blur-sm"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="flex h-48 w-full max-w-2xl items-center justify-center rounded-2xl border border-dashed border-[var(--line-soft)] bg-white/80 text-[var(--ink-500)] md:h-56">
          <p className="text-center px-4">Camera not available. Use the upload button below.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {!cameraError && (
          <button
            onClick={capture}
            className="ui-btn btn-primary"
          >
            <Camera className="h-5 w-5" />
            Take Photo
          </button>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="ui-btn btn-secondary"
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

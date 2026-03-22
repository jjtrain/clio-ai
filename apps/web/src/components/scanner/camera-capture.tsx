"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface CameraCaptureProps {
  onCapture: (imageUrl: string) => void;
  onCancel: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play();
        }
      })
      .catch(() => setCameraFailed(true));
    return () => { active = false; stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setPreviewUrl(canvas.toDataURL("image/jpeg", 0.9));
    setCaptured(true);
    stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);

  const retake = useCallback(() => {
    setCaptured(false);
    setPreviewUrl(null);
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        setStream(s);
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
      })
      .catch(() => setCameraFailed(true));
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setPreviewUrl(reader.result as string); setCaptured(true); };
    reader.readAsDataURL(file);
  };

  if (cameraFailed) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-gray-900">
        <p className="text-white text-lg">Camera unavailable. Select an image instead.</p>
        <label className="cursor-pointer rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700">
          Choose Photo
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
        </label>
        {previewUrl && captured && (<>
          <img src={previewUrl} alt="Preview" className="max-h-[60vh] rounded-lg" />
          <div className="flex gap-4">
            <button onClick={() => { setCaptured(false); setPreviewUrl(null); }} className="rounded-lg bg-gray-600 px-5 py-2.5 text-white hover:bg-gray-500">Retake</button>
            <button onClick={() => onCapture(previewUrl)} className="rounded-lg bg-green-600 px-5 py-2.5 text-white hover:bg-green-700">Use Photo</button>
          </div>
        </>)}
        <button onClick={onCancel} className="mt-4 text-gray-400 hover:text-white">Cancel</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <canvas ref={canvasRef} className="hidden" />
      {!captured ? (
        <>
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[80%] h-[60%] border-2 border-dashed border-white/60 rounded-xl" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 bg-black/80 px-4 py-6">
            <button onClick={onCancel} className="rounded-lg bg-gray-700 px-5 py-2.5 text-white hover:bg-gray-600">Cancel</button>
            <button onClick={captureFrame} className="h-16 w-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition" />
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center bg-gray-900 p-4">
            {previewUrl && <img src={previewUrl} alt="Captured" className="max-h-full max-w-full rounded-lg" />}
          </div>
          <div className="flex items-center justify-center gap-6 bg-black/80 px-4 py-6">
            <button onClick={retake} className="rounded-lg bg-gray-700 px-6 py-2.5 text-white hover:bg-gray-600">Retake</button>
            <button onClick={() => previewUrl && onCapture(previewUrl)} className="rounded-lg bg-green-600 px-6 py-2.5 text-white font-medium hover:bg-green-700">Use Photo</button>
          </div>
        </>
      )}
    </div>
  );
}

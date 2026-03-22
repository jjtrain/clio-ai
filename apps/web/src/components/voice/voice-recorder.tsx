"use client";
import { useState, useRef, useCallback } from "react";

const categories = ["Case Update", "Court Appearance", "Client Call", "Deposition", "Research", "Billing", "Strategy", "Witness Interview", "General"];

export default function VoiceRecorder({ matterId, authorName, onComplete, onCancel }: {
  matterId: string; authorName: string; onComplete: (note: any) => void; onCancel: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("General");
  const [done, setDone] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      recorder.start();

      try {
        const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (e: any) => {
          let text = "";
          for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript + " ";
          setTranscription(text.trim());
        };
        recognition.start();
        recognitionRef.current = recognition;
      } catch {
        setTranscription("(Live transcription not available \u2014 will process after recording)");
      }

      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      setRecording(true);
    } catch (err: any) {
      setError(err.message || "Could not access microphone");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    try { recognitionRef.current?.stop(); } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setDone(true);
  }, []);

  const handleSave = () => {
    const catKey = category.toUpperCase().replace(/ /g, "_");
    onComplete({ transcription, audioDuration: duration, category: catKey, audioFormat: "webm" });
  };

  if (error) {
    return (
      <div className="text-center p-6">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 p-4">
        <label className="block text-sm font-medium text-gray-700">Transcription</label>
        <textarea value={transcription} onChange={(e) => setTranscription(e.target.value)}
          className="w-full h-32 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-500">Duration: {fmt(duration)} | Author: {authorName}</p>
        <div className="flex gap-3">
          <button onClick={handleSave} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Save Note</button>
          <button onClick={onCancel} className="flex-1 px-4 py-2 bg-gray-200 rounded-lg font-medium hover:bg-gray-300">Cancel</button>
        </div>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex flex-col items-center p-8 space-y-4">
        <div className="w-16 h-16 bg-red-500 rounded-full animate-pulse" />
        <p className="text-2xl font-mono font-bold">{fmt(duration)}</p>
        <p className="text-sm text-gray-600 max-h-24 overflow-y-auto text-center px-4">{transcription || "Listening..."}</p>
        <button onClick={stopRecording} className="px-6 py-3 bg-red-600 text-white rounded-full font-medium hover:bg-red-700">Stop Recording</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-8 space-y-4">
      <button onClick={startRecording}
        className="w-24 h-24 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105">
        <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zm-5 9a1 1 0 01-1-1v-1.07A7.007 7.007 0 015 11H3a9.009 9.009 0 008 8.93V20a1 1 0 012 0z" /></svg>
      </button>
      <p className="text-sm font-medium text-gray-600">Tap to Record</p>
    </div>
  );
}

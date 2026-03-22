"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";

type SignMethod = "draw" | "type" | "upload";

export default function MobileSigningPage() {
  const token = (useParams().token as string);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [sigData, setSigData] = useState("");
  const [sigMethod, setSigMethod] = useState<SignMethod>("draw");
  const [typedName, setTypedName] = useState("");
  const [consent, setConsent] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [signDate, setSignDate] = useState(new Date().toISOString().split("T")[0]);
  const [confirm, setConfirm] = useState(false);

  const { data, isLoading, error } = trpc.mobileSign["getPublicSigningPage"].useQuery({ signingToken: token }, { retry: false });
  const submitMut = trpc.mobileSign["submitPublicSignature"].useMutation({ onSuccess: () => setSubmitted(true) });

  const getPos = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: cx - r.left, y: cy - r.top };
  }, []);
  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault(); drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }, [getPos]);
  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault(); if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return; const p = getPos(e);
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#000"; ctx.lineTo(p.x, p.y); ctx.stroke();
  }, [getPos]);
  const stopDraw = useCallback(() => {
    drawing.current = false;
    if (canvasRef.current) setSigData(canvasRef.current.toDataURL("image/png"));
  }, []);
  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, 280, 120); setSigData("");
  };
  useEffect(() => {
    if (sigMethod === "draw" && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 280, 120); }
    }
  }, [sigMethod]);

  const hasSig = (sigMethod === "draw" && sigData) || (sigMethod === "type" && typedName.trim()) || (sigMethod === "upload" && sigData);
  const handleSign = () => {
    const sig = sigMethod === "type" ? `typed:${typedName}` : sigData;
    submitMut.mutate({ signingToken: token, signerId: "signer-0", signatureData: sig || "" } as any);
  };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = (ev) => setSigData(ev.target?.result as string); r.readAsDataURL(f);
  };

  // --- Render states ---
  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
  if (error || !data) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="text-red-500 text-5xl mb-4">!</div>
        <h1 className="text-xl font-semibold mb-2">Unable to Access Document</h1>
        <p className="text-gray-500 mb-4">This signing link may be expired, cancelled, or invalid.</p>
        {(data as any)?.firmContactEmail && <p className="text-sm text-gray-400">Contact: {(data as any)?.firmContactEmail}</p>}
      </div>
    </div>
  );
  if ((data as any).status === "COMPLETED" || submitted) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold mb-2">{submitted ? "Document Signed Successfully!" : "Already Signed"}</h1>
        <p className="text-gray-500 mb-4">A copy will be sent to your email.</p>
        {(data as any).firmName && <p className="text-sm text-gray-400">Sent by {(data as any).firmName}</p>}
        {(data as any)?.firmContactEmail && <p className="text-sm text-gray-400">Contact: {(data as any)?.firmContactEmail}</p>}
      </div>
    </div>
  );
  if ((data as any).status === "DECLINED" || declined) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold mb-2">Signing Declined</h1>
        <p className="text-gray-500">You have declined to sign this document.</p>
        {(data as any)?.firmContactEmail && <p className="text-sm text-gray-400 mt-4">Contact: {(data as any)?.firmContactEmail}</p>}
      </div>
    </div>
  );

  const tabs: { key: SignMethod; label: string }[] = [{ key: "draw", label: "Draw" }, { key: "type", label: "Type" }, { key: "upload", label: "Upload" }];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: (data as any).brandColor || "#1e40af" }}>{(data as any).firmName || "Document Signing"}</h1>
          <p className="text-gray-600 text-sm mt-1">{(data as any).title}</p>
        </div>
        {(data as any).customMessage && <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-blue-800">{(data as any).customMessage}</div>}
        <div className="inline-block bg-gray-100 rounded-full px-3 py-1 text-sm text-gray-700 mb-4">
          Signing as: <span className="font-medium">{(data as any).signerName}</span>
        </div>
        <div className="border rounded-lg p-4 mb-6 bg-gray-50 prose prose-sm max-w-none overflow-auto max-h-[400px]">
          <div dangerouslySetInnerHTML={{ __html: (data as any).documentContent || "" }} />
        </div>
        <label className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-600" />
          <span className="text-sm text-gray-700 leading-relaxed">
            I agree that my electronic signature is the legal equivalent of my handwritten signature.
            By checking this box and signing below, I consent to conduct this transaction electronically under the E-SIGN Act and UETA.
          </span>
        </label>

        {consent && (
          <div className="border rounded-lg p-4 mb-6">
            <p className="font-medium text-sm mb-3">Your Signature</p>
            <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => { setSigMethod(t.key); setSigData(""); }}
                  className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${sigMethod === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {sigMethod === "draw" && (
              <div>
                <canvas ref={canvasRef} width={280} height={120}
                  className="border border-gray-300 rounded-lg bg-white w-full touch-none" style={{ maxWidth: 280, height: 120 }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
                <button onClick={clearCanvas} className="text-sm text-blue-600 mt-2 hover:underline">Clear</button>
              </div>
            )}
            {sigMethod === "type" && (
              <div>
                <input type="text" value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder="Type your full name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3" />
                {typedName && (
                  <div className="border rounded-lg p-4 bg-gray-50 text-center">
                    <span style={{ fontFamily: "'Brush Script MT', cursive", fontSize: 28 }} className="text-gray-900">{typedName}</span>
                  </div>
                )}
              </div>
            )}
            {sigMethod === "upload" && (
              <div>
                <input type="file" accept="image/*" onChange={handleFile}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700" />
                {sigData && <img src={sigData} alt="Signature" className="mt-3 max-h-[80px] mx-auto" />}
              </div>
            )}
            <div className="mt-4">
              <label className="text-sm text-gray-600 block mb-1">Date</label>
              <input type="date" value={signDate} onChange={(e) => setSignDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full" />
            </div>
          </div>
        )}

        {consent && (
          <button onClick={() => setConfirm(true)} disabled={!hasSig || submitMut.isPending}
            className="w-full py-3 rounded-lg text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700">
            {submitMut.isPending ? "Submitting..." : "Sign Document"}
          </button>
        )}
        {submitMut.isError && <p className="text-sm text-red-500 mt-2 text-center">{submitMut.error.message}</p>}

        {confirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full">
              <h2 className="text-lg font-semibold mb-2">Confirm Signature</h2>
              <p className="text-sm text-gray-600 mb-4">Are you sure you want to sign this document? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={() => { setConfirm(false); handleSign(); }} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Confirm & Sign</button>
              </div>
            </div>
          </div>
        )}

        {!showDecline ? (
          <button onClick={() => setShowDecline(true)} className="block mx-auto mt-6 text-xs text-gray-400 hover:text-gray-600">I decline to sign</button>
        ) : (
          <div className="mt-6 border rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Reason for declining (optional)</p>
            <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3" rows={2} placeholder="Enter reason..." />
            <div className="flex gap-3">
              <button onClick={() => setShowDecline(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => setDeclined(true)} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Decline to Sign</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

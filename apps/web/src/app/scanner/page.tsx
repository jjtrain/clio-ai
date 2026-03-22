"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import CameraCapture from "@/components/scanner/camera-capture";

const STATUS_COLORS: Record<string, string> = {
  PROCESSING: "bg-amber-100 text-amber-800",
  OCR_COMPLETE: "bg-blue-100 text-blue-800",
  FILED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

export default function ScannerPage() {
  const [showCamera, setShowCamera] = useState(false);
  const [uploadedScan, setUploadedScan] = useState<any>(null);
  const [fileName, setFileName] = useState("");
  const [selectedMatter, setSelectedMatter] = useState("");
  const [ocrExpanded, setOcrExpanded] = useState(false);

  const scans = trpc.scanner["list"].useQuery({ userId: "current-user" });
  const uploadMutation = trpc.scanner["upload"].useMutation({
    onSuccess: (data: any) => {
      setUploadedScan(data);
      setFileName(data.suggestedName || "");
      setSelectedMatter(data.suggestedMatter?.id || "");
      scans.refetch();
    },
  });
  const fileMutation = trpc.scanner["fileToMatter"].useMutation({
    onSuccess: () => { setUploadedScan(null); scans.refetch(); },
  });

  const handleCapture = (imageUrl: string) => {
    setShowCamera(false);
    uploadMutation.mutate({ imageUrl, userId: "current-user", deviceType: /Mobi/.test(navigator.userAgent) ? "mobile" : "desktop" });
  };

  const scanList = (scans.data as any[]) || [];
  const totalScans = scanList.length;
  const filedCount = scanList.filter((s: any) => s.status === "FILED").length;
  const pendingCount = scanList.filter((s: any) => s.status === "PROCESSING" || s.status === "OCR_COMPLETE").length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Document Scanner</h1>
            <p className="mt-1 text-gray-500">Photograph, OCR, and file documents to matters</p>
          </div>
          <button onClick={() => setShowCamera(true)} className="rounded-lg bg-blue-600 px-5 py-2.5 text-white font-medium hover:bg-blue-700">
            Scan Document
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          {[["Total Scans", totalScans], ["Filed", filedCount], ["Pending", pendingCount]].map(([label, val]) => (
            <div key={label as string} className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{val}</p>
            </div>
          ))}
        </div>

        {/* Upload Processing / Results */}
        {uploadMutation.isPending && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-sm border border-gray-200 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="mt-3 text-gray-600">Processing document...</p>
          </div>
        )}

        {uploadedScan && !uploadMutation.isPending && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-sm border border-gray-200 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Scan Results</h2>

            {/* OCR Preview */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Extracted Text</h3>
              <div className={`bg-gray-50 rounded-lg p-3 text-sm text-gray-800 font-mono whitespace-pre-wrap ${!ocrExpanded ? "max-h-32 overflow-hidden" : ""}`}>
                {uploadedScan.ocrText || "No text extracted"}
              </div>
              {uploadedScan.ocrText?.length > 200 && (
                <button onClick={() => setOcrExpanded(!ocrExpanded)} className="mt-1 text-sm text-blue-600 hover:underline">
                  {ocrExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>

            {/* AI Classification */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">{uploadedScan.documentType || "Unknown"}</span>
              {uploadedScan.summary && <span className="text-sm text-gray-600">{uploadedScan.summary}</span>}
            </div>

            {/* Suggested Matter */}
            {uploadedScan.suggestedMatter ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">Suggested matter: <strong>{uploadedScan.suggestedMatter.name}</strong></span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">{uploadedScan.suggestedMatter.confidence}%</span>
                <button onClick={() => setSelectedMatter(uploadedScan.suggestedMatter.id)} className="text-sm text-blue-600 hover:underline">Confirm</button>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Matter</label>
                <input type="text" value={selectedMatter} onChange={(e) => setSelectedMatter(e.target.value)} placeholder="Enter matter ID or name" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            )}

            {/* File Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File Name</label>
              <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <button
              onClick={() => fileMutation.mutate({ scanId: uploadedScan.id, matterId: selectedMatter, fileName })}
              disabled={!selectedMatter || !fileName || fileMutation.isPending}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {fileMutation.isPending ? "Filing..." : "File to Matter"}
            </button>
          </div>
        )}

        {/* Recent Scans */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Scans</h2>
          {scans.isLoading ? (
            <p className="text-gray-500">Loading scans...</p>
          ) : scanList.length === 0 ? (
            <p className="text-gray-500">No scans yet. Tap &quot;Scan Document&quot; to get started.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {scanList.map((scan: any) => (
                <a key={scan.id} href={`/scanner/${scan.id}`} className="block rounded-lg bg-white p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-gray-100">
                    <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">{scan.documentType || "Doc"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[scan.status] || "bg-gray-100 text-gray-800"}`}>{scan.status}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{scan.name || "Untitled Scan"}</p>
                  {scan.matterName && <p className="text-xs text-gray-500 truncate">{scan.matterName}</p>}
                  <p className="mt-1 text-xs text-gray-400">{new Date(scan.scannedAt).toLocaleDateString()}</p>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && <CameraCapture onCapture={handleCapture} onCancel={() => setShowCamera(false)} />}
    </div>
  );
}

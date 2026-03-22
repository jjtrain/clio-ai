"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";

const STATUS_COLORS: Record<string, string> = {
  PROCESSING: "bg-amber-100 text-amber-800",
  OCR_COMPLETE: "bg-blue-100 text-blue-800",
  FILED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const scan = trpc.scanner["get"].useQuery({ scanId: id });
  const [fileName, setFileName] = useState("");
  const [matterId, setMatterId] = useState("");
  const [showContact, setShowContact] = useState(false);

  const fileMutation = trpc.scanner["fileToMatter"].useMutation({ onSuccess: () => scan.refetch() });
  const reprocessMutation = trpc.scanner["reprocess"].useMutation({ onSuccess: () => scan.refetch() });
  const renameMutation = trpc.scanner["rename"].useMutation({ onSuccess: () => scan.refetch() });
  const deleteMutation = trpc.scanner["delete"].useMutation({ onSuccess: () => window.history.back() });

  if (scan.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const data = scan.data as any;
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Scan not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Back */}
        <a href="/scanner" className="inline-flex items-center text-sm text-blue-600 hover:underline">&larr; Back to Scanner</a>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.name || "Untitled Scan"}</h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">{data.documentType || "Document"}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[data.status] || "bg-gray-100 text-gray-800"}`}>{data.status}</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">Scanned {new Date(data.scannedAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Image Preview */}
        <div className="rounded-lg bg-white border border-gray-200 shadow-sm overflow-hidden">
          {data.imageUrl ? (
            <img src={data.imageUrl} alt="Scanned document" className="w-full max-h-96 object-contain bg-gray-100" />
          ) : (
            <div className="flex h-48 items-center justify-center bg-gray-100">
              <svg className="h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          )}
        </div>

        {/* OCR Text */}
        <div className="rounded-lg bg-white p-5 border border-gray-200 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 uppercase tracking-wide">Extracted Text</h2>
          <div className="max-h-64 overflow-y-auto rounded-lg bg-gray-50 p-4 text-sm text-gray-800 font-mono whitespace-pre-wrap">
            {data.ocrText || "No text extracted."}
          </div>
        </div>

        {/* AI Analysis */}
        <div className="rounded-lg bg-white p-5 border border-gray-200 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 uppercase tracking-wide">AI Analysis</h2>
          <div className="space-y-3">
            <div><span className="text-xs text-gray-500">Type:</span> <span className="text-sm font-medium text-gray-900">{data.documentType || "Unknown"}</span></div>
            {data.summary && <div><span className="text-xs text-gray-500">Summary:</span> <span className="text-sm text-gray-700">{data.summary}</span></div>}
            {data.entities && data.entities.length > 0 && (
              <div>
                <span className="text-xs text-gray-500">Extracted Entities:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {data.entities.map((entity: any, i: number) => (
                    <span key={i} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">{entity.label}: {entity.value}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filing Section */}
        <div className="rounded-lg bg-white p-5 border border-gray-200 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 uppercase tracking-wide">Filing</h2>
          {data.status === "FILED" ? (
            <div className="space-y-1">
              <p className="text-sm text-gray-700">Filed to <a href={`/matters/${data.matterId}`} className="font-medium text-blue-600 hover:underline">{data.matterName}</a></p>
              {data.filedAt && <p className="text-xs text-gray-500">Filed on {new Date(data.filedAt).toLocaleString()}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matter</label>
                <input type="text" value={matterId} onChange={(e) => setMatterId(e.target.value)} placeholder="Enter matter ID or name" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Name</label>
                <input type="text" value={fileName || data.name || ""} onChange={(e) => setFileName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <button
                onClick={() => fileMutation.mutate({ scanId: id, matterId, fileName: fileName || data.name })}
                disabled={!matterId || fileMutation.isPending}
                className="rounded-lg bg-blue-600 px-5 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {fileMutation.isPending ? "Filing..." : "File to Matter"}
              </button>
            </div>
          )}
        </div>

        {/* Business Card Contact */}
        {data.documentType === "Business Card" && (
          <div className="rounded-lg bg-white p-5 border border-gray-200 shadow-sm">
            <button onClick={() => setShowContact(!showContact)} className="text-sm font-medium text-blue-600 hover:underline">
              {showContact ? "Hide Contact Info" : "Extract Contact"}
            </button>
            {showContact && data.contactInfo && (
              <div className="mt-3 space-y-1 text-sm text-gray-700">
                {data.contactInfo.name && <p><strong>Name:</strong> {data.contactInfo.name}</p>}
                {data.contactInfo.email && <p><strong>Email:</strong> {data.contactInfo.email}</p>}
                {data.contactInfo.phone && <p><strong>Phone:</strong> {data.contactInfo.phone}</p>}
                {data.contactInfo.company && <p><strong>Company:</strong> {data.contactInfo.company}</p>}
                {data.contactInfo.title && <p><strong>Title:</strong> {data.contactInfo.title}</p>}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button onClick={() => reprocessMutation.mutate({ scanId: id })} disabled={reprocessMutation.isPending} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {reprocessMutation.isPending ? "Reprocessing..." : "Reprocess OCR"}
          </button>
          <button onClick={() => { const n = prompt("New name:", data.name); if (n) renameMutation.mutate({ scanId: id, name: n }); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Rename
          </button>
          <button onClick={() => { if (confirm("Delete this scan?")) deleteMutation.mutate({ scanId: id }); }} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

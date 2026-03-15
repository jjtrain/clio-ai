"use client";

import { usePortal } from "../portal-context";
import { trpc } from "@/lib/trpc";
import { FileText, File } from "lucide-react";

export default function PortalDocumentsPage() {
  const { token } = usePortal();
  const { data: documents, isLoading } = trpc.clientPortal.portalGetDocuments.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  if (!token) return <div className="text-center py-12 text-gray-400">Please log in</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-gray-500">View documents related to your matters</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : !documents?.length ? (
        <div className="text-center py-12">
          <FileText className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No documents found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {documents.map((doc) => (
            <div key={doc.id} className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <File className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{doc.name}</p>
                <p className="text-xs text-gray-500">
                  {doc.matter?.name} · {doc.mimeType}
                </p>
              </div>
              <span className="text-xs text-gray-400">{new Date(doc.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

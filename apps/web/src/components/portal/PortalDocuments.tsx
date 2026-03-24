"use client";

import { FileText, Upload, Download, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePortalTheme } from "./PortalThemeProvider";

interface Document {
  id: string;
  fileName: string;
  fileUrl?: string | null;
  category: string;
  description?: string | null;
  uploaderType: string;
  requiresSignature: boolean;
  signedAt?: Date | null;
  createdAt: Date;
}

interface PortalDocumentsProps {
  documents: Document[];
  categories?: string[];
  onUpload?: () => void;
  onSign?: (docId: string) => void;
}

export function PortalDocuments({ documents, categories, onUpload, onSign }: PortalDocumentsProps) {
  const theme = usePortalTheme();
  const cats = categories || theme.documentCategories || Array.from(new Set(documents.map((d) => d.category)));

  const grouped = cats.reduce<Record<string, Document[]>>((acc, cat) => {
    acc[cat] = documents.filter((d) => d.category === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Upload Area */}
      <Card className="p-6 border-dashed border-2 text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={onUpload}>
        <Upload className="h-8 w-8 mx-auto mb-2" style={{ color: theme.colorMuted }} />
        <p className="text-sm font-medium" style={{ color: theme.colorText }}>Upload Documents</p>
        <p className="text-xs mt-1" style={{ color: theme.colorMuted }}>
          Drag and drop or click to select files
        </p>
      </Card>

      {/* Documents by Category */}
      {cats.map((cat) => {
        const docs = grouped[cat] || [];
        if (docs.length === 0) return null;

        return (
          <div key={cat}>
            <h3 className="text-sm font-semibold mb-2 capitalize" style={{ color: theme.colorText }}>
              {cat.replace(/_/g, " ")}
            </h3>
            <div className="space-y-2">
              {docs.map((doc) => (
                <Card key={doc.id} className="p-3 flex items-center gap-3" style={{ borderRadius: theme.borderRadius }}>
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: theme.colorPrimary + "15" }}>
                    <FileText className="h-4 w-4" style={{ color: theme.colorPrimary }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: theme.colorText }}>
                      {doc.fileName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px]" style={{ color: theme.colorMuted }}>
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                      {doc.uploaderType === "client" && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">Your upload</Badge>
                      )}
                      {doc.requiresSignature && !doc.signedAt && (
                        <Badge className="text-[10px] px-1 py-0 bg-orange-100 text-orange-700">Needs signature</Badge>
                      )}
                      {doc.signedAt && (
                        <Badge className="text-[10px] px-1 py-0 bg-green-100 text-green-700">Signed</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {doc.requiresSignature && !doc.signedAt && onSign && (
                      <Button size="sm" onClick={() => onSign(doc.id)} className="gap-1 text-xs h-7"
                              style={{ backgroundColor: theme.colorAccent }}>
                        <PenTool className="h-3 w-3" /> Sign
                      </Button>
                    )}
                    {doc.fileUrl && (
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Download className="h-3.5 w-3.5" style={{ color: theme.colorMuted }} />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {documents.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto mb-3" style={{ color: theme.colorMuted + "40" }} />
          <p className="text-sm" style={{ color: theme.colorMuted }}>No documents shared yet</p>
        </div>
      )}
    </div>
  );
}

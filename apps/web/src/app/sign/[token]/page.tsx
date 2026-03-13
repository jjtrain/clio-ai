"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SignatureCanvas } from "@/components/signature-canvas";
import { CheckCircle2, FileText, AlertCircle, PenTool, Scale } from "lucide-react";

export default function PublicSigningPage() {
  const params = useParams();
  const token = params.token as string;

  const [signature, setSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);

  const { data: request, isLoading, error } = trpc.signatures.getByToken.useQuery(
    { token },
    { retry: false }
  );

  const clientSign = trpc.signatures.clientSign.useMutation({
    onSuccess: () => setSigned(true),
  });

  const handleSign = () => {
    if (!signature || !agreed) return;
    clientSign.mutate({ token, signature });
  };

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Error states
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border shadow-sm p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to Access Document</h1>
          <p className="text-gray-500">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!request) return null;

  // Already fully signed
  const alreadySignedByClient =
    request.status !== "PENDING_CLIENT" && !!request.clientSignature;

  // Success state after signing
  if (signed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border shadow-sm p-8 max-w-md text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Document Signed Successfully</h1>
          <p className="text-gray-500">
            Thank you for signing. The attorney will be notified and will countersign the document.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500">
            <Scale className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {request.firmName || "Document Signing"}
            </h1>
            <p className="text-sm text-gray-500">{request.title}</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Already signed message */}
        {alreadySignedByClient && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-green-800 mb-1">Document Already Signed</h2>
            <p className="text-sm text-green-600 mb-4">
              You have already signed this document.
            </p>
            {request.clientSignature && (
              <div className="bg-white rounded-lg border border-green-200 p-4 inline-block">
                <p className="text-xs text-gray-500 mb-2">Your signature:</p>
                <img
                  src={request.clientSignature}
                  alt="Your signature"
                  className="max-h-[80px] mx-auto"
                />
              </div>
            )}
          </div>
        )}

        {/* Document Content */}
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold">{request.title}</h2>
          </div>
          {request.description && (
            <p className="text-gray-500 text-sm mb-4">{request.description}</p>
          )}
          <div
            className="prose max-w-none border rounded-lg p-6 bg-gray-50"
            dangerouslySetInnerHTML={{ __html: request.documentContent || "" }}
          />
        </div>

        {/* Signing Section - only show if not yet signed */}
        {!alreadySignedByClient && request.status === "PENDING_CLIENT" && (
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <PenTool className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Sign Document</h2>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-1">Signing as:</p>
              <p className="font-medium text-gray-900">{request.clientName}</p>
            </div>

            <div className="mb-4">
              <Label className="mb-2 block text-sm font-medium">Your Signature</Label>
              <SignatureCanvas onChange={setSignature} />
            </div>

            <div className="flex items-start gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(!!checked)}
                className="mt-0.5"
              />
              <Label htmlFor="agree" className="text-sm text-gray-600 leading-relaxed cursor-pointer">
                I agree that my electronic signature is the legal equivalent of my handwritten
                signature. I intend to be legally bound by the terms of this document.
              </Label>
            </div>

            <Button
              onClick={handleSign}
              disabled={!signature || !agreed || clientSign.isPending}
              className="w-full bg-blue-500 hover:bg-blue-600"
              size="lg"
            >
              <PenTool className="h-4 w-4 mr-2" />
              {clientSign.isPending ? "Signing..." : "Sign Document"}
            </Button>

            {clientSign.isError && (
              <p className="text-sm text-red-500 mt-3 text-center">
                {clientSign.error.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

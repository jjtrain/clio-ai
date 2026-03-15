"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { SignatureCanvas } from "@/components/signature-canvas";
import {
  ArrowLeft,
  Send,
  Ban,
  Copy,
  Check,
  PenTool,
  Clock,
  CheckCircle2,
  FileText,
  RefreshCw,
  Bell,
  ExternalLink,
  Download,
} from "lucide-react";

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  PENDING_CLIENT: { label: "Awaiting Client Signature", className: "bg-amber-50 text-amber-700 border-amber-200" },
  CLIENT_SIGNED: { label: "Client Signed", className: "bg-blue-50 text-blue-700 border-blue-200" },
  PENDING_ATTORNEY: { label: "Awaiting Attorney Signature", className: "bg-purple-50 text-purple-700 border-purple-200" },
  COMPLETED: { label: "Completed", className: "bg-green-50 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700 border-red-200" },
  EXPIRED: { label: "Expired", className: "bg-gray-100 text-gray-500" },
};

const statusSteps = ["DRAFT", "PENDING_CLIENT", "CLIENT_SIGNED", "PENDING_ATTORNEY", "COMPLETED"];

function StatusTimeline({ current }: { current: string }) {
  const stepLabels: Record<string, string> = {
    DRAFT: "Draft",
    PENDING_CLIENT: "Sent",
    CLIENT_SIGNED: "Client Signed",
    PENDING_ATTORNEY: "Attorney Review",
    COMPLETED: "Complete",
  };
  const currentIdx = statusSteps.indexOf(current);

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {statusSteps.map((step, i) => {
        const isCompleted = currentIdx > i;
        const isCurrent = currentIdx === i;
        return (
          <div key={step} className="flex items-center gap-1">
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                  isCompleted
                    ? "bg-green-100 text-green-600"
                    : isCurrent
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  isCurrent ? "font-medium text-blue-600" : isCompleted ? "text-green-600" : "text-gray-400"
                }`}
              >
                {stepLabels[step]}
              </span>
            </div>
            {i < statusSteps.length - 1 && (
              <div className={`w-6 h-px ${isCompleted ? "bg-green-300" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SignatureDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [attorneySignature, setAttorneySignature] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: request, isLoading } = trpc.signatures.getById.useQuery({ id });

  const sendRequest = trpc.signatures.send.useMutation({
    onSuccess: () => {
      toast({ title: "Signature request sent" });
      utils.signatures.getById.invalidate({ id });
    },
  });
  const resendRequest = trpc.signatures.resend.useMutation({
    onSuccess: () => {
      toast({ title: "Signing email resent" });
    },
  });
  const cancelRequest = trpc.signatures.cancel.useMutation({
    onSuccess: () => {
      toast({ title: "Signature request cancelled" });
      utils.signatures.getById.invalidate({ id });
    },
  });
  const attorneySign = trpc.signatures.attorneySign.useMutation({
    onSuccess: () => {
      toast({ title: "Document countersigned successfully" });
      utils.signatures.getById.invalidate({ id });
    },
  });

  // HelloSign mutations
  const hsRemind = trpc.signatures.sendHellosignReminder.useMutation({
    onSuccess: () => toast({ title: "Reminder sent via HelloSign" }),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const hsRefresh = trpc.signatures.helloSignRefreshStatus.useMutation({
    onSuccess: () => {
      toast({ title: "Status refreshed from HelloSign" });
      utils.signatures.getById.invalidate({ id });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const hsDownload = trpc.signatures.downloadHellosignDocument.useMutation({
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const createHsRequest = trpc.signatures.createHellosignRequest.useMutation({
    onSuccess: () => {
      toast({ title: "Sent to HelloSign" });
      utils.signatures.getById.invalidate({ id });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleCopyLink = () => {
    if (!request) return;
    const url = `${window.location.origin}/sign/${request.signingToken}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleAttorneySign = () => {
    if (!attorneySignature) {
      toast({ title: "Please draw your signature first", variant: "destructive" });
      return;
    }
    attorneySign.mutate({ id, signature: attorneySignature });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!request) {
    return <div className="text-center py-12 text-gray-500">Signature request not found</div>;
  }

  const config = statusConfig[request.status] || statusConfig.DRAFT;
  const canSend = request.status === "DRAFT";
  const canResend = request.status === "PENDING_CLIENT";
  const canCancel = !["COMPLETED", "CANCELLED"].includes(request.status);
  const needsAttorneySign = request.status === "PENDING_ATTORNEY" || request.status === "CLIENT_SIGNED";
  const isHelloSign = (request as any).signingProvider === "hellosign";
  const hasHsRequestId = !!(request as any).helloSignRequestId;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/signatures">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{request.title}</h1>
          <p className="text-gray-500">
            {request.matter?.name} &middot; {request.clientName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isHelloSign && (
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">
              <PenTool className="h-3 w-3 mr-1" />
              HelloSign
            </Badge>
          )}
          <Badge className={config.className}>{config.label}</Badge>
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <StatusTimeline current={request.status} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {canSend && !hasHsRequestId && (
          <Button
            onClick={() => sendRequest.mutate({ id })}
            disabled={sendRequest.isPending}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Send className="h-4 w-4 mr-2" />
            Send to Client
          </Button>
        )}
        {canSend && !hasHsRequestId && (
          <Button
            variant="outline"
            onClick={() => createHsRequest.mutate({ signatureRequestId: id })}
            disabled={createHsRequest.isPending}
            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
          >
            <PenTool className="h-4 w-4 mr-2" />
            {createHsRequest.isPending ? "Sending..." : "Send via HelloSign"}
          </Button>
        )}
        {canResend && !hasHsRequestId && (
          <Button
            variant="outline"
            onClick={() => resendRequest.mutate({ id })}
            disabled={resendRequest.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            Resend Email
          </Button>
        )}
        {canCancel && (
          <Button
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={() => cancelRequest.mutate({ id })}
            disabled={cancelRequest.isPending}
          >
            <Ban className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        )}
        {request.status !== "DRAFT" && !hasHsRequestId && (
          <Button variant="outline" onClick={handleCopyLink}>
            {linkCopied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {linkCopied ? "Copied!" : "Copy Signing Link"}
          </Button>
        )}

        {/* HelloSign-specific actions */}
        {hasHsRequestId && (
          <>
            <Button
              variant="outline"
              onClick={() => hsRefresh.mutate({ id })}
              disabled={hsRefresh.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${hsRefresh.isPending ? "animate-spin" : ""}`} />
              Refresh Status
            </Button>
            {canResend && (
              <Button
                variant="outline"
                onClick={() => hsRemind.mutate({ id, signer: "client" })}
                disabled={hsRemind.isPending}
              >
                <Bell className="h-4 w-4 mr-2" />
                Remind Client
              </Button>
            )}
            {needsAttorneySign && (request as any).attorneyEmail && (
              <Button
                variant="outline"
                onClick={() => hsRemind.mutate({ id, signer: "attorney" })}
                disabled={hsRemind.isPending}
              >
                <Bell className="h-4 w-4 mr-2" />
                Remind Attorney
              </Button>
            )}
            {request.status === "COMPLETED" && (
              <Button
                variant="outline"
                onClick={() => hsDownload.mutate({ id })}
                disabled={hsDownload.isPending}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Signed PDF
              </Button>
            )}
          </>
        )}
      </div>

      {/* HelloSign Provider Badge */}
      {isHelloSign && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <PenTool className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">Sent via HelloSign (Dropbox Sign)</p>
            <p className="text-xs text-blue-600">Signers will receive an email from HelloSign with a secure signing link</p>
          </div>
          <div className="flex items-center gap-3">
            {(request as any).hellosignStatus && (
              <Badge className="bg-blue-100 text-blue-700 text-[10px]">
                {(request as any).hellosignStatus}
              </Badge>
            )}
            {(request as any).helloSignRequestId && (
              <span className="text-[10px] font-mono text-blue-400">ID: {(request as any).helloSignRequestId.slice(0, 12)}...</span>
            )}
          </div>
        </div>
      )}

      {/* HelloSign File URL */}
      {(request as any).helloSignFileUrl && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <Download className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">Signed document available</p>
            <p className="text-xs text-green-600">Download the completed, signed PDF</p>
          </div>
          <a href={(request as any).helloSignFileUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="text-green-700 border-green-300">
              <ExternalLink className="h-3 w-3 mr-1" /> Open PDF
            </Button>
          </a>
        </div>
      )}

      {/* Document Preview */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-400" />
          Document
        </h3>
        <div
          className="prose max-w-none border rounded-lg p-6 bg-gray-50"
          dangerouslySetInnerHTML={{ __html: request.documentContent || "" }}
        />
      </div>

      {/* Signatures */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Client Signature */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Client Signature</h3>
          <p className="text-sm text-gray-500 mb-2">{request.clientName}</p>
          {request.clientSignature ? (
            <div>
              <div className="border rounded-lg p-4 bg-gray-50">
                <img
                  src={request.clientSignature}
                  alt="Client signature"
                  className="max-h-[120px] mx-auto"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Signed: {request.clientSignedAt && new Date(request.clientSignedAt).toLocaleString()}
              </p>
            </div>
          ) : request.clientSignedAt ? (
            <div className="border rounded-lg p-4 bg-green-50 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <p className="text-sm text-green-700">Signed via HelloSign</p>
              <p className="text-xs text-green-500 mt-1">
                {new Date(request.clientSignedAt).toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
              <Clock className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm">Awaiting signature</p>
            </div>
          )}
        </div>

        {/* Attorney Signature */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Attorney Signature</h3>
          <p className="text-sm text-gray-500 mb-2">{request.attorneyName || "Attorney"}</p>
          {request.attorneySignature ? (
            <div>
              <div className="border rounded-lg p-4 bg-gray-50">
                <img
                  src={request.attorneySignature}
                  alt="Attorney signature"
                  className="max-h-[120px] mx-auto"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Signed: {request.attorneySignedAt && new Date(request.attorneySignedAt).toLocaleString()}
              </p>
            </div>
          ) : request.attorneySignedAt ? (
            <div className="border rounded-lg p-4 bg-green-50 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <p className="text-sm text-green-700">Signed via HelloSign</p>
              <p className="text-xs text-green-500 mt-1">
                {new Date(request.attorneySignedAt).toLocaleString()}
              </p>
            </div>
          ) : needsAttorneySign && !isHelloSign ? (
            <div className="space-y-4">
              <SignatureCanvas onChange={setAttorneySignature} />
              <Button
                onClick={handleAttorneySign}
                disabled={!attorneySignature || attorneySign.isPending}
                className="w-full bg-blue-500 hover:bg-blue-600"
              >
                <PenTool className="h-4 w-4 mr-2" />
                {attorneySign.isPending ? "Signing..." : "Countersign Document"}
              </Button>
            </div>
          ) : needsAttorneySign && isHelloSign ? (
            <div className="border-2 border-dashed border-indigo-200 rounded-lg p-8 text-center text-indigo-400">
              <PenTool className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm">Awaiting signature via HelloSign</p>
              <p className="text-xs mt-1">Attorney will receive an email from HelloSign</p>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
              <Clock className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm">Awaiting client signature first</p>
            </div>
          )}
        </div>
      </div>

      {/* Completed Banner */}
      {request.status === "COMPLETED" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800">Document Fully Executed</p>
            <p className="text-sm text-green-600">
              Completed on {request.completedAt && new Date(request.completedAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

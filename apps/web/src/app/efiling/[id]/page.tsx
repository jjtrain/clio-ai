"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Trash2,
  Pencil,
  RefreshCw,
  Star,
  Users,
  Building2,
  AlertCircle,
  Loader2,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  VALIDATING: "bg-blue-100 text-blue-700 animate-pulse",
  READY: "bg-emerald-100 text-emerald-700",
  SUBMITTING: "bg-blue-100 text-blue-700 animate-pulse",
  SUBMITTED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
};

const FILING_TYPE_COLORS: Record<string, string> = {
  INITIAL: "bg-purple-100 text-purple-700",
  SUBSEQUENT: "bg-blue-100 text-blue-700",
  SERVICE: "bg-amber-100 text-amber-700",
};

const TIMELINE_STEPS = [
  { status: "DRAFT", label: "Draft" },
  { status: "READY", label: "Validated" },
  { status: "SUBMITTED", label: "Submitted" },
  { status: "ACCEPTED", label: "Accepted" },
];

export default function FilingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;
  const utils = trpc.useUtils();

  const { data: filing, isLoading } = trpc.efiling.getById.useQuery({ id });

  const validateMut = trpc.efiling.validate.useMutation({
    onSuccess: (result) => {
      utils.efiling.getById.invalidate({ id });
      if (result.isValid) {
        toast({ title: "Validation passed" });
      } else {
        toast({ title: "Validation failed", description: `${result.errors?.length} error(s)`, variant: "destructive" });
      }
    },
  });
  const submitMut = trpc.efiling.submit.useMutation({
    onSuccess: (data) => {
      utils.efiling.getById.invalidate({ id });
      toast({ title: "Filing submitted!", description: `Confirmation: ${data.confirmationNumber}` });
    },
  });
  const checkStatusMut = trpc.efiling.checkStatus.useQuery({ submissionId: id }, { enabled: false });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;
  if (!filing) return <div className="py-20 text-center text-gray-500">Filing not found</div>;

  const documents = (() => { try { return JSON.parse(filing.documents); } catch { return []; } })();
  const serviceList = (() => { try { return filing.serviceList ? JSON.parse(filing.serviceList) : []; } catch { return []; } })();

  const statusIdx = TIMELINE_STEPS.findIndex((s) => s.status === filing.status);
  const isRejected = filing.status === "REJECTED";
  const isAccepted = filing.status === "ACCEPTED";

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/efiling"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{filing.title}</h1>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[filing.status]}`}>
                {filing.status}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {filing.court.name}</span>
              {filing.caseNumber && <span className="font-mono">{filing.caseNumber}</span>}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${FILING_TYPE_COLORS[filing.filingType]}`}>
                {filing.filingType}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filing.status === "DRAFT" && (
            <>
              <Button variant="outline" size="sm" onClick={() => validateMut.mutate({ submissionId: id })} disabled={validateMut.isPending}>
                {validateMut.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                Validate
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/efiling/new?edit=${id}`}><Pencil className="h-3 w-3 mr-1" /> Edit</Link>
              </Button>
            </>
          )}
          {filing.status === "READY" && (
            <Button className="bg-blue-600 hover:bg-blue-700" size="sm" onClick={() => submitMut.mutate({ submissionId: id })} disabled={submitMut.isPending}>
              {submitMut.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
              Submit
            </Button>
          )}
          {filing.status === "REJECTED" && (
            <Button variant="outline" size="sm" className="text-red-600 border-red-200" asChild>
              <Link href={`/efiling/new?edit=${id}`}><RefreshCw className="h-3 w-3 mr-1" /> Correct & Resubmit</Link>
            </Button>
          )}
          {filing.status === "SUBMITTED" && (
            <Button variant="outline" size="sm" onClick={() => utils.efiling.getById.invalidate({ id })}>
              <RefreshCw className="h-3 w-3 mr-1" /> Check Status
            </Button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between">
          {TIMELINE_STEPS.map((s, i) => {
            const completed = isAccepted ? true : (statusIdx >= i && !isRejected);
            const current = (!isRejected && !isAccepted && statusIdx === i);
            return (
              <div key={s.status} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 ${current ? "text-blue-700" : completed ? "text-green-600" : "text-gray-300"}`}>
                  {completed && !current ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : current ? (
                    <div className="h-6 w-6 rounded-full border-2 border-blue-500 flex items-center justify-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-gray-200" />
                  )}
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                {i < TIMELINE_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${completed ? "bg-green-300" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>
        {isRejected && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">Filing Rejected</p>
                <p className="text-sm text-red-600 mt-1">{filing.rejectionReason}</p>
                {filing.rejectedAt && <p className="text-xs text-red-400 mt-1">Rejected on {new Date(filing.rejectedAt).toLocaleString()}</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Filing Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold mb-4">Filing Information</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-gray-400">Court</dt><dd className="font-medium">{filing.court.name}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Case Number</dt><dd className="font-medium font-mono">{filing.caseNumber || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Filing Type</dt><dd className="font-medium">{filing.filingType}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Filer</dt><dd className="font-medium">{filing.filerName}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Filer Email</dt><dd className="font-medium">{filing.filerEmail}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Filed Date</dt><dd className="font-medium">{filing.filedAt ? new Date(filing.filedAt).toLocaleString() : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Confirmation #</dt><dd className="font-medium font-mono">{filing.confirmationNumber || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Filing Fee</dt><dd className="font-medium">{filing.feeWaived ? "Waived" : filing.filingFee ? `$${filing.filingFee}` : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Matter</dt><dd>
              <Link href={`/matters/${filing.matter.id}`} className="font-medium text-blue-600 hover:underline">
                {filing.matter.matterNumber} - {filing.matter.name}
              </Link>
            </dd></div>
          </dl>
        </div>

        {/* Documents */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold mb-4">Documents ({documents.length})</h2>
          <div className="space-y-2">
            {documents.map((doc: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.filename}</p>
                  <p className="text-xs text-gray-400">{doc.documentType}</p>
                </div>
                {doc.isLeadDocument && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600"><Star className="h-3 w-3 fill-amber-500" /> Lead</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Service List */}
      {serviceList.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold mb-4">Service List ({serviceList.length})</h2>
          <div className="space-y-2">
            {serviceList.map((party: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Users className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{party.name}</p>
                  <p className="text-xs text-gray-400">{party.email || party.address || "—"}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${party.type === "email" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                  {party.type === "email" ? "Electronic" : "Mail"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Log */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold mb-4">Activity Log</h2>
        {filing.activities.length === 0 ? (
          <p className="text-sm text-gray-400">No activity yet</p>
        ) : (
          <div className="space-y-3">
            {filing.activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{activity.action}</span>
                    <span className="text-xs text-gray-400">{new Date(activity.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-gray-500 text-xs">{activity.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

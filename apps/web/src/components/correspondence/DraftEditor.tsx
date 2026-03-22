"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  RefreshCw,
  Send,
  Loader2,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Clock,
  Sparkles,
  Mail,
  Printer,
  ChevronDown,
} from "lucide-react";

interface DraftEditorProps {
  draftId: string;
  onBack: () => void;
  onSent?: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  reviewed: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  sent: "bg-green-100 text-green-800",
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function readTimeMinutes(words: number): number {
  return Math.max(1, Math.round(words / 200));
}

export default function DraftEditor({ draftId, onBack, onSent }: DraftEditorProps) {
  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const draftQuery = trpc.correspondence.getDraft.useQuery({ draftId });
  const draft = draftQuery.data;

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [showAiBanner, setShowAiBanner] = useState(true);
  const [showSendDropdown, setShowSendDropdown] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regenerateFeedback, setRegenerateFeedback] = useState("");
  const [sentSuccess, setSentSuccess] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  const [sideTab, setSideTab] = useState<"context" | "versions" | "send">("context");
  const [sidePanelOpen, setSidePanelOpen] = useState(true);

  // Seed local state from draft once loaded
  useEffect(() => {
    if (draft) {
      setSubject(draft.subject ?? "");
      setBody(draft.editedBody ?? draft.body ?? "");
      setEditNotes(draft.editNotes ?? "");
      setDirty(false);
    }
  }, [draft]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const updateDraft = trpc.correspondence.updateDraft.useMutation({
    onSuccess: () => {
      setDirty(false);
      setSavedAt(new Date());
      draftQuery.refetch();
    },
  });

  const approveDraft = trpc.correspondence.approveDraft.useMutation({
    onSuccess: () => {
      draftQuery.refetch();
    },
  });

  const regenerate = trpc.correspondence.regenerate.useMutation({
    onSuccess: (data: any) => {
      if (data?.body) {
        setBody(data.body);
        setDirty(true);
      }
      setShowRegenerate(false);
      setRegenerateFeedback("");
      draftQuery.refetch();
    },
  });

  const sendViaEmail = trpc.correspondence.sendViaEmail.useMutation({
    onSuccess: () => {
      setSentSuccess(true);
      onSent?.();
      draftQuery.refetch();
    },
  });

  const mailtoQuery = trpc.correspondence.getMailtoLink.useQuery(
    { draftId },
    { enabled: false }
  );

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const handleFieldChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
    return (val: T) => {
      setter(val);
      setDirty(true);
    };
  };

  const handleSave = () => {
    updateDraft.mutate({
      draftId,
      editedBody: body,
      subject,
      editNotes,
      status: "reviewed" as const,
    });
  };

  const handleApprove = () => {
    approveDraft.mutate({ draftId });
  };

  const handleRegenerate = () => {
    regenerate.mutate({ draftId, feedback: regenerateFeedback || undefined });
  };

  const handleCopyToClipboard = async () => {
    await navigator.clipboard.writeText(body);
    setCopiedToClipboard(true);
    setTimeout(() => setCopiedToClipboard(false), 2000);
  };

  const handleMarkAsSent = (method: string) => {
    sendViaEmail.mutate({ draftId } as any);
    setShowSendDropdown(false);
  };

  const handleGetMailtoLink = () => {
    mailtoQuery.refetch();
  };

  const isLetterFormat = draft?.type === "letter";
  const words = wordCount(body);
  const readTime = readTimeMinutes(words);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (draftQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <span className="ml-3 text-slate-500">Loading draft…</span>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white">
        <p className="text-slate-500">Draft not found.</p>
        <button onClick={onBack} className="mt-4 text-sm text-blue-600 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Sent success state
  // ---------------------------------------------------------------------------
  if (sentSuccess) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white">
        <div className="rounded-full bg-green-100 p-4">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-slate-800">
          Correspondence sent successfully
        </h2>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onBack}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            View in Matter
          </button>
          <button
            onClick={() => {
              setSentSuccess(false);
              onBack();
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Draft Follow-up
          </button>
          <button
            onClick={onBack}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
          >
            Back to Hub
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-screen flex-col bg-white">
      {/* ── Top Bar ───────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {draft.matterName && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
              {draft.matterName}
            </span>
          )}

          <span
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              STATUS_STYLES[draft.status ?? "draft"] ?? STATUS_STYLES.draft
            }`}
          >
            {draft.status ?? "draft"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Regenerate */}
          <button
            onClick={() => setShowRegenerate(!showRegenerate)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </button>

          {/* Send dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSendDropdown(!showSendDropdown)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
              Send
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {showSendDropdown && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => handleMarkAsSent("email")}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Mail className="h-4 w-4" />
                  Send via Email
                </button>
                <button
                  onClick={() => handleMarkAsSent("print")}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4" />
                  Mark as Sent (Print)
                </button>
                <button
                  onClick={() => handleMarkAsSent("efile")}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FileText className="h-4 w-4" />
                  Mark as Sent (E-File)
                </button>
                <button
                  onClick={() => {
                    handleCopyToClipboard();
                    setShowSendDropdown(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-4 w-4" />
                  Copy to Clipboard
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Regenerate popover ────────────────────────────────────────────── */}
      {showRegenerate && (
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="mx-auto max-w-xl">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              What should be different? (optional)
            </label>
            <textarea
              value={regenerateFeedback}
              onChange={(e) => setRegenerateFeedback(e.target.value)}
              placeholder='Make it more aggressive, Add the settlement amount of $X, Shorten it…'
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={handleRegenerate}
                disabled={regenerate.isLoading}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {regenerate.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Regenerate
              </button>
              <button
                onClick={() => {
                  setShowRegenerate(false);
                  setRegenerateFeedback("");
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: editor */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-6">
            {/* AI Banner */}
            {showAiBanner && (
              <div className="mb-6 flex items-start gap-3 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 px-4 py-3">
                <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-500" />
                <p className="flex-1 text-sm text-purple-800">
                  AI drafted this based on{" "}
                  <span className="font-medium">{draft.matterName ?? "matter"}</span>{" "}
                  context. Review all facts, dates, and amounts before sending.
                </p>
                <button
                  onClick={() => setShowAiBanner(false)}
                  className="text-purple-400 hover:text-purple-600"
                  aria-label="Dismiss"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Subject Line */}
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-slate-600">
                {isLetterFormat ? "Re:" : "Subject:"}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => handleFieldChange(setSubject)(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            {/* Body Editor */}
            <div className="mb-4">
              <textarea
                value={body}
                onChange={(e) => handleFieldChange(setBody)(e.target.value)}
                className={`min-h-[500px] w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                  isLetterFormat ? "font-mono" : "font-sans"
                }`}
                style={
                  body.includes("[VERIFY") || body.includes("[CONFIRM")
                    ? undefined
                    : undefined
                }
              />
              {/* Verification warning */}
              {(body.includes("[VERIFY") || body.includes("[CONFIRM")) && (
                <p className="mt-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                  This draft contains items marked for verification. Look for{" "}
                  <span className="font-mono bg-yellow-200 px-1">[VERIFY…]</span> or{" "}
                  <span className="font-mono bg-yellow-200 px-1">[CONFIRM…]</span> tags.
                </p>
              )}
              <div className="mt-1 text-xs text-slate-400">
                {words} words &middot; ~{readTime} min read
              </div>
            </div>

            {/* Edit Notes */}
            <div className="mb-6">
              <label className="mb-1 block text-sm font-medium text-slate-600">
                Edit Notes
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => handleFieldChange(setEditNotes)(e.target.value)}
                placeholder="Add notes about your edits…"
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>

        {/* ── Side Panel ──────────────────────────────────────────────────── */}
        <aside
          className={`border-l border-slate-200 bg-slate-50 transition-all duration-200 ${
            sidePanelOpen ? "w-80" : "w-0 overflow-hidden"
          } hidden lg:block`}
        >
          {/* Collapse toggle */}
          <button
            onClick={() => setSidePanelOpen(!sidePanelOpen)}
            className="absolute right-0 top-1/2 z-10 -translate-x-full rounded-l-lg border border-r-0 border-slate-200 bg-white px-1 py-2 text-slate-400 hover:text-slate-600 lg:hidden"
          >
            <ChevronDown className={`h-4 w-4 ${sidePanelOpen ? "rotate-90" : "-rotate-90"}`} />
          </button>

          {sidePanelOpen && (
            <div className="flex h-full flex-col">
              {/* Tabs */}
              <div className="flex border-b border-slate-200">
                {(["context", "versions", "send"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSideTab(tab)}
                    className={`flex-1 px-3 py-2.5 text-xs font-medium capitalize ${
                      sideTab === tab
                        ? "border-b-2 border-blue-600 text-blue-600"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {/* Context tab */}
                {sideTab === "context" && (
                  <div className="text-sm text-slate-600 whitespace-pre-wrap">
                    {draft.aiContextSummary ?? (
                      <p className="text-slate-400 italic">No context summary available.</p>
                    )}
                  </div>
                )}

                {/* Versions tab */}
                {sideTab === "versions" && (
                  <div>
                    {draft.parentDraftId ? (
                      <ul className="space-y-2">
                        {(draft.versionChain ?? [{ id: draft.parentDraftId, label: "v1" }]).map(
                          (v: any, i: number) => (
                            <li
                              key={v.id ?? i}
                              className={`rounded-lg border px-3 py-2 text-sm ${
                                v.id === draftId
                                  ? "border-blue-300 bg-blue-50 text-blue-700"
                                  : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              {v.label ?? `v${i + 1}`}
                            </li>
                          )
                        )}
                        <li className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                          Current version
                        </li>
                      </ul>
                    ) : (
                      <p className="text-sm italic text-slate-400">
                        This is the original version.
                      </p>
                    )}
                  </div>
                )}

                {/* Send options tab */}
                {sideTab === "send" && (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleMarkAsSent("email")}
                      disabled={sendViaEmail.isLoading}
                      className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Mail className="h-4 w-4" />
                      Send via Email
                      {sendViaEmail.isLoading && (
                        <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                      )}
                    </button>

                    <button
                      onClick={handleGetMailtoLink}
                      className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Get mailto: link
                    </button>
                    {mailtoQuery.data && (
                      <a
                        href={mailtoQuery.data.mailto}
                        className="block truncate rounded bg-slate-100 px-2 py-1 text-xs text-blue-600 hover:underline"
                      >
                        {mailtoQuery.data.mailto}
                      </a>
                    )}

                    <button
                      onClick={handleCopyToClipboard}
                      className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {copiedToClipboard ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copiedToClipboard ? "Copied!" : "Copy to clipboard"}
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Mobile side panel (bottom sheet) */}
        <div className="border-t border-slate-200 bg-slate-50 p-4 lg:hidden">
          <button
            onClick={() => setSidePanelOpen(!sidePanelOpen)}
            className="flex w-full items-center justify-between text-sm font-medium text-slate-600"
          >
            <span>Details</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${sidePanelOpen ? "rotate-180" : ""}`}
            />
          </button>
          {sidePanelOpen && (
            <div className="mt-3">
              <div className="flex gap-2 mb-3">
                {(["context", "versions", "send"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSideTab(tab)}
                    className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                      sideTab === tab
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="max-h-48 overflow-y-auto text-sm text-slate-600">
                {sideTab === "context" && (
                  <p className="whitespace-pre-wrap">
                    {draft.aiContextSummary ?? "No context summary available."}
                  </p>
                )}
                {sideTab === "versions" && (
                  <p className="italic text-slate-400">
                    {draft.parentDraftId
                      ? "Version history available."
                      : "This is the original version."}
                  </p>
                )}
                {sideTab === "send" && (
                  <div className="space-y-1">
                    <button
                      onClick={handleCopyToClipboard}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      {copiedToClipboard ? "Copied!" : "Copy to clipboard"}
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="block text-blue-600 hover:underline text-xs"
                    >
                      Print
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky Save Bar ───────────────────────────────────────────────── */}
      <footer className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3">
        <div className="text-xs text-slate-400">
          {updateDraft.isLoading ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          ) : dirty ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Unsaved changes
            </span>
          ) : savedAt ? (
            <span className="flex items-center gap-1 text-green-600">
              <Check className="h-3 w-3" />
              Draft saved
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={updateDraft.isLoading}
            className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={handleApprove}
            disabled={approveDraft.isLoading}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {approveDraft.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Approve
          </button>
        </div>
      </footer>
    </div>
  );
}

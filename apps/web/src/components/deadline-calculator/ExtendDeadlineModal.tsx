"use client";

import React, { useState } from "react";
import { Calendar, X } from "lucide-react";

interface ExtendDeadlineModalProps {
  deadline: { id: string; name: string; deadlineDate: string };
  isOpen: boolean;
  onClose: () => void;
  onExtend: (deadlineId: string, newDate: string, reason: string) => void;
}

const REASON_OPTIONS = [
  "Stipulation with opposing counsel",
  "Court order",
  "Good cause",
  "Consent of all parties",
  "Custom",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    weekday: "short",
  });
}

export function ExtendDeadlineModal({
  deadline,
  isOpen,
  onClose,
  onExtend,
}: ExtendDeadlineModalProps) {
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [recalcDependents, setRecalcDependents] = useState(true);

  if (!isOpen) return null;

  const effectiveReason = reason === "Custom" ? customReason : reason;

  function handleSubmit() {
    if (!newDate || !effectiveReason) return;
    onExtend(deadline.id, newDate, effectiveReason);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h3 className="text-lg font-semibold text-slate-900">Extend Deadline</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Current deadline info */}
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">{deadline.name}</p>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              Current: {formatDate(deadline.deadlineDate)}
            </div>
          </div>

          {/* New date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              New deadline date
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason for extension
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a reason...</option>
              {REASON_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Custom reason input */}
          {reason === "Custom" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Custom reason
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter reason..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Recalculate checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={recalcDependents}
              onChange={(e) => setRecalcDependents(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600">
              Recalculate dependent deadlines
            </span>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!newDate || !effectiveReason}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Extend Deadline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

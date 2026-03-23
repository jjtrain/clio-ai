"use client";

import { useState } from "react";

interface StayChainModalProps {
  chainId: string;
  chainName: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (chainId: string, startDate: string, endDate: string, reason?: string) => void;
}

export default function StayChainModal({
  chainId,
  chainName,
  isOpen,
  onClose,
  onApply,
}: StayChainModalProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [untilFurtherOrder, setUntilFurtherOrder] = useState(false);
  const [reason, setReason] = useState("");

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(chainId, startDate, untilFurtherOrder ? "" : endDate, reason || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl p-6 w-full max-w-md shadow-lg z-10">
        <h2 className="text-lg font-semibold mb-4">
          Apply Stay &mdash; {chainName}
        </h2>

        {/* Stay start date */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stay Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Until further order toggle */}
        <div className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="untilFurtherOrder"
            checked={untilFurtherOrder}
            onChange={(e) => setUntilFurtherOrder(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="untilFurtherOrder" className="text-sm text-gray-700">
            Until further order
          </label>
        </div>

        {/* Stay end date */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stay End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={untilFurtherOrder}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          />
        </div>

        {/* Reason */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Optional reason for the stay..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Info text */}
        <p className="text-xs text-gray-500 mb-6">
          All pending deadlines after the stay start date will be extended by the
          duration of the stay.
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!startDate || (!untilFurtherOrder && !endDate)}
            className="px-4 py-2 text-sm font-medium text-gray-900 bg-yellow-400 rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply Stay
          </button>
        </div>
      </div>
    </div>
  );
}

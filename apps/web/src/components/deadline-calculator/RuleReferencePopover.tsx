"use client";

import React, { useState, useRef, useEffect } from "react";

interface RuleReferencePopoverProps {
  ruleReference: string;
  description?: string;
  category?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Responsive Pleading": { bg: "bg-red-100", text: "text-red-700" },
  Discovery: { bg: "bg-blue-100", text: "text-blue-700" },
  Motion: { bg: "bg-purple-100", text: "text-purple-700" },
  "Trial Prep": { bg: "bg-orange-100", text: "text-orange-700" },
  Administrative: { bg: "bg-gray-100", text: "text-gray-600" },
};

export function RuleReferencePopover({
  ruleReference,
  description,
  category,
}: RuleReferencePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const catColors =
    category && CATEGORY_COLORS[category]
      ? CATEGORY_COLORS[category]
      : null;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-blue-600 underline decoration-dotted underline-offset-2 hover:text-blue-700 transition-colors cursor-pointer"
      >
        {ruleReference}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <p className="text-sm font-semibold text-slate-900 mb-1">
            {ruleReference}
          </p>

          {description && (
            <p className="text-xs text-slate-500 mb-2 leading-relaxed">
              {description}
            </p>
          )}

          {catColors && category && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${catColors.bg} ${catColors.text} mb-3`}
            >
              {category}
            </span>
          )}

          <div className="border-t border-slate-100 pt-2 mt-2">
            <span className="text-xs text-blue-500 hover:text-blue-600 cursor-pointer">
              View full statute &rarr;
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

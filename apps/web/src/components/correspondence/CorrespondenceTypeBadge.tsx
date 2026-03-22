"use client";

interface CorrespondenceTypeBadgeProps {
  type: string;
  size?: "sm" | "md";
}

const TYPE_CONFIG: Record<string, { bg: string; label: string }> = {
  opposing_counsel_letter: { bg: "bg-blue-500", label: "Opposing Counsel" },
  client_update_email: { bg: "bg-green-500", label: "Client Update" },
  court_filing_cover: { bg: "bg-red-500", label: "Filing Cover" },
  demand_letter: { bg: "bg-orange-500", label: "Demand Letter" },
  settlement_offer: { bg: "bg-purple-500", label: "Settlement" },
  discovery_request_cover: { bg: "bg-teal-500", label: "Discovery" },
  scheduling_letter: { bg: "bg-indigo-500", label: "Scheduling" },
  custom: { bg: "bg-gray-500", label: "Custom" },
  status_update: { bg: "bg-sky-500", label: "Status Update" },
};

export default function CorrespondenceTypeBadge({
  type,
  size = "sm",
}: CorrespondenceTypeBadgeProps) {
  const config = TYPE_CONFIG[type] ?? { bg: "bg-gray-500", label: type };

  const sizeClasses =
    size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium text-white ${config.bg} ${sizeClasses}`}
    >
      {config.label}
    </span>
  );
}

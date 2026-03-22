"use client";

import { useState } from "react";
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
} from "lucide-react";

interface Party {
  name: string;
  role: string;
}

interface MatterContextCardProps {
  matter: {
    matterName: string;
    caseNumber: string;
    practiceArea?: string;
    status?: string;
    clientName?: string;
    parties?: Party[];
    upcomingEvents?: any[];
  };
  expandable?: boolean;
}

export default function MatterContextCard({
  matter,
  expandable = true,
}: MatterContextCardProps) {
  const [expanded, setExpanded] = useState(false);

  const canExpand =
    expandable &&
    (matter.clientName ||
      (matter.parties && matter.parties.length > 0) ||
      (matter.upcomingEvents && matter.upcomingEvents.length > 0));

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => canExpand && setExpanded(!expanded)}
        className={`flex w-full items-start justify-between p-4 text-left ${
          canExpand ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <div className="flex items-start gap-3">
          <Briefcase className="mt-0.5 h-5 w-5 text-slate-500" />
          <div>
            <p className="font-semibold text-slate-800">
              {matter.matterName}
            </p>
            <p className="text-sm text-slate-500">{matter.caseNumber}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {matter.practiceArea && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {matter.practiceArea}
                </span>
              )}
              {matter.status && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  {matter.status}
                </span>
              )}
            </div>
          </div>
        </div>

        {canExpand && (
          <div className="ml-2 mt-1 text-slate-400">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-200 px-4 pb-4 pt-3">
          {matter.clientName && (
            <div className="mb-3">
              <p className="text-xs font-medium uppercase text-slate-400">
                Client
              </p>
              <p className="text-sm text-slate-700">{matter.clientName}</p>
            </div>
          )}

          {matter.parties && matter.parties.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <p className="text-xs font-medium uppercase text-slate-400">
                  Parties
                </p>
              </div>
              <ul className="space-y-1">
                {matter.parties.map((party, idx) => (
                  <li key={idx} className="text-sm text-slate-700">
                    <span className="font-medium">{party.name}</span>
                    <span className="text-slate-400"> — {party.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {matter.upcomingEvents && matter.upcomingEvents.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <p className="text-xs font-medium uppercase text-slate-400">
                  Upcoming Events
                </p>
              </div>
              <ul className="space-y-1">
                {matter.upcomingEvents.map((event: any, idx: number) => (
                  <li key={idx} className="text-sm text-slate-700">
                    {event.title ?? event.name ?? JSON.stringify(event)}
                    {event.date && (
                      <span className="ml-2 text-xs text-slate-400">
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

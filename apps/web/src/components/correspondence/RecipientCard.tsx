"use client";

import { User, Edit2, Mail, Building } from "lucide-react";

interface RecipientContact {
  name: string;
  email?: string;
  firm?: string;
  address?: string;
  contactType: string;
  lastContacted?: string | Date;
}

interface RecipientCardProps {
  contact: RecipientContact;
  onEdit?: () => void;
  compact?: boolean;
}

const CONTACT_TYPE_LABELS: Record<string, string> = {
  opposing_counsel: "Opposing Counsel",
  client: "Client",
  co_counsel: "Co-Counsel",
  judge: "Judge",
  court_clerk: "Court Clerk",
  expert_witness: "Expert Witness",
  mediator: "Mediator",
  insurance_adjuster: "Insurance Adjuster",
};

function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}

export default function RecipientCard({
  contact,
  onEdit,
  compact = false,
}: RecipientCardProps) {
  const typeLabel =
    CONTACT_TYPE_LABELS[contact.contactType] ?? contact.contactType;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <User className="h-4 w-4 text-slate-400" />
        <span className="font-medium text-slate-800">{contact.name}</span>
        {contact.firm && (
          <>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">{contact.firm}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <User className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{contact.name}</p>
            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {typeLabel}
            </span>

            {contact.firm && (
              <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
                <Building className="h-3.5 w-3.5 text-slate-400" />
                {contact.firm}
              </div>
            )}

            {contact.email && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {contact.email}
              </div>
            )}

            {contact.address && (
              <p className="mt-1 text-sm text-slate-500">{contact.address}</p>
            )}

            {contact.lastContacted && (
              <p className="mt-2 text-xs text-slate-400">
                Last contacted: {formatTimeAgo(contact.lastContacted)}
              </p>
            )}
          </div>
        </div>

        {onEdit && (
          <button
            onClick={onEdit}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Edit2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

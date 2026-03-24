"use client";

import Link from "next/link";
import {
  Briefcase, User, FileText, Mail, Calendar, AlertCircle, Inbox, Target,
  StickyNote, DollarSign, ExternalLink, Clock, Flag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SearchResultCardProps {
  result: {
    id: string;
    entityType: string;
    title: string;
    subtitle?: string;
    matchContext?: string;
    relevanceScore: number;
    data: Record<string, any>;
  };
  onClick?: () => void;
}

const entityConfig: Record<string, {
  icon: any;
  color: string;
  bgColor: string;
  barColor: string;
  href: (id: string, data: any) => string;
  actions: { label: string; href: string }[];
}> = {
  matter: {
    icon: Briefcase,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    barColor: "bg-blue-500",
    href: (id) => `/matters/${id}`,
    actions: [{ label: "Open Matter", href: "/matters/" }],
  },
  contact: {
    icon: User,
    color: "text-green-600",
    bgColor: "bg-green-50",
    barColor: "bg-green-500",
    href: (id) => `/contacts/${id}`,
    actions: [{ label: "View Contact", href: "/contacts/" }],
  },
  document: {
    icon: FileText,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    barColor: "bg-purple-500",
    href: (id) => `/documents/${id}`,
    actions: [{ label: "Open Document", href: "/documents/" }],
  },
  correspondence: {
    icon: Mail,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    barColor: "bg-orange-500",
    href: (id) => `/correspondence/${id}`,
    actions: [{ label: "Open Draft", href: "/correspondence/" }],
  },
  calendarEvent: {
    icon: Calendar,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    barColor: "bg-cyan-500",
    href: (id) => `/calendar?event=${id}`,
    actions: [{ label: "View Event", href: "/calendar/" }],
  },
  deadline: {
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    barColor: "bg-red-500",
    href: (id, data) => data?.matterId ? `/matters/${data.matterId}` : `/deadline-calculator`,
    actions: [{ label: "View Chain", href: "/deadline-calculator" }],
  },
  intakeSession: {
    icon: Inbox,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    barColor: "bg-yellow-500",
    href: (id) => `/intake-screening/${id}`,
    actions: [{ label: "View Lead", href: "/intake-screening/" }],
  },
  prediction: {
    icon: Target,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    barColor: "bg-indigo-500",
    href: (id, data) => `/predictions?matter=${data?.matterId || id}`,
    actions: [{ label: "View Analysis", href: "/predictions/" }],
  },
  note: {
    icon: StickyNote,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    barColor: "bg-slate-500",
    href: (id, data) => data?.matterId ? `/matters/${data.matterId}` : `/matters`,
    actions: [{ label: "Open Matter", href: "/matters/" }],
  },
  billing: {
    icon: DollarSign,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    barColor: "bg-emerald-500",
    href: (id) => `/time/${id}`,
    actions: [{ label: "View Entry", href: "/time/" }],
  },
};

export function SearchResultCard({ result, onClick }: SearchResultCardProps) {
  const config = entityConfig[result.entityType] || entityConfig.matter;
  const Icon = config.icon;
  const href = config.href(result.id, result.data);

  const isOverdue = result.entityType === "deadline" && result.data.status === "overdue";
  const daysRemaining = result.data.daysRemaining;

  return (
    <Link href={href} onClick={onClick}>
      <div className={cn(
        "group flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer",
        isOverdue ? "border-red-200 bg-red-50/30" : "border-gray-100 bg-white"
      )}>
        {/* Left color bar + icon */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className={cn("w-1 h-8 rounded-full", isOverdue ? "bg-red-500 animate-pulse" : config.barColor)} />
          <div className={cn("flex items-center justify-center h-9 w-9 rounded-lg", config.bgColor)}>
            <Icon className={cn("h-4.5 w-4.5", config.color)} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                {result.title}
              </h3>
              {result.subtitle && (
                <p className="text-xs text-gray-500 truncate mt-0.5">{result.subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Status badges */}
              {isOverdue && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-semibold">
                  OVERDUE {daysRemaining ? `${Math.abs(daysRemaining)}d` : ""}
                </Badge>
              )}
              {result.data.status && !isOverdue && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                  {result.data.status}
                </Badge>
              )}
              {result.data.leadGrade && (
                <Badge
                  className={cn("text-[10px] px-1.5 py-0 font-bold", {
                    "bg-green-100 text-green-700": result.data.leadGrade === "A",
                    "bg-blue-100 text-blue-700": result.data.leadGrade === "B",
                    "bg-yellow-100 text-yellow-700": result.data.leadGrade === "C",
                    "bg-orange-100 text-orange-700": result.data.leadGrade === "D",
                    "bg-red-100 text-red-700": result.data.leadGrade === "F",
                  })}
                >
                  {result.data.leadGrade}
                </Badge>
              )}
              {result.data.overallScore !== undefined && (
                <div className="flex items-center gap-1">
                  <div className="h-5 w-5 rounded-full border-2 border-indigo-300 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-indigo-600">{Math.round(result.data.overallScore)}</span>
                  </div>
                </div>
              )}
              <ExternalLink className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
          </div>

          {/* Details row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {result.data.practiceArea && (
              <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                {result.data.practiceArea}
              </span>
            )}
            {result.data.matterName && (
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> {result.data.matterName}
              </span>
            )}
            {result.data.clientName && (
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <User className="h-3 w-3" /> {result.data.clientName}
              </span>
            )}
            {result.data.deadlineDate && (
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {new Date(result.data.deadlineDate).toLocaleDateString()}
              </span>
            )}
            {result.data.hours !== undefined && (
              <span className="text-[10px] text-gray-500">
                {result.data.hours}h · ${result.data.amount?.toFixed(2)}
              </span>
            )}
            {result.data.totalFlags !== undefined && result.data.totalFlags > 0 && (
              <span className="text-[10px] text-orange-500 flex items-center gap-1">
                <Flag className="h-3 w-3" /> {result.data.totalFlags} flags
              </span>
            )}
          </div>

          {/* Match context */}
          {result.matchContext && (
            <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
              {result.matchContext}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

"use client";

import { usePortalTheme, t } from "./PortalThemeProvider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Upload, CheckSquare, Calendar, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

interface MatterSummary {
  id: string;
  name: string;
  practiceArea?: string | null;
  status: string;
  unreadMessages: number;
  latestUpdate?: { title: string; publishedAt: Date | null } | null;
  checklistProgress?: { total: number; completed: number } | null;
}

interface PortalDashboardProps {
  userName: string;
  matters: MatterSummary[];
  unreadNotifications: number;
}

export function PortalDashboard({ userName, matters, unreadNotifications }: PortalDashboardProps) {
  const theme = usePortalTheme();
  const firstName = userName.split(" ")[0];

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Welcome Hero */}
      <div
        className="rounded-2xl p-6 text-white"
        style={{
          background: theme.gradientStart && theme.gradientEnd
            ? `linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd})`
            : theme.colorPrimary,
          borderRadius: theme.borderRadius,
        }}
      >
        <h1 className="text-xl font-bold mb-1">
          {theme.welcomeHeading || `Hello, ${firstName}`}
        </h1>
        <p className="text-white/80 text-sm leading-relaxed max-w-lg">
          {theme.welcomeSubtext || `Welcome back. Here's the latest on ${t("matter", theme)}.`}
        </p>
      </div>

      {/* Quick Actions */}
      {theme.quickActions && theme.quickActions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {theme.quickActions.map((action, i) => {
            const icons: Record<string, any> = { MessageCircle, Upload, CheckSquare, Calendar, FileText };
            const Icon = icons[action.icon] || MessageCircle;
            const matterId = matters[0]?.id;
            const href = action.icon === "MessageCircle" ? `/portal/matter/${matterId}/messages` :
                         action.icon === "Upload" ? `/portal/matter/${matterId}/documents` :
                         action.icon === "CheckSquare" ? `/portal/matter/${matterId}/checklist` :
                         `/portal`;

            return (
              <Link key={i} href={href}>
                <Card
                  className="p-4 text-center hover:shadow-md transition-shadow cursor-pointer"
                  style={{ borderRadius: theme.borderRadius }}
                >
                  <div
                    className="h-10 w-10 rounded-lg mx-auto mb-2 flex items-center justify-center"
                    style={{ backgroundColor: theme.colorPrimary + "15" }}
                  >
                    <Icon className="h-5 w-5" style={{ color: theme.colorPrimary }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: theme.colorText }}>
                    {action.label}
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Matters */}
      {matters.map((matter) => (
        <Link key={matter.id} href={`/portal/matter/${matter.id}`}>
          <Card
            className="p-4 hover:shadow-md transition-shadow cursor-pointer"
            style={{ borderRadius: theme.borderRadius }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: theme.colorText }}>
                  {matter.name}
                </h2>
                {matter.practiceArea && (
                  <span className="text-xs" style={{ color: theme.colorMuted }}>
                    {matter.practiceArea}
                  </span>
                )}
              </div>
              <ArrowRight className="h-4 w-4" style={{ color: theme.colorMuted }} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Latest Update */}
              {matter.latestUpdate && (
                <div className="text-xs">
                  <p className="font-medium" style={{ color: theme.colorPrimary }}>Latest Update</p>
                  <p style={{ color: theme.colorMuted }} className="truncate">{matter.latestUpdate.title}</p>
                </div>
              )}

              {/* Messages */}
              <div className="text-xs">
                <p className="font-medium" style={{ color: theme.colorPrimary }}>Messages</p>
                <p style={{ color: theme.colorMuted }}>
                  {matter.unreadMessages > 0 ? (
                    <span className="text-red-500 font-medium">{matter.unreadMessages} unread</span>
                  ) : "All read"}
                </p>
              </div>

              {/* Checklist */}
              {matter.checklistProgress && (
                <div className="text-xs">
                  <p className="font-medium" style={{ color: theme.colorPrimary }}>Checklist</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(matter.checklistProgress.completed / matter.checklistProgress.total) * 100}%`,
                          backgroundColor: theme.colorPrimary,
                        }}
                      />
                    </div>
                    <span style={{ color: theme.colorMuted }}>
                      {matter.checklistProgress.completed}/{matter.checklistProgress.total}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Link>
      ))}

      {/* FAQ */}
      {theme.faqItems && theme.faqItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: theme.colorText }}>
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {theme.faqItems.map((faq, i) => (
              <Card key={i} className="p-3" style={{ borderRadius: theme.borderRadius }}>
                <p className="text-xs font-medium mb-1" style={{ color: theme.colorPrimary }}>{faq.q}</p>
                <p className="text-xs leading-relaxed" style={{ color: theme.colorMuted }}>{faq.a}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { ClientTimelineView } from "@/components/timeline/ClientTimeline";
import { PortalThemeProvider } from "@/components/portal/PortalThemeProvider";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortal } from "../../../portal-context";

export default function PortalTimelinePage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = usePortal();

  const { data: timeline } = trpc.clientTimeline.getPortalTimeline.useQuery(
    { sessionToken: token || "", matterId: id },
    { enabled: !!token && !!id }
  );

  const { data: theme } = trpc.portalClient.getTheme.useQuery(
    { practiceArea: timeline?.practiceArea || "general" },
    { enabled: !!timeline?.practiceArea }
  );

  return (
    <PortalThemeProvider theme={(theme as any) || undefined}>
      <PortalLayout matterId={id} userName={user?.name}>
        {timeline ? (
          <ClientTimelineView timeline={timeline} />
        ) : (
          <div className="text-center py-16 text-sm text-gray-500">Loading timeline...</div>
        )}
      </PortalLayout>
    </PortalThemeProvider>
  );
}

"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { PortalCaseStatus } from "@/components/portal/PortalCaseStatus";
import { PortalThemeProvider } from "@/components/portal/PortalThemeProvider";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortal } from "../../portal-context";

export default function PortalMatterPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = usePortal();

  const { data } = trpc.portalClient.getMatterOverview.useQuery(
    { sessionToken: token || "", matterId: id },
    { enabled: !!token && !!id }
  );

  const { data: theme } = trpc.portalClient.getTheme.useQuery(
    { practiceArea: data?.matter?.practiceArea || "general" },
    { enabled: !!data?.matter?.practiceArea }
  );

  if (!data?.matter) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  return (
    <PortalThemeProvider theme={(theme as any) || undefined}>
      <PortalLayout matterId={id} userName={user?.name}>
        <PortalCaseStatus
          matterName={data.matter.name}
          practiceArea={data.matter.practiceArea}
          statusUpdates={data.statusUpdates}
          upcomingEvents={data.upcomingEvents}
        />
      </PortalLayout>
    </PortalThemeProvider>
  );
}

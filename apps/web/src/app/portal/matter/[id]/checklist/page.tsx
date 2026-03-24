"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { PortalChecklist } from "@/components/portal/PortalChecklist";
import { PortalThemeProvider } from "@/components/portal/PortalThemeProvider";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortal } from "../../../portal-context";

export default function PortalChecklistPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = usePortal();

  const { data: checklist, refetch } = trpc.portalClient.getMatterChecklist.useQuery(
    { sessionToken: token || "", matterId: id },
    { enabled: !!token && !!id }
  );

  const updateItem = trpc.portalClient.updateChecklistItem.useMutation({
    onSuccess: () => refetch(),
  });

  if (!checklist) {
    return (
      <PortalThemeProvider>
        <PortalLayout matterId={id} userName={user?.name}>
          <div className="text-center py-16 text-gray-500 text-sm">No checklist available yet.</div>
        </PortalLayout>
      </PortalThemeProvider>
    );
  }

  return (
    <PortalThemeProvider>
      <PortalLayout matterId={id} userName={user?.name}>
        <PortalChecklist
          title={checklist.title}
          items={(checklist.items as any[]) || []}
          totalItems={checklist.totalItems}
          completedItems={checklist.completedItems}
          onToggleItem={(itemId, isCompleted) =>
            updateItem.mutate({ sessionToken: token || "", checklistId: checklist.id, itemId, isCompleted })
          }
        />
      </PortalLayout>
    </PortalThemeProvider>
  );
}

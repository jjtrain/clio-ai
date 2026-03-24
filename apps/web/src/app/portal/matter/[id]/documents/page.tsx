"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { PortalDocuments } from "@/components/portal/PortalDocuments";
import { PortalThemeProvider } from "@/components/portal/PortalThemeProvider";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortal } from "../../../portal-context";

export default function PortalDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = usePortal();

  const { data: documents } = trpc.portalClient.getMatterDocuments.useQuery(
    { sessionToken: token || "", matterId: id },
    { enabled: !!token && !!id }
  );

  return (
    <PortalThemeProvider>
      <PortalLayout matterId={id} userName={user?.name}>
        <PortalDocuments documents={documents || []} />
      </PortalLayout>
    </PortalThemeProvider>
  );
}

"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { PortalBilling } from "@/components/portal/PortalBilling";
import { PortalThemeProvider } from "@/components/portal/PortalThemeProvider";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortal } from "../../../portal-context";

export default function PortalBillingPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = usePortal();

  const { data: invoices } = trpc.portalClient.getMatterInvoices.useQuery(
    { sessionToken: token || "", matterId: id },
    { enabled: !!token && !!id }
  );

  return (
    <PortalThemeProvider>
      <PortalLayout matterId={id} userName={user?.name}>
        <PortalBilling invoices={invoices || []} />
      </PortalLayout>
    </PortalThemeProvider>
  );
}

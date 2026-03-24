"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { PortalMessages } from "@/components/portal/PortalMessages";
import { PortalThemeProvider } from "@/components/portal/PortalThemeProvider";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortal } from "../../../portal-context";

export default function PortalMessagesPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = usePortal();

  const { data: messages, refetch } = trpc.portalClient.getMatterMessages.useQuery(
    { sessionToken: token || "", matterId: id },
    { enabled: !!token && !!id }
  );

  const sendMutation = trpc.portalClient.sendMessage.useMutation({
    onSuccess: () => refetch(),
  });

  return (
    <PortalThemeProvider>
      <PortalLayout matterId={id} userName={user?.name}>
        <PortalMessages
          messages={messages || []}
          onSend={(body) => sendMutation.mutate({ sessionToken: token || "", matterId: id, body })}
          isSending={sendMutation.isLoading}
        />
      </PortalLayout>
    </PortalThemeProvider>
  );
}

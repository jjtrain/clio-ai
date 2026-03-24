"use client";

export const dynamic = "force-dynamic";

import { Video, CheckCircle, Unlink, Zap, ExternalLink, Clock, Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { id: "ZOOM", name: "Zoom", color: "bg-blue-500", logo: "Z", connectUrl: "/api/meetings/zoom/connect", description: "Create and manage Zoom meetings directly from matters", sandboxUrl: "https://marketplace.zoom.us" },
  { id: "TEAMS", name: "Microsoft Teams", color: "bg-violet-500", logo: "T", connectUrl: "/api/meetings/teams/connect", description: "Schedule Teams meetings with automatic calendar integration", sandboxUrl: "https://portal.azure.com" },
];

export default function MeetingSettingsPage() {
  const connQuery = trpc.meetingsUnified.getConnectionStatus.useQuery();
  const conn = connQuery.data;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Video className="h-7 w-7 text-blue-600" /> Meeting Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Connect Zoom and Microsoft Teams for video meetings</p>
      </div>

      {PROVIDERS.map((provider) => {
        const connection = provider.id === "ZOOM" ? conn?.zoom : conn?.teams;
        const isConnected = !!connection;

        return (
          <Card key={provider.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl", provider.color)}>
                  {provider.logo}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{provider.name}</h3>
                    {isConnected ? (
                      <Badge className="text-[10px] bg-green-100 text-green-700">Connected</Badge>
                    ) : (
                      <Badge className="text-[10px] bg-gray-100 text-gray-500">Not Connected</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{provider.description}</p>
                  {isConnected && connection && (
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      {(connection as any).email}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {isConnected ? (
                  <Button variant="outline" size="sm" className="text-red-600">
                    <Unlink className="h-3 w-3 mr-1" /> Disconnect
                  </Button>
                ) : (
                  <a href={provider.connectUrl}>
                    <Button size="sm" className="gap-1"><Zap className="h-3 w-3" /> Connect</Button>
                  </a>
                )}
                <a href={provider.sandboxUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="text-xs text-gray-400">
                    <ExternalLink className="h-3 w-3 mr-1" /> Setup
                  </Button>
                </a>
              </div>
            </div>
          </Card>
        );
      })}

      {/* Default Settings */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Settings className="h-4 w-4 text-gray-400" /> Defaults
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-700">Default duration</span>
            <span className="text-gray-500">30 minutes</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-700">Send reminders</span>
            <span className="text-gray-500">24 hours before</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-700">Auto-create calendar event</span>
            <Badge className="text-[10px] bg-green-100 text-green-700">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-700">Auto-create time entry</span>
            <Badge className="text-[10px] bg-gray-100 text-gray-500">Disabled</Badge>
          </div>
        </div>
      </Card>

      {/* Setup Notes */}
      <Card className="p-5 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Setup Requirements</h3>
        <div className="grid gap-4 sm:grid-cols-2 text-xs text-gray-500">
          <div>
            <p className="font-semibold text-gray-700 mb-1">Zoom</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Create OAuth app at marketplace.zoom.us</li>
              <li>Scopes: meeting:write:admin, meeting:read:admin, user:read</li>
              <li>Redirect URI: /api/meetings/zoom/callback</li>
              <li>Webhook: /api/webhooks/zoom</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Microsoft Teams</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Register app at portal.azure.com</li>
              <li>Permissions: OnlineMeetings.ReadWrite, User.Read</li>
              <li>Redirect URI: /api/meetings/teams/callback</li>
              <li>Create client secret</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

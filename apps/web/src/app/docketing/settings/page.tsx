"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, XCircle, ExternalLink } from "lucide-react";

export default function DocketingSettingsPage() {
  const { data: status } = trpc.docketing.getIntegrationStatus.useQuery();

  const IntegrationCard = ({ name, configured, description, signupUrl, envVars }: {
    name: string; configured: boolean; description: string; signupUrl: string; envVars: string[];
  }) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{name}</CardTitle>
          {configured ? (
            <div className="flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" /><span className="text-sm font-medium">Connected</span></div>
          ) : (
            <div className="flex items-center gap-1 text-red-500"><XCircle className="h-4 w-4" /><span className="text-sm font-medium">Not Configured</span></div>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          <p className="font-medium mb-1">Required Environment Variables:</p>
          {envVars.map((v) => (
            <code key={v} className="block text-xs bg-slate-100 px-2 py-1 rounded mb-1 font-mono">{v}</code>
          ))}
        </div>
        {!configured && (
          <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
            Set the environment variables above in your Vercel project settings or .env file to enable this integration.
          </p>
        )}
        <a href={signupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ExternalLink className="h-3 w-3" /> Sign up / Get API credentials
        </a>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/docketing"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">Docketing Integration Settings</h1>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <IntegrationCard
          name="LawToolBox"
          configured={status?.lawToolBox.configured ?? false}
          description="Court rules deadline calculation engine. Supports federal, state, and local court rules with deadline chains triggered by case events."
          signupUrl="https://lawtoolbox.com"
          envVars={["LAWTOOLBOX_CLIENT_ID", "LAWTOOLBOX_CLIENT_SECRET", "LAWTOOLBOX_API_URL (optional)"]}
        />
        <IntegrationCard
          name="CourtDrive"
          configured={status?.courtDrive.configured ?? false}
          description="PACER/ECF integration for monitoring federal court filings. Automatically detects new filings and downloads documents."
          signupUrl="https://www.courtdrive.com"
          envVars={["COURTDRIVE_API_KEY", "COURTDRIVE_API_URL (optional)"]}
        />
        <IntegrationCard
          name="USPTO TSDR"
          configured={status?.uspto.configured ?? false}
          description="Trademark status and document retrieval. Monitors trademark prosecution status and calculates maintenance deadlines (Section 8, 9, 15)."
          signupUrl="https://account.uspto.gov/api-manager"
          envVars={["USPTO_API_KEY", "USPTO_TSDR_BASE_URL (optional)"]}
        />
      </div>
    </div>
  );
}

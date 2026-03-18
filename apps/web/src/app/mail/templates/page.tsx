"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, FileText, Mail, Plus } from "lucide-react";

export default function MailTemplatesPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.mail["templates.list"].useQuery({});
  const initMut = trpc.mail["templates.initialize"].useMutation({ onSuccess: () => { utils.mail["templates.list"].invalidate(); toast({ title: "Templates created" }); } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Mail Templates</h1><p className="text-sm text-slate-500">Cover letter and transmittal templates</p></div>
        <div className="flex gap-2">
          {(!templates || templates.length === 0) && <Button variant="outline" onClick={() => initMut.mutate()} disabled={initMut.isLoading}>{initMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Initialize Defaults</Button>}
        </div>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(templates || []).map((t: any) => (
            <Card key={t.id}>
              <CardContent className="pt-6">
                <p className="font-medium mb-1">{t.name}</p>
                {t.description && <p className="text-xs text-gray-500 mb-2">{t.description}</p>}
                <div className="flex gap-2 text-xs text-gray-400">
                  <span className="bg-gray-100 px-2 py-0.5 rounded">{t.purpose.replace(/_/g, " ")}</span>
                  {t.requiresCertified && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Certified</span>}
                  {t.includeReturnEnvelope && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Return Env</span>}
                </div>
                <p className="text-xs text-gray-300 mt-2">Used {t.usageCount} times</p>
              </CardContent>
            </Card>
          ))}
          {(!templates || templates.length === 0) && <Card className="col-span-full"><CardContent className="py-12 text-center text-gray-400"><FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No templates. Click "Initialize Defaults" to create starter templates.</p></CardContent></Card>}
        </div>
      )}
    </div>
  );
}

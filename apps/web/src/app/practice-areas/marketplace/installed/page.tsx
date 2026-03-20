"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RefreshCw, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function InstalledPage() {
  const [uninstallId, setUninstallId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: installed, isLoading } = trpc.practiceArea["community.getInstalled"].useQuery();
  const updateMutation = trpc.practiceArea["community.install"].useMutation({
    onSuccess: () => utils.practiceArea["community.getInstalled"].invalidate(),
  });
  const uninstallMutation = trpc.practiceArea["community.uninstall"].useMutation({
    onSuccess: () => {
      setUninstallId(null);
      utils.practiceArea["community.getInstalled"].invalidate();
    },
  });

  const handleCheckUpdates = () => utils.practiceArea["community.getInstalled"].invalidate();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Link href="/practice-areas/marketplace"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Marketplace</Button></Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Installed Pipelines</h1>
          <p className="text-gray-500">Manage your installed community pipeline templates</p>
        </div>
        <Button variant="outline" onClick={handleCheckUpdates}><RefreshCw className="mr-2 h-4 w-4" />Check for Updates</Button>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Practice Area</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Installed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-gray-400">Loading...</TableCell></TableRow>
            )}
            {installed?.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-gray-400">No installed templates.</TableCell></TableRow>
            )}
            {installed?.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.templateName}</TableCell>
                <TableCell>{item.practiceArea}</TableCell>
                <TableCell>v{item.version}</TableCell>
                <TableCell className="text-sm text-gray-500">{new Date(item.installedAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={item.updateAvailable ? "destructive" : "secondary"}>
                    {item.updateAvailable ? "Update Available" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {item.updateAvailable && (
                      <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ templateId: item.templateId, targetPracticeArea: item.practiceAreaId, mergeStrategy: "merge" })} disabled={updateMutation.isPending}>
                        Update
                      </Button>
                    )}
                    <Dialog open={uninstallId === item.id} onOpenChange={(open) => setUninstallId(open ? item.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Uninstall Template</DialogTitle>
                          <DialogDescription>Are you sure you want to uninstall &quot;{item.templateName}&quot;? This will not remove stages already in your pipeline.</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setUninstallId(null)}>Cancel</Button>
                          <Button variant="destructive" onClick={() => uninstallMutation.mutate({ installId: item.id })} disabled={uninstallMutation.isPending}>
                            {uninstallMutation.isPending ? "Removing..." : "Uninstall"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

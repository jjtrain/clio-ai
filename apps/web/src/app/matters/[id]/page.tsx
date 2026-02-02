"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Edit,
  MoreHorizontal,
  CheckCircle,
  RotateCcw,
  CheckSquare,
  Square,
  Plus,
  Clock,
  Flag,
  AlertCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

export default function MatterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const matterId = params.id as string;

  const { data: matter, isLoading } = trpc.matters.getById.useQuery({ id: matterId });
  const { data: matterTasks } = trpc.tasks.getByMatter.useQuery(
    { matterId, includeCompleted: false },
    { enabled: !!matterId }
  );
  const utils = trpc.useUtils();

  const toggleComplete = trpc.tasks.toggleComplete.useMutation({
    onSuccess: () => {
      utils.tasks.getByMatter.invalidate({ matterId });
    },
  });

  const closeMatter = trpc.matters.close.useMutation({
    onSuccess: () => {
      toast({ title: "Matter closed" });
      utils.matters.getById.invalidate({ id: matterId });
    },
  });

  const reopenMatter = trpc.matters.reopen.useMutation({
    onSuccess: () => {
      toast({ title: "Matter reopened" });
      utils.matters.getById.invalidate({ id: matterId });
    },
  });

  const isOverdue = (task: any) => {
    if (!task.dueDate || task.status === "COMPLETED") return false;
    const due = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  const priorityColors: Record<string, string> = {
    LOW: "text-gray-500",
    MEDIUM: "text-blue-600",
    HIGH: "text-orange-600",
    URGENT: "text-red-600",
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="success">Open</Badge>;
      case "CLOSED":
        return <Badge variant="secondary">Closed</Badge>;
      case "PENDING":
        return <Badge variant="warning">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!matter) {
    return <div>Matter not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/matters">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground">
                {matter.matterNumber}
              </span>
              {getStatusBadge(matter.status)}
            </div>
            <h1 className="text-3xl font-bold">{matter.name}</h1>
            <p className="text-muted-foreground">
              Client:{" "}
              <Link
                href={"/clients/" + matter.client.id}
                className="hover:underline"
              >
                {matter.client.name}
              </Link>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={"/matters/" + matterId + "/edit"}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {matter.status === "OPEN" || matter.status === "PENDING" ? (
                <DropdownMenuItem onClick={() => closeMatter.mutate({ id: matterId })}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Close Matter
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => reopenMatter.mutate({ id: matterId })}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reopen Matter
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Matter Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Practice Area</p>
              <p>{matter.practiceArea || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Opened</p>
              <p>{formatDate(matter.openDate)}</p>
            </div>
            {matter.closeDate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Closed</p>
                <p>{formatDate(matter.closeDate)}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="whitespace-pre-wrap">{matter.description || "No description"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <Link
                href={"/clients/" + matter.client.id}
                className="hover:underline"
              >
                {matter.client.name}
              </Link>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p>{matter.client.email || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Phone</p>
              <p>{matter.client.phone || "-"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Time Entries</CardTitle>
            <CardDescription>Latest time entries for this matter</CardDescription>
          </CardHeader>
          <CardContent>
            {matter.timeEntries.length === 0 ? (
              <p className="text-muted-foreground">No time entries yet</p>
            ) : (
              <p className="text-muted-foreground">Time tracking coming soon</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Documents for this matter</CardDescription>
          </CardHeader>
          <CardContent>
            {matter.documents.length === 0 ? (
              <p className="text-muted-foreground">No documents yet</p>
            ) : (
              <p className="text-muted-foreground">Document management coming soon</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tasks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>Open tasks for this matter</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/tasks?matterId=${matterId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!matterTasks || matterTasks.length === 0 ? (
            <div className="text-center py-6">
              <CheckSquare className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-muted-foreground">No open tasks</p>
              <Button variant="link" size="sm" asChild className="mt-2">
                <Link href={`/tasks`}>Create a task</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {matterTasks.map((task: any) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isOverdue(task) ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <button
                    onClick={() => toggleComplete.mutate({ id: task.id })}
                    className="flex-shrink-0"
                  >
                    {task.status === "COMPLETED" ? (
                      <CheckSquare className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium ${
                        isOverdue(task) ? "text-red-700" : "text-gray-900"
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs ${priorityColors[task.priority]}`}>
                        <Flag className="h-3 w-3 inline mr-1" />
                        {task.priority}
                      </span>
                      {task.dueDate && (
                        <span
                          className={`text-xs flex items-center gap-1 ${
                            isOverdue(task) ? "text-red-600 font-medium" : "text-gray-500"
                          }`}
                        >
                          {isOverdue(task) ? (
                            <AlertCircle className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {isOverdue(task) ? "Overdue: " : "Due: "}
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task.assignee && (
                        <span className="text-xs text-gray-500">
                          {task.assignee.name || task.assignee.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-2 text-center">
                <Button variant="link" size="sm" asChild>
                  <Link href={`/tasks?matterId=${matterId}`}>View all tasks</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

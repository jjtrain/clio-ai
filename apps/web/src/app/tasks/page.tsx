"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  CheckSquare,
  Square,
  MoreHorizontal,
  Edit,
  Trash2,
  Filter,
  AlertCircle,
  Clock,
  Flag,
  Briefcase,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const priorityColors = {
  LOW: "text-gray-500 bg-gray-100",
  MEDIUM: "text-blue-600 bg-blue-100",
  HIGH: "text-orange-600 bg-orange-100",
  URGENT: "text-red-600 bg-red-100",
};

const statusColors = {
  NOT_STARTED: "text-gray-600 bg-gray-100",
  IN_PROGRESS: "text-blue-600 bg-blue-100",
  COMPLETED: "text-emerald-600 bg-emerald-100",
};

export default function TasksPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [matterFilter, setMatterFilter] = useState<string>("");
  const [showCompleted, setShowCompleted] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [matterId, setMatterId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const { data: tasksData, isLoading } = trpc.tasks.list.useQuery({
    status: statusFilter as any || undefined,
    priority: priorityFilter as any || undefined,
    matterId: matterFilter || undefined,
    includeCompleted: showCompleted,
  });

  const { data: matters } = trpc.matters.list.useQuery({ status: "OPEN" });
  const { data: users } = trpc.users.list.useQuery();
  const { data: summary } = trpc.tasks.summary.useQuery();

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast({ title: "Task created" });
      utils.tasks.list.invalidate();
      utils.tasks.summary.invalidate();
      utils.tasks.dashboardSummary.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      toast({ title: "Task updated" });
      utils.tasks.list.invalidate();
      utils.tasks.summary.invalidate();
      utils.tasks.dashboardSummary.invalidate();
      setDialogOpen(false);
      setEditingTask(null);
      resetForm();
    },
  });

  const toggleComplete = trpc.tasks.toggleComplete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.tasks.summary.invalidate();
      utils.tasks.dashboardSummary.invalidate();
    },
  });

  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Task deleted" });
      utils.tasks.list.invalidate();
      utils.tasks.summary.invalidate();
      utils.tasks.dashboardSummary.invalidate();
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setDueDate("");
    setMatterId("");
    setAssigneeId("");
  };

  const handleOpenDialog = (task?: any) => {
    if (task) {
      setEditingTask(task);
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "");
      setMatterId(task.matterId || "");
      setAssigneeId(task.assigneeId || "");
    } else {
      setEditingTask(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      title,
      description: description || undefined,
      priority: priority as any,
      dueDate: dueDate || undefined,
      matterId: matterId || undefined,
      assigneeId: assigneeId || undefined,
    };

    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, ...data });
    } else {
      createTask.mutate(data);
    }
  };

  const isOverdue = (task: any) => {
    if (!task.dueDate || task.status === "COMPLETED") return false;
    const due = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  const isDueToday = (task: any) => {
    if (!task.dueDate || task.status === "COMPLETED") return false;
    const due = new Date(task.dueDate);
    const today = new Date();
    return (
      due.getDate() === today.getDate() &&
      due.getMonth() === today.getMonth() &&
      due.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
          <p className="text-gray-500 mt-1">Manage your tasks and deadlines</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 hover:bg-blue-600" onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTask ? "Edit Task" : "Create Task"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task description (optional)"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Matter (optional)</Label>
                <Select value={matterId} onValueChange={setMatterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select matter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No matter</SelectItem>
                    {matters?.matters.map((matter) => (
                      <SelectItem key={matter.id} value={matter.id}>
                        {matter.name} - {matter.client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assignee (optional)</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTask.isLoading || updateTask.isLoading}>
                  {editingTask ? "Update" : "Create"} Task
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100">
              <CheckSquare className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary?.total || 0}</p>
              <p className="text-sm text-gray-500">Total Tasks</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{summary?.overdue || 0}</p>
              <p className="text-sm text-gray-500">Overdue</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary?.inProgress || 0}</p>
              <p className="text-sm text-gray-500">In Progress</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <CheckSquare className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary?.completed || 0}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-400" />
          <span className="font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="NOT_STARTED">Not Started</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Priorities</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={matterFilter} onValueChange={setMatterFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Matters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Matters</SelectItem>
              {matters?.matters.map((matter) => (
                <SelectItem key={matter.id} value={matter.id}>
                  {matter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 col-span-2">
            <Checkbox
              id="showCompleted"
              checked={showCompleted}
              onCheckedChange={(checked) => setShowCompleted(checked as boolean)}
            />
            <Label htmlFor="showCompleted" className="text-sm text-gray-600">
              Show completed tasks
            </Label>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-3">Loading tasks...</p>
          </div>
        ) : tasksData?.tasks.length === 0 ? (
          <div className="p-12 text-center">
            <CheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No tasks found</p>
            <p className="text-gray-400 text-sm mt-1">Create a new task to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tasksData?.tasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 hover:bg-gray-50/50 transition-colors ${
                  task.status === "COMPLETED" ? "opacity-60" : ""
                } ${isOverdue(task) ? "bg-red-50/50" : ""}`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleComplete.mutate({ id: task.id })}
                    className="mt-0.5 flex-shrink-0"
                  >
                    {task.status === "COMPLETED" ? (
                      <CheckSquare className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3
                          className={`font-medium ${
                            task.status === "COMPLETED"
                              ? "text-gray-500 line-through"
                              : isOverdue(task)
                              ? "text-red-700"
                              : "text-gray-900"
                          }`}
                        >
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {/* Priority */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                              priorityColors[task.priority as keyof typeof priorityColors]
                            }`}
                          >
                            <Flag className="h-3 w-3" />
                            {task.priority}
                          </span>

                          {/* Status */}
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              statusColors[task.status as keyof typeof statusColors]
                            }`}
                          >
                            {task.status.replace("_", " ")}
                          </span>

                          {/* Due Date */}
                          {task.dueDate && (
                            <span
                              className={`inline-flex items-center gap-1 text-xs ${
                                isOverdue(task)
                                  ? "text-red-600 font-medium"
                                  : isDueToday(task)
                                  ? "text-orange-600 font-medium"
                                  : "text-gray-500"
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {isOverdue(task)
                                ? `Overdue: ${formatDate(task.dueDate)}`
                                : isDueToday(task)
                                ? "Due Today"
                                : `Due ${formatDate(task.dueDate)}`}
                            </span>
                          )}

                          {/* Matter Link */}
                          {task.matter && (
                            <Link
                              href={`/matters/${task.matter.id}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                              <Briefcase className="h-3 w-3" />
                              {task.matter.name}
                            </Link>
                          )}

                          {/* Assignee */}
                          {task.assignee && (
                            <span className="text-xs text-gray-500">
                              Assigned to {task.assignee.name || task.assignee.email}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4 text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDialog(task)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteTask.mutate({ id: task.id })}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

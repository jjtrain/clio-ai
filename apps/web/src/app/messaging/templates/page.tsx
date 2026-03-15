"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Hash,
  FileText,
  Search,
} from "lucide-react";

export default function TemplatesPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const { data: templates, isLoading } = trpc.messaging.listTemplates.useQuery();

  const createTemplate = trpc.messaging.createTemplate.useMutation({
    onSuccess: () => {
      toast({ title: "Template created" });
      utils.messaging.listTemplates.invalidate();
      setShowCreate(false);
    },
  });

  const updateTemplate = trpc.messaging.updateTemplate.useMutation({
    onSuccess: () => {
      toast({ title: "Template updated" });
      utils.messaging.listTemplates.invalidate();
      setEditingTemplate(null);
    },
  });

  const deleteTemplate = trpc.messaging.deleteTemplate.useMutation({
    onSuccess: () => {
      toast({ title: "Template deleted" });
      utils.messaging.listTemplates.invalidate();
    },
  });

  const filtered = templates?.filter(
    (t: any) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase()) ||
      t.shortcode?.toLowerCase().includes(search.toLowerCase())
  );

  const categories = Array.from(new Set(templates?.map((t: any) => t.category).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/messaging">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Message Templates</h1>
            <p className="text-muted-foreground">
              Reusable templates for common text messages
            </p>
          </div>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Template</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createTemplate.mutate({
                  name: fd.get("name") as string,
                  content: fd.get("content") as string,
                  category: (fd.get("category") as string) || undefined,
                  shortcode: (fd.get("shortcode") as string) || undefined,
                });
              }}
            >
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" required placeholder="e.g. Appointment Reminder" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input name="category" placeholder="e.g. Reminder, Follow-up, Payment" />
              </div>
              <div className="space-y-2">
                <Label>Shortcode</Label>
                <Input name="shortcode" placeholder="e.g. /appt" />
                <p className="text-xs text-muted-foreground">
                  Type this in the message box to quickly insert this template
                </p>
              </div>
              <div className="space-y-2">
                <Label>Message Content</Label>
                <Textarea
                  name="content"
                  required
                  rows={4}
                  placeholder="Hi {NAME}, this is {FIRM_NAME}..."
                />
                <p className="text-xs text-muted-foreground">
                  Variables: {"{NAME}"}, {"{FIRM_NAME}"}, {"{MATTER}"}, {"{DATE}"}, {"{TIME}"}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTemplate.isLoading}>
                  {createTemplate.isLoading ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Badges */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Badge
              key={cat as string}
              variant="outline"
              className="cursor-pointer"
              onClick={() => setSearch(search === cat ? "" : (cat as string))}
            >
              {cat as string}
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading templates...</div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {search ? "No templates match your search" : "No templates yet"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template: any) => (
            <Card key={template.id} className="relative group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {template.category && (
                        <Badge variant="secondary" className="text-[10px]">
                          {template.category}
                        </Badge>
                      )}
                      {template.shortcode && (
                        <span className="text-xs text-muted-foreground font-mono flex items-center gap-0.5">
                          <Hash className="h-3 w-3" />
                          {template.shortcode}
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingTemplate(template)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          navigator.clipboard.writeText(template.content);
                          toast({ title: "Copied to clipboard" });
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Content
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteTemplate.mutate({ id: template.id })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {template.content}
                </p>
                {template.usageCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Used {template.usageCount} time{template.usageCount !== 1 ? "s" : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateTemplate.mutate({
                  id: editingTemplate.id,
                  name: fd.get("name") as string,
                  content: fd.get("content") as string,
                  category: (fd.get("category") as string) || undefined,
                  shortcode: (fd.get("shortcode") as string) || undefined,
                });
              }}
            >
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" required defaultValue={editingTemplate.name} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input name="category" defaultValue={editingTemplate.category || ""} />
              </div>
              <div className="space-y-2">
                <Label>Shortcode</Label>
                <Input name="shortcode" defaultValue={editingTemplate.shortcode || ""} />
              </div>
              <div className="space-y-2">
                <Label>Message Content</Label>
                <Textarea
                  name="content"
                  required
                  rows={4}
                  defaultValue={editingTemplate.content}
                />
                <p className="text-xs text-muted-foreground">
                  Variables: {"{NAME}"}, {"{FIRM_NAME}"}, {"{MATTER}"}, {"{DATE}"}, {"{TIME}"}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingTemplate(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTemplate.isLoading}>
                  {updateTemplate.isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

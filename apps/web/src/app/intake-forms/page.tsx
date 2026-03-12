"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  ClipboardList,
  Copy,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

export default function IntakeFormsPage() {
  const { data: templates, isLoading, refetch } =
    trpc.intakeForms.listTemplates.useQuery();
  const deleteMutation = trpc.intakeForms.deleteTemplate.useMutation({
    onSuccess: () => refetch(),
  });
  const updateMutation = trpc.intakeForms.updateTemplate.useMutation({
    onSuccess: () => refetch(),
  });
  const { toast } = useToast();

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/intake/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Public form link copied to clipboard." });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
            Intake Forms
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Create and manage public intake forms for lead generation
          </p>
        </div>
        <Button
          asChild
          className="bg-blue-500 hover:bg-blue-600 shadow-sm w-full sm:w-auto"
        >
          <Link href="/intake-forms/new">
            <Plus className="mr-2 h-4 w-4" />
            New Form
          </Link>
        </Button>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <p className="text-gray-500 mt-3 text-sm">Loading forms...</p>
          </div>
        ) : !templates?.length ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No intake forms yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Create your first intake form to start collecting leads
            </p>
            <Button asChild className="mt-4" variant="outline" size="sm">
              <Link href="/intake-forms/new">
                <Plus className="mr-2 h-4 w-4" />
                New Form
              </Link>
            </Button>
          </div>
        ) : (
          templates.map((t) => (
            <Link
              key={t.id}
              href={`/intake-forms/${t.id}`}
              className="block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{t.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                    {t.practiceArea && (
                      <span className="text-xs text-gray-500">{t.practiceArea}</span>
                    )}
                    <span className="text-xs text-gray-500">
                      {t._count.submissions} submission
                      {t._count.submissions !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="font-semibold text-gray-600">Form Name</TableHead>
                <TableHead className="font-semibold text-gray-600">Practice Area</TableHead>
                <TableHead className="font-semibold text-gray-600">Status</TableHead>
                <TableHead className="font-semibold text-gray-600">Submissions</TableHead>
                <TableHead className="font-semibold text-gray-600 hidden lg:table-cell">Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <p className="text-gray-500 mt-3">Loading forms...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : !templates?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No intake forms yet</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Create your first intake form
                    </p>
                    <Button asChild className="mt-4" variant="outline">
                      <Link href="/intake-forms/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Form
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.id} className="hover:bg-gray-50/50">
                    <TableCell>
                      <Link
                        href={`/intake-forms/${t.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {t.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {t.practiceArea || "-"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          t.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {t.isActive && (
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
                        )}
                        {t.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-900">
                      {t._count.submissions}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm hidden lg:table-cell">
                      {formatDate(t.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4 text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/intake-forms/${t.id}`}>
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyLink(t.slug)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Public Link
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href={`/intake/${t.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open Form
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateMutation.mutate({
                                id: t.id,
                                isActive: !t.isActive,
                              })
                            }
                          >
                            {t.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => deleteMutation.mutate({ id: t.id })}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

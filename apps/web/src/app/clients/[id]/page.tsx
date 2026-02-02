"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, Edit, MoreHorizontal, Plus, Archive } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const clientId = params.id as string;
  
  const { data: client, isLoading } = trpc.clients.getById.useQuery({ id: clientId });
  const utils = trpc.useUtils();

  const archiveClient = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Client archived" });
      router.push("/clients");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="success">Active</Badge>;
      case "INACTIVE":
        return <Badge variant="secondary">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMatterStatusBadge = (status: string) => {
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

  if (!client) {
    return <div>Client not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/clients">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{client.name}</h1>
              {getStatusBadge(client.status)}
            </div>
            <p className="text-muted-foreground">
              Client since {formatDate(client.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={"/clients/" + clientId + "/edit"}>
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
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => archiveClient.mutate({ id: clientId })}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive Client
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p>{client.email || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Phone</p>
              <p>{client.phone || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Address</p>
              <p className="whitespace-pre-wrap">{client.address || "-"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{client.notes || "No notes"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Matters</CardTitle>
            <CardDescription>All matters for this client</CardDescription>
          </div>
          <Button asChild>
            <Link href={"/matters/new?clientId=" + clientId}>
              <Plus className="mr-2 h-4 w-4" />
              New Matter
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {client.matters.length === 0 ? (
            <p className="text-muted-foreground">No matters yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matter Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Practice Area</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.matters.map((matter) => (
                  <TableRow key={matter.id}>
                    <TableCell>
                      <Link
                        href={"/matters/" + matter.id}
                        className="font-mono hover:underline"
                      >
                        {matter.matterNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={"/matters/" + matter.id}
                        className="font-medium hover:underline"
                      >
                        {matter.name}
                      </Link>
                    </TableCell>
                    <TableCell>{matter.practiceArea || "-"}</TableCell>
                    <TableCell>{getMatterStatusBadge(matter.status)}</TableCell>
                    <TableCell>{formatDate(matter.openDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

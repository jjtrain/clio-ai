"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Download, Trash2, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useState } from "react";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const documentId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: doc, isLoading } = trpc.documents.getById.useQuery({ id: documentId });
  const utils = trpc.useUtils();

  const updateDocument = trpc.documents.update.useMutation({
    onSuccess: () => {
      toast({ title: "Document updated" });
      utils.documents.getById.invalidate({ id: documentId });
      setIsEditing(false);
    },
  });

  const deleteDocument = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Document deleted" });
      router.push("/documents");
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!doc) {
    return <div>Document not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/documents">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{doc.name}</h1>
            <p className="text-muted-foreground">
              Uploaded {formatDate(doc.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Are you sure you want to delete this document?")) {
                deleteDocument.mutate({ id: documentId });
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Document Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              {isEditing ? (
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => updateDocument.mutate({ id: documentId, data: { name: newName } })}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p>{doc.name}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNewName(doc.name);
                      setIsEditing(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Filename</p>
              <p>{doc.filename}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <p>{doc.mimeType}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Size</p>
              <p>{formatFileSize(doc.size)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Associated Matter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Matter</p>
              <Link
                href={"/matters/" + doc.matter.id}
                className="hover:underline"
              >
                {doc.matter.matterNumber} - {doc.matter.name}
              </Link>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Client</p>
              <Link
                href={"/clients/" + doc.matter.client.id}
                className="hover:underline"
              >
                {doc.matter.client.name}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

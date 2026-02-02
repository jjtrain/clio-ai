"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState, Suspense } from "react";

const practiceAreas = [
  "Corporate",
  "Litigation",
  "Real Estate",
  "Family Law",
  "Criminal Defense",
  "Intellectual Property",
  "Employment",
  "Immigration",
  "Tax",
  "Estate Planning",
  "Bankruptcy",
  "Other",
];

function NewMatterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(
    searchParams.get("clientId") || ""
  );

  const { data: clientsData } = trpc.clients.list.useQuery({});

  const createMatter = trpc.matters.create.useMutation({
    onSuccess: (matter) => {
      toast({ title: "Matter created successfully" });
      router.push("/matters/" + matter.id);
    },
    onError: (error) => {
      toast({
        title: "Failed to create matter",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    createMatter.mutate({
      clientId: selectedClientId,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      practiceArea: formData.get("practiceArea") as string,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/matters">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Matter</h1>
          <p className="text-muted-foreground">Create a new legal matter</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Matter Information</CardTitle>
          <CardDescription>Enter the details for the new matter</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <Select
                value={selectedClientId}
                onValueChange={setSelectedClientId}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clientsData?.clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Matter Name *</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="practiceArea">Practice Area</Label>
              <Select name="practiceArea">
                <SelectTrigger>
                  <SelectValue placeholder="Select practice area" />
                </SelectTrigger>
                <SelectContent>
                  {practiceAreas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={4} />
            </div>
            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting || !selectedClientId}>
                {isSubmitting ? "Creating..." : "Create Matter"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/matters">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewMatterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewMatterForm />
    </Suspense>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
import { useState } from "react";

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

export default function EditMatterPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const matterId = params.id as string;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [practiceArea, setPracticeArea] = useState<string>("");

  const { data: matter, isLoading } = trpc.matters.getById.useQuery(
    { id: matterId },
    {
      onSuccess: (data) => {
        if (data.practiceArea) {
          setPracticeArea(data.practiceArea);
        }
      },
    }
  );
  const utils = trpc.useUtils();

  const updateMatter = trpc.matters.update.useMutation({
    onSuccess: () => {
      toast({ title: "Matter updated successfully" });
      utils.matters.getById.invalidate({ id: matterId });
      router.push("/matters/" + matterId);
    },
    onError: (error) => {
      toast({
        title: "Failed to update matter",
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

    updateMatter.mutate({
      id: matterId,
      data: {
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        practiceArea: practiceArea || undefined,
      },
    });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!matter) {
    return <div>Matter not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={"/matters/" + matterId}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Matter</h1>
          <p className="text-muted-foreground">Update matter information</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Matter Information</CardTitle>
          <CardDescription>
            Matter Number: {matter.matterNumber}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Input value={matter.client.name} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Matter Name *</Label>
              <Input id="name" name="name" required defaultValue={matter.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="practiceArea">Practice Area</Label>
              <Select value={practiceArea} onValueChange={setPracticeArea}>
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
              <Textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={matter.description || ""}
              />
            </div>
            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={"/matters/" + matterId}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

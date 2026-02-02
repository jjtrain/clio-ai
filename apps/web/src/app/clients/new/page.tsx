"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function NewClientPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createClient = trpc.clients.create.useMutation({
    onSuccess: (client) => {
      toast({ title: "Client created successfully" });
      router.push("/clients/" + client.id);
    },
    onError: (error) => {
      toast({
        title: "Failed to create client",
        description: error.message,
        variant: "destructive"
      });
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    createClient.mutate({
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      address: formData.get("address") as string,
      notes: formData.get("notes") as string,
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="icon" asChild className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">New Client</h1>
          <p className="text-muted-foreground text-sm hidden sm:block">Add a new client to your practice</p>
        </div>
      </div>

      {/* Form Card */}
      <Card className="max-w-2xl">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Client Information</CardTitle>
          <CardDescription className="text-sm">Enter the details for the new client</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Name - required */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Name *</Label>
              <Input id="name" name="name" required className="h-10 sm:h-11" />
            </div>

            {/* Email & Phone - stack on mobile, side by side on sm+ */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input id="email" name="email" type="email" className="h-10 sm:h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                <Input id="phone" name="phone" type="tel" className="h-10 sm:h-11" />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-medium">Address</Label>
              <Textarea id="address" name="address" rows={3} className="resize-none" />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
              <Textarea id="notes" name="notes" rows={4} className="resize-none" />
            </div>

            {/* Buttons - full width stack on mobile */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 pt-2">
              <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/clients">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? "Creating..." : "Create Client"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

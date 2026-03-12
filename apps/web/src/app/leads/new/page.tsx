"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft } from "lucide-react";

const SOURCES = [
  { value: "MANUAL", label: "Manual Entry" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WEBSITE", label: "Website" },
  { value: "PHONE", label: "Phone Call" },
  { value: "OTHER", label: "Other" },
];

const PRACTICE_AREAS = [
  "Family Law", "Criminal Defense", "Personal Injury", "Estate Planning",
  "Business Law", "Real Estate", "Immigration", "Trademark", "Employment Law", "Other",
];

export default function NewLeadPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("MANUAL");
  const [priority, setPriority] = useState("MEDIUM");
  const [practiceArea, setPracticeArea] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast({ title: "Lead created" });
      router.push("/leads");
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name,
      email: email || undefined,
      phone: phone || undefined,
      source: source as any,
      priority: priority as any,
      practiceArea: practiceArea || undefined,
      description: description || undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/leads"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Add Lead</h1>
          <p className="text-gray-500 mt-1 text-sm">Manually enter a new lead</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="bg-white" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="bg-white" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" className="bg-white" />
          </div>
          <div className="space-y-2">
            <Label>Practice Area</Label>
            <Select value={practiceArea} onValueChange={setPracticeArea}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {PRACTICE_AREAS.map((pa) => (<SelectItem key={pa} value={pa}>{pa}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the inquiry..." className="bg-white" rows={3} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" asChild><Link href="/leads">Cancel</Link></Button>
          <Button type="submit" className="bg-blue-500 hover:bg-blue-600" disabled={createMutation.isLoading}>
            {createMutation.isLoading ? "Saving..." : "Add Lead"}
          </Button>
        </div>
      </form>
    </div>
  );
}

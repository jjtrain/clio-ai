"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Search, Users, Building2, FileText, MapPin, Phone, Mail, Car, Home, Shield, Eye, Radar } from "lucide-react";

const SEARCH_CATEGORIES = [
  { category: "People & Skip Tracing", icon: Users, color: "text-blue-600", searches: [
    { type: "PERSON_LOCATE", name: "Person Locate", fields: ["firstName", "lastName", "state", "city", "dob"] },
    { type: "SKIP_TRACE", name: "Skip Trace", fields: ["firstName", "lastName", "lastKnownAddress", "lastKnownPhone", "dob"] },
    { type: "ADDRESS_HISTORY", name: "Address History", fields: ["firstName", "lastName", "dob"] },
    { type: "PHONE_LOOKUP", name: "Phone Lookup", fields: ["phone"] },
    { type: "EMAIL_LOOKUP", name: "Email Lookup", fields: ["email"] },
    { type: "DEATH_RECORDS", name: "Death Records", fields: ["firstName", "lastName", "state", "dob"] },
  ]},
  { category: "Assets & Financial", icon: Home, color: "text-green-600", searches: [
    { type: "ASSET_SEARCH", name: "Asset Search", fields: ["firstName", "lastName", "state", "dob"] },
    { type: "PROPERTY_RECORDS", name: "Property Records", fields: ["ownerName", "address", "city", "state"] },
    { type: "VEHICLE_RECORDS", name: "Vehicle Records", fields: ["ownerName", "vin", "plate", "state"] },
    { type: "BANKRUPTCY", name: "Bankruptcy", fields: ["firstName", "lastName", "state"] },
    { type: "LIENS_JUDGMENTS", name: "Liens & Judgments", fields: ["firstName", "lastName", "state"] },
    { type: "UCC_FILINGS", name: "UCC Filings", fields: ["debtorName", "securedPartyName", "state"] },
  ]},
  { category: "Background & Records", icon: Shield, color: "text-purple-600", searches: [
    { type: "BACKGROUND_CHECK", name: "Background Check", fields: ["firstName", "lastName", "state", "dob"] },
    { type: "CRIMINAL_RECORDS", name: "Criminal Records", fields: ["firstName", "lastName", "state", "dob"] },
    { type: "COURT_RECORDS", name: "Court Records", fields: ["firstName", "lastName", "caseNumber", "state"] },
    { type: "PROFESSIONAL_LICENSE", name: "Professional License", fields: ["firstName", "lastName", "state", "licenseType"] },
    { type: "IDENTITY_VERIFICATION", name: "Identity Verification", fields: ["firstName", "lastName", "dob", "ssnLast4", "address"] },
  ]},
  { category: "Business", icon: Building2, color: "text-amber-600", searches: [
    { type: "BUSINESS_SEARCH", name: "Business Search", fields: ["businessName", "state"] },
  ]},
  { category: "Visual Assets (Mediascope)", icon: Eye, color: "text-emerald-600", searches: [
    { type: "VISUAL_ASSET_SEARCH", name: "Image Search", fields: ["imageUrl"] },
    { type: "TRADEMARK_SEARCH", name: "Trademark Search", fields: ["wordMark", "registrationNumber"] },
  ]},
  { category: "Comprehensive", icon: Search, color: "text-red-600", searches: [
    { type: "COMPREHENSIVE", name: "Full Comprehensive", fields: ["firstName", "lastName", "state", "dob", "ssnLast4"] },
  ]},
];

const FIELD_LABELS: Record<string, string> = {
  firstName: "First Name", lastName: "Last Name", state: "State", city: "City", dob: "Date of Birth",
  lastKnownAddress: "Last Known Address", lastKnownPhone: "Last Known Phone", phone: "Phone Number",
  email: "Email Address", ownerName: "Owner Name", address: "Address", vin: "VIN", plate: "License Plate",
  debtorName: "Debtor Name", securedPartyName: "Secured Party", caseNumber: "Case Number",
  licenseType: "License Type", ssnLast4: "SSN Last 4", businessName: "Business Name",
  imageUrl: "Image URL", wordMark: "Word Mark", registrationNumber: "Registration #",
};

export default function SearchPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [matterId, setMatterId] = useState("");

  const { data: matters } = trpc.matters.list.useQuery({});
  const runMut = trpc.investigations.searches.run.useMutation({
    onSuccess: (data: any) => { toast({ title: "Search completed" }); router.push(`/investigations/search/${data.id}`); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Investigation Search</h1><p className="text-sm text-slate-500">Select a search type to begin</p></div>

      {!selectedType ? (
        <div className="space-y-6">
          {SEARCH_CATEGORIES.map((cat) => (
            <div key={cat.category}>
              <h2 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><cat.icon className={`h-4 w-4 ${cat.color}`} /> {cat.category}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {cat.searches.map((s) => (
                  <Card key={s.type} className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => { setSelectedType(s); setForm({}); }}>
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className="text-xs font-medium">{s.name}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{selectedType.name}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>Change Search Type</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 max-w-2xl">
            <div>
              <Label>Link to Matter (optional)</Label>
              <Select value={matterId} onValueChange={setMatterId}>
                <SelectTrigger><SelectValue placeholder="Select matter..." /></SelectTrigger>
                <SelectContent><SelectItem value="">None</SelectItem>{((matters as any) || []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedType.fields.map((field: string) => (
              <div key={field}>
                <Label>{FIELD_LABELS[field] || field}</Label>
                <Input type={field === "dob" ? "date" : "text"} value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
              </div>
            ))}
            <Button className="w-full" onClick={() => runMut.mutate({ searchType: selectedType.type, matterId: matterId || undefined, inputs: form })} disabled={runMut.isLoading}>
              {runMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Run Search
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

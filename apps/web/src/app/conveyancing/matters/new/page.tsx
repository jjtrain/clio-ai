"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

const steps = [
  "Transaction Type",
  "Property Address",
  "Financial",
  "Parties",
  "Dates",
  "Review & Create",
];

const TRANSACTION_TYPES = [
  { value: "PURCHASE", label: "Purchase" },
  { value: "SALE", label: "Sale" },
  { value: "REFINANCE", label: "Refinance" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "LEASE", label: "Lease" },
  { value: "COMMERCIAL_PURCHASE", label: "Commercial Purchase" },
  { value: "COMMERCIAL_SALE", label: "Commercial Sale" },
  { value: "COMMERCIAL_LEASE", label: "Commercial Lease" },
  { value: "NEW_CONSTRUCTION", label: "New Construction" },
  { value: "SHORT_SALE", label: "Short Sale" },
  { value: "FORECLOSURE", label: "Foreclosure" },
  { value: "ESTATE_SALE", label: "Estate Sale" },
  { value: "AUCTION", label: "Auction" },
  { value: "EXCHANGE_1031", label: "1031 Exchange" },
];

const ROLES = [
  { value: "BUYER_ATTORNEY", label: "Buyer Attorney" },
  { value: "SELLER_ATTORNEY", label: "Seller Attorney" },
  { value: "LENDER_ATTORNEY", label: "Lender Attorney" },
  { value: "DUAL_REPRESENTATION", label: "Dual Representation" },
];

const PROPERTY_TYPES = [
  { value: "SINGLE_FAMILY", label: "Single Family" },
  { value: "CONDO", label: "Condo" },
  { value: "COOP", label: "Co-op" },
  { value: "TOWNHOUSE", label: "Townhouse" },
  { value: "MULTI_FAMILY", label: "Multi-Family" },
  { value: "VACANT_LAND", label: "Vacant Land" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "INDUSTRIAL", label: "Industrial" },
  { value: "MIXED_USE", label: "Mixed Use" },
  { value: "OTHER", label: "Other" },
];

interface FormState {
  matterId: string;
  clientId: string;
  transactionType: string;
  role: string;
  propertyType: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  propertyCounty: string;
  purchasePrice: string;
  mortgageAmount: string;
  downPayment: string;
  contractDeposit: string;
  mortgageLender: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerAttorney: string;
  buyerAttorneyEmail: string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  sellerAttorney: string;
  sellerAttorneyEmail: string;
  lenderName: string;
  lenderEmail: string;
  titleCompany: string;
  titleOfficer: string;
  titleOfficerEmail: string;
  brokerName: string;
  brokerEmail: string;
  contractDate: string;
  closingDate: string;
  mortgageCommitmentDate: string;
  inspectionDate: string;
}

const defaultForm: FormState = {
  matterId: "", clientId: "", transactionType: "PURCHASE", role: "BUYER_ATTORNEY", propertyType: "SINGLE_FAMILY",
  propertyAddress: "", propertyCity: "", propertyState: "NY", propertyZip: "", propertyCounty: "",
  purchasePrice: "", mortgageAmount: "", downPayment: "", contractDeposit: "", mortgageLender: "",
  buyerName: "", buyerEmail: "", buyerPhone: "", buyerAttorney: "", buyerAttorneyEmail: "",
  sellerName: "", sellerEmail: "", sellerPhone: "", sellerAttorney: "", sellerAttorneyEmail: "",
  lenderName: "", lenderEmail: "", titleCompany: "", titleOfficer: "", titleOfficerEmail: "",
  brokerName: "", brokerEmail: "", contractDate: "", closingDate: "", mortgageCommitmentDate: "", inspectionDate: "",
};

export default function NewConveyancingMatterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(defaultForm);

  const { data: matters } = trpc.matters.list.useQuery({});
  const { data: clients } = trpc.clients.list.useQuery({});
  const createMatter = trpc.conveyancing["matters.create"].useMutation({
    onSuccess: (data: any) => router.push(`/conveyancing/matters/${data.id}`),
  });

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const canNext = () => {
    if (step === 0) return form.transactionType && form.role && form.propertyType && form.matterId && form.clientId;
    if (step === 1) return form.propertyAddress;
    return true;
  };

  const handleCreate = () => {
    createMatter.mutate({
      matterId: form.matterId,
      clientId: form.clientId,
      transactionType: form.transactionType,
      role: form.role,
      propertyType: form.propertyType,
      propertyAddress: form.propertyAddress,
      propertyCity: form.propertyCity || undefined,
      propertyState: form.propertyState || undefined,
      propertyZip: form.propertyZip || undefined,
      propertyCounty: form.propertyCounty || undefined,
      purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : undefined,
      mortgageAmount: form.mortgageAmount ? parseFloat(form.mortgageAmount) : undefined,
      downPayment: form.downPayment ? parseFloat(form.downPayment) : undefined,
      contractDeposit: form.contractDeposit ? parseFloat(form.contractDeposit) : undefined,
      mortgageLender: form.mortgageLender || undefined,
      buyerName: form.buyerName || undefined,
      buyerEmail: form.buyerEmail || undefined,
      buyerPhone: form.buyerPhone || undefined,
      buyerAttorney: form.buyerAttorney || undefined,
      buyerAttorneyEmail: form.buyerAttorneyEmail || undefined,
      sellerName: form.sellerName || undefined,
      sellerEmail: form.sellerEmail || undefined,
      sellerPhone: form.sellerPhone || undefined,
      sellerAttorney: form.sellerAttorney || undefined,
      sellerAttorneyEmail: form.sellerAttorneyEmail || undefined,
      lenderName: form.lenderName || undefined,
      lenderEmail: form.lenderEmail || undefined,
      titleCompany: form.titleCompany || undefined,
      titleOfficer: form.titleOfficer || undefined,
      titleOfficerEmail: form.titleOfficerEmail || undefined,
      brokerName: form.brokerName || undefined,
      brokerEmail: form.brokerEmail || undefined,
      contractDate: form.contractDate || undefined,
      closingDate: form.closingDate || undefined,
      mortgageCommitmentDate: form.mortgageCommitmentDate || undefined,
      inspectionDate: form.inspectionDate || undefined,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <h1 className="text-3xl font-bold">New Conveyancing Transaction</h1>

      <div className="flex gap-2 flex-wrap">
        {steps.map((s, i) => (
          <Badge key={s} variant={i === step ? "default" : i < step ? "secondary" : "outline"}>{s}</Badge>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>{steps[step]}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div><Label>Matter</Label>
                <Select value={form.matterId} onValueChange={(v) => set("matterId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select matter" /></SelectTrigger>
                  <SelectContent>{((matters as any)?.matters || matters || []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Client</Label>
                <Select value={form.clientId} onValueChange={(v) => set("clientId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{((clients as any)?.clients || clients || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Transaction Type</Label>
                <Select value={form.transactionType} onValueChange={(v) => set("transactionType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TRANSACTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => set("role", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Property Type</Label>
                <Select value={form.propertyType} onValueChange={(v) => set("propertyType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PROPERTY_TYPES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div><Label>Street Address</Label><Input value={form.propertyAddress} onChange={(e) => set("propertyAddress", e.target.value)} placeholder="123 Main St" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>City</Label><Input value={form.propertyCity} onChange={(e) => set("propertyCity", e.target.value)} /></div>
                <div><Label>State</Label><Input value={form.propertyState} onChange={(e) => set("propertyState", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>ZIP Code</Label><Input value={form.propertyZip} onChange={(e) => set("propertyZip", e.target.value)} /></div>
                <div><Label>County</Label><Input value={form.propertyCounty} onChange={(e) => set("propertyCounty", e.target.value)} /></div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div><Label>Purchase/Sale Price</Label><Input type="number" value={form.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} placeholder="0.00" /></div>
              <div><Label>Mortgage Amount</Label><Input type="number" value={form.mortgageAmount} onChange={(e) => set("mortgageAmount", e.target.value)} placeholder="0.00" /></div>
              <div><Label>Down Payment</Label><Input type="number" value={form.downPayment} onChange={(e) => set("downPayment", e.target.value)} placeholder="0.00" /></div>
              <div><Label>Contract Deposit</Label><Input type="number" value={form.contractDeposit} onChange={(e) => set("contractDeposit", e.target.value)} placeholder="0.00" /></div>
              <div><Label>Mortgage Lender</Label><Input value={form.mortgageLender} onChange={(e) => set("mortgageLender", e.target.value)} /></div>
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="font-semibold">Buyer</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Name</Label><Input value={form.buyerName} onChange={(e) => set("buyerName", e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" value={form.buyerEmail} onChange={(e) => set("buyerEmail", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phone</Label><Input value={form.buyerPhone} onChange={(e) => set("buyerPhone", e.target.value)} /></div>
                <div><Label>Attorney</Label><Input value={form.buyerAttorney} onChange={(e) => set("buyerAttorney", e.target.value)} /></div>
              </div>
              <div><Label>Attorney Email</Label><Input type="email" value={form.buyerAttorneyEmail} onChange={(e) => set("buyerAttorneyEmail", e.target.value)} /></div>

              <h3 className="font-semibold mt-4">Seller</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Name</Label><Input value={form.sellerName} onChange={(e) => set("sellerName", e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" value={form.sellerEmail} onChange={(e) => set("sellerEmail", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phone</Label><Input value={form.sellerPhone} onChange={(e) => set("sellerPhone", e.target.value)} /></div>
                <div><Label>Attorney</Label><Input value={form.sellerAttorney} onChange={(e) => set("sellerAttorney", e.target.value)} /></div>
              </div>
              <div><Label>Attorney Email</Label><Input type="email" value={form.sellerAttorneyEmail} onChange={(e) => set("sellerAttorneyEmail", e.target.value)} /></div>

              <h3 className="font-semibold mt-4">Other Parties</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Lender</Label><Input value={form.lenderName} onChange={(e) => set("lenderName", e.target.value)} /></div>
                <div><Label>Lender Email</Label><Input type="email" value={form.lenderEmail} onChange={(e) => set("lenderEmail", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Title Company</Label><Input value={form.titleCompany} onChange={(e) => set("titleCompany", e.target.value)} /></div>
                <div><Label>Title Officer</Label><Input value={form.titleOfficer} onChange={(e) => set("titleOfficer", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Title Officer Email</Label><Input type="email" value={form.titleOfficerEmail} onChange={(e) => set("titleOfficerEmail", e.target.value)} /></div>
                <div><Label>Broker</Label><Input value={form.brokerName} onChange={(e) => set("brokerName", e.target.value)} /></div>
              </div>
              <div><Label>Broker Email</Label><Input type="email" value={form.brokerEmail} onChange={(e) => set("brokerEmail", e.target.value)} /></div>
            </>
          )}

          {step === 4 && (
            <>
              <div><Label>Contract Date</Label><Input type="date" value={form.contractDate} onChange={(e) => set("contractDate", e.target.value)} /></div>
              <div><Label>Target Closing Date</Label><Input type="date" value={form.closingDate} onChange={(e) => set("closingDate", e.target.value)} /></div>
              <div><Label>Mortgage Commitment Date</Label><Input type="date" value={form.mortgageCommitmentDate} onChange={(e) => set("mortgageCommitmentDate", e.target.value)} /></div>
              <div><Label>Inspection Date</Label><Input type="date" value={form.inspectionDate} onChange={(e) => set("inspectionDate", e.target.value)} /></div>
            </>
          )}

          {step === 5 && (
            <div className="space-y-3 text-sm">
              <h3 className="font-semibold">Review your transaction:</h3>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Type</span><span>{TRANSACTION_TYPES.find((t) => t.value === form.transactionType)?.label}</span>
                <span className="text-muted-foreground">Role</span><span>{ROLES.find((r) => r.value === form.role)?.label}</span>
                <span className="text-muted-foreground">Property</span><span>{form.propertyAddress}</span>
                <span className="text-muted-foreground">City/State</span><span>{form.propertyCity}, {form.propertyState} {form.propertyZip}</span>
                {form.purchasePrice && <><span className="text-muted-foreground">Price</span><span>${parseFloat(form.purchasePrice).toLocaleString()}</span></>}
                {form.mortgageAmount && <><span className="text-muted-foreground">Mortgage</span><span>${parseFloat(form.mortgageAmount).toLocaleString()}</span></>}
                {form.buyerName && <><span className="text-muted-foreground">Buyer</span><span>{form.buyerName}</span></>}
                {form.sellerName && <><span className="text-muted-foreground">Seller</span><span>{form.sellerName}</span></>}
                {form.closingDate && <><span className="text-muted-foreground">Closing</span><span>{form.closingDate}</span></>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {step < steps.length - 1 ? (
          <Button disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={createMatter.isPending} onClick={handleCreate}>
            <Check className="mr-2 h-4 w-4" /> Create Transaction
          </Button>
        )}
      </div>
    </div>
  );
}

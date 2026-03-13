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
import { ArrowLeft, Save, Send, FileText } from "lucide-react";

// ─── Document Templates ─────────────────────────────────────────────

function retainerTemplate(vars: Record<string, string>) {
  return `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; line-height: 1.6;">
<h1 style="text-align: center; font-size: 20px; margin-bottom: 4px;">RETAINER AGREEMENT</h1>
<p style="text-align: center; color: #666; margin-top: 0;">${vars.FIRM_NAME}</p>
<hr style="margin: 24px 0;" />

<p>This Retainer Agreement ("Agreement") is entered into as of <strong>${vars.DATE}</strong>, by and between:</p>

<p><strong>Attorney:</strong> ${vars.ATTORNEY_NAME}, ${vars.FIRM_NAME}<br/>
<strong>Client:</strong> ${vars.CLIENT_NAME}</p>

<h3>1. SCOPE OF REPRESENTATION</h3>
<p>Attorney agrees to provide legal representation to Client in connection with [describe matter]. This representation is limited to the matter described herein and does not extend to any other legal matters.</p>

<h3>2. FEES AND BILLING</h3>
<p>Client agrees to pay Attorney at the rate of $_____ per hour for all time spent on the matter. Attorney will bill Client monthly for services rendered. Payment is due within 30 days of the invoice date.</p>

<h3>3. RETAINER DEPOSIT</h3>
<p>Client shall pay an initial retainer deposit of $_____ upon execution of this Agreement. This deposit will be held in Attorney's trust account and applied against fees and costs as incurred. Client agrees to replenish the retainer when it falls below $_____.</p>

<h3>4. COSTS AND EXPENSES</h3>
<p>In addition to attorney fees, Client shall be responsible for all costs and expenses incurred in connection with the representation, including but not limited to filing fees, court costs, deposition costs, expert fees, and travel expenses.</p>

<h3>5. TERMINATION</h3>
<p>Either party may terminate this Agreement at any time by providing written notice. Upon termination, Client shall be responsible for payment of all fees and costs incurred through the date of termination.</p>

<h3>6. AGREEMENT</h3>
<p>This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof. By signing below, both parties acknowledge and agree to the terms set forth in this Agreement.</p>

<div style="margin-top: 48px; display: flex; justify-content: space-between;">
  <div style="width: 45%;">
    <p style="margin-bottom: 40px;"><strong>CLIENT</strong></p>
    <div style="border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
    <p>${vars.CLIENT_NAME}<br/>Date: _______________</p>
  </div>
  <div style="width: 45%;">
    <p style="margin-bottom: 40px;"><strong>ATTORNEY</strong></p>
    <div style="border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
    <p>${vars.ATTORNEY_NAME}<br/>Date: _______________</p>
  </div>
</div>
</div>`;
}

function feeTemplate(vars: Record<string, string>) {
  return `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; line-height: 1.6;">
<h1 style="text-align: center; font-size: 20px; margin-bottom: 4px;">FEE AGREEMENT</h1>
<p style="text-align: center; color: #666; margin-top: 0;">${vars.FIRM_NAME}</p>
<hr style="margin: 24px 0;" />

<p>Date: <strong>${vars.DATE}</strong></p>
<p>This Fee Agreement ("Agreement") outlines the fee arrangement between ${vars.FIRM_NAME} ("Firm") and ${vars.CLIENT_NAME} ("Client").</p>

<h3>1. FEE STRUCTURE</h3>
<p>The Firm will charge for legal services on an hourly basis at the following rates:</p>
<ul>
  <li>Partner: $_____ per hour</li>
  <li>Associate: $_____ per hour</li>
  <li>Paralegal: $_____ per hour</li>
</ul>

<h3>2. BILLING PRACTICES</h3>
<p>Time is recorded in increments of one-tenth (1/10) of an hour. Invoices will be issued monthly and are due upon receipt. A late fee of 1.5% per month may be assessed on past-due balances.</p>

<h3>3. RETAINER</h3>
<p>Client agrees to pay an initial retainer of $_____ which will be deposited into the Firm's trust account. The retainer will be applied against invoiced fees and costs.</p>

<h3>4. SCOPE</h3>
<p>This fee arrangement covers legal services related to [describe matter]. Any additional matters will require a separate fee agreement.</p>

<h3>5. ACKNOWLEDGMENT</h3>
<p>By signing below, Client acknowledges receipt of this Fee Agreement and agrees to its terms.</p>

<div style="margin-top: 48px; display: flex; justify-content: space-between;">
  <div style="width: 45%;">
    <p style="margin-bottom: 40px;"><strong>CLIENT</strong></p>
    <div style="border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
    <p>${vars.CLIENT_NAME}<br/>Date: _______________</p>
  </div>
  <div style="width: 45%;">
    <p style="margin-bottom: 40px;"><strong>ATTORNEY</strong></p>
    <div style="border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
    <p>${vars.ATTORNEY_NAME}<br/>Date: _______________</p>
  </div>
</div>
</div>`;
}

function settlementTemplate(vars: Record<string, string>) {
  return `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; line-height: 1.6;">
<h1 style="text-align: center; font-size: 20px; margin-bottom: 4px;">SETTLEMENT AGREEMENT AND RELEASE</h1>
<p style="text-align: center; color: #666; margin-top: 0;">${vars.FIRM_NAME}</p>
<hr style="margin: 24px 0;" />

<p>This Settlement Agreement and Release ("Agreement") is entered into as of <strong>${vars.DATE}</strong>.</p>

<h3>PARTIES</h3>
<p><strong>Party A:</strong> ${vars.CLIENT_NAME}<br/>
<strong>Party B:</strong> [Opposing Party Name]</p>

<h3>RECITALS</h3>
<p>WHEREAS, the parties are involved in a dispute regarding [describe dispute]; and<br/>
WHEREAS, the parties desire to settle and resolve all claims between them;</p>

<h3>TERMS</h3>

<h4>1. SETTLEMENT AMOUNT</h4>
<p>Party B agrees to pay Party A the total sum of $_____ ("Settlement Amount") in full and final settlement of all claims.</p>

<h4>2. PAYMENT TERMS</h4>
<p>The Settlement Amount shall be paid within _____ days of the execution of this Agreement by [method of payment].</p>

<h4>3. RELEASE OF CLAIMS</h4>
<p>Upon receipt of the Settlement Amount, Party A hereby releases and forever discharges Party B from any and all claims, demands, and causes of action arising from the dispute described herein.</p>

<h4>4. CONFIDENTIALITY</h4>
<p>The parties agree that the terms of this Agreement shall remain confidential and shall not be disclosed to any third party except as required by law.</p>

<h4>5. NO ADMISSION</h4>
<p>This Agreement shall not be construed as an admission of liability by any party.</p>

<div style="margin-top: 48px; display: flex; justify-content: space-between;">
  <div style="width: 45%;">
    <p style="margin-bottom: 40px;"><strong>PARTY A (CLIENT)</strong></p>
    <div style="border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
    <p>${vars.CLIENT_NAME}<br/>Date: _______________</p>
  </div>
  <div style="width: 45%;">
    <p style="margin-bottom: 40px;"><strong>ATTORNEY</strong></p>
    <div style="border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
    <p>${vars.ATTORNEY_NAME}<br/>Date: _______________</p>
  </div>
</div>
</div>`;
}

// ─── Page ───────────────────────────────────────────────────────────

export default function NewSignaturePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [matterId, setMatterId] = useState("");
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [attorneyName, setAttorneyName] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: matters } = trpc.matters.list.useQuery({});
  const { data: firmInfo } = trpc.users.getFirmInfo.useQuery();

  const createSignature = trpc.signatures.create.useMutation();
  const sendSignature = trpc.signatures.send.useMutation();

  // Auto-fill client info when matter is selected
  const handleMatterChange = (id: string) => {
    setMatterId(id);
    if (matters?.matters) {
      const matter = matters.matters.find((m: any) => m.id === id);
      if (matter?.client) {
        setClientName(matter.client.name || "");
      }
    }
  };

  const getTemplateVars = () => ({
    CLIENT_NAME: clientName || "{CLIENT_NAME}",
    ATTORNEY_NAME: attorneyName || "{ATTORNEY_NAME}",
    FIRM_NAME: firmInfo?.firmName || "{FIRM_NAME}",
    DATE: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  });

  const applyTemplate = (templateFn: (vars: Record<string, string>) => string) => {
    setDocumentContent(templateFn(getTemplateVars()));
  };

  const handleSubmit = async (sendAfterCreate: boolean) => {
    if (!matterId || !title || !clientName || !clientEmail || !documentContent) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createSignature.mutateAsync({
        matterId,
        title,
        clientName,
        clientEmail,
        documentContent,
        attorneyName: attorneyName || undefined,
        expiresAt: expiresAt || undefined,
      });

      if (sendAfterCreate) {
        await sendSignature.mutateAsync({ id: result.id });
        toast({ title: "Signature request sent to client" });
      } else {
        toast({ title: "Signature request saved as draft" });
      }

      router.push(`/signatures/${result.id}`);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/signatures">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Signature Request</h1>
          <p className="text-gray-500">Create a document for electronic signing</p>
        </div>
      </div>

      {/* Matter & Client Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold">Details</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Matter <span className="text-red-500">*</span></Label>
            <Select value={matterId} onValueChange={handleMatterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a matter" />
              </SelectTrigger>
              <SelectContent>
                {matters?.matters?.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.matterNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Retainer Agreement"
            />
          </div>

          <div className="space-y-2">
            <Label>Client Name <span className="text-red-500">*</span></Label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client's full name"
            />
          </div>

          <div className="space-y-2">
            <Label>Client Email <span className="text-red-500">*</span></Label>
            <Input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Attorney Name</Label>
            <Input
              value={attorneyName}
              onChange={(e) => setAttorneyName(e.target.value)}
              placeholder="Attorney's full name (for countersigning)"
            />
          </div>

          <div className="space-y-2">
            <Label>Expiration Date</Label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Document Content</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Templates:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyTemplate(retainerTemplate)}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Retainer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyTemplate(feeTemplate)}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Fee Agreement
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyTemplate(settlementTemplate)}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Settlement
            </Button>
          </div>
        </div>

        <Textarea
          value={documentContent}
          onChange={(e) => setDocumentContent(e.target.value)}
          placeholder="Paste or type your document content here (HTML supported)..."
          rows={20}
          className="font-mono text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => handleSubmit(false)}
          disabled={createSignature.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          Save as Draft
        </Button>
        <Button
          onClick={() => handleSubmit(true)}
          disabled={createSignature.isPending || sendSignature.isPending}
          className="bg-blue-500 hover:bg-blue-600"
        >
          <Send className="h-4 w-4 mr-2" />
          Save & Send
        </Button>
      </div>
    </div>
  );
}

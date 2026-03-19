"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import {
  Building2, CalendarDays, DollarSign, AlertTriangle, CheckCircle,
  Clock, FileText, Users, ArrowLeft, Home, MapPin, Scale, Landmark,
  Activity, Download,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "Intake", CONTRACT_REVIEW: "Contract Review", DUE_DILIGENCE: "Due Diligence",
  TITLE_SEARCH: "Title Search", TITLE_CLEARANCE: "Title Clearance",
  MORTGAGE_PROCESSING: "Mortgage Processing", SURVEY: "Survey", INSPECTIONS: "Inspections",
  CLOSING_PREP: "Closing Prep", CLOSING_SCHEDULED: "Closing Scheduled", CLOSED: "Closed",
  POST_CLOSING: "Post-Closing", RECORDED: "Recorded", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Purchase", SALE: "Sale", REFINANCE: "Refinance", TRANSFER: "Transfer",
  LEASE: "Lease", COMMERCIAL_PURCHASE: "Commercial Purchase", COMMERCIAL_SALE: "Commercial Sale",
  COMMERCIAL_LEASE: "Commercial Lease", NEW_CONSTRUCTION: "New Construction",
  SHORT_SALE: "Short Sale", FORECLOSURE: "Foreclosure", ESTATE_SALE: "Estate Sale",
  AUCTION: "Auction", EXCHANGE_1031: "1031 Exchange",
};

const ROLE_LABELS: Record<string, string> = {
  BUYER_ATTORNEY: "Buyer Attorney", SELLER_ATTORNEY: "Seller Attorney",
  LENDER_ATTORNEY: "Lender Attorney", DUAL_REPRESENTATION: "Dual Rep",
};

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  MORTGAGE: "Mortgage", LIEN: "Lien", JUDGMENT: "Judgment", TAX_LIEN: "Tax Lien",
  MECHANICS_LIEN: "Mechanics Lien", UCC_FILING: "UCC Filing", EASEMENT: "Easement",
  RESTRICTION: "Restriction", ENCROACHMENT: "Encroachment", BOUNDARY_DISPUTE: "Boundary Dispute",
  ENCUMBRANCE: "Encumbrance", UNPAID_ASSESSMENT: "Unpaid Assessment",
  ESTATE_ISSUE: "Estate Issue", MISSING_HEIR: "Missing Heir", CHAIN_OF_TITLE: "Chain of Title",
};

const DOC_TYPES = [
  "Contract of Sale", "Deed", "Closing Statement", "Title Report",
  "Survey", "Mortgage Commitment", "Transfer Tax Return", "RP-5217",
];

function fmt(amount: any) {
  return `$${parseFloat(amount || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysUntil(date: string | Date | null) {
  if (!date) return null;
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return diff;
}

export default function ConveyancingMatterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("overview");
  const [docType, setDocType] = useState("");

  const { data: cm } = trpc.conveyancing["matters.get"].useQuery({ id });
  const generateDoc = trpc.conveyancing["documents.generate"].useMutation();

  if (!cm) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  const closingDays = daysUntil(cm.closingDate);
  const price = parseFloat((cm.purchasePrice || cm.salePrice || "0") as string);
  const checklists = cm.checklists || [];
  const titleExceptions = cm.titleExceptions || [];
  const adjustments = cm.adjustments || [];
  const statements = cm.statements || [];
  const activities = cm.activities || [];

  const overallChecklistPct = checklists.length
    ? Math.round(checklists.reduce((s: number, cl: any) => s + parseFloat(cl.completionPercentage || "0"), 0) / checklists.length)
    : 0;

  const openExceptions = titleExceptions.filter(
    (te: any) => te.status === "OPEN" || te.status === "IN_PROGRESS"
  ).length;

  // Parse checklist items by category
  const checklistsByCategory = checklists.map((cl: any) => {
    let items: any[] = [];
    try { items = JSON.parse(cl.items || "[]"); } catch {}
    return { ...cl, parsedItems: items };
  });

  // Readiness indicator
  const readinessItems = [
    { label: "Contract Signed", done: !!cm.contractDate },
    { label: "Title Search Received", done: !!cm.titleSearchReceived },
    { label: "Title Exceptions Cleared", done: openExceptions === 0 },
    { label: "Mortgage Commitment", done: !!cm.mortgageCommitmentDate },
    { label: "Clear to Close", done: !!cm.clearToCloseDate },
    { label: "Closing Scheduled", done: !!cm.closingDate },
  ];
  const readinessPct = Math.round((readinessItems.filter((r) => r.done).length / readinessItems.length) * 100);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/conveyancing/matters">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{cm.propertyAddress}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge>{TYPE_LABELS[cm.transactionType] || cm.transactionType}</Badge>
            <Badge variant="secondary">{ROLE_LABELS[cm.role] || cm.role}</Badge>
            <Badge variant="outline">{STATUS_LABELS[cm.status] || cm.status}</Badge>
            {closingDays !== null && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {closingDays > 0 ? `${closingDays} days to closing` : closingDays === 0 ? "Closing today" : `${Math.abs(closingDays)} days past closing`}
              </span>
            )}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="title">Title</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Home className="h-4 w-4" /> Property Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Address</span><span>{cm.propertyAddress}</span></div>
                {cm.propertyCity && <div className="flex justify-between"><span className="text-muted-foreground">City</span><span>{cm.propertyCity}</span></div>}
                {cm.propertyState && <div className="flex justify-between"><span className="text-muted-foreground">State</span><span>{cm.propertyState}</span></div>}
                {cm.propertyZip && <div className="flex justify-between"><span className="text-muted-foreground">ZIP</span><span>{cm.propertyZip}</span></div>}
                {cm.propertyCounty && <div className="flex justify-between"><span className="text-muted-foreground">County</span><span>{cm.propertyCounty}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{cm.propertyType}</span></div>
                {cm.block && <div className="flex justify-between"><span className="text-muted-foreground">Block/Lot</span><span>{cm.block}/{cm.lot}</span></div>}
                {cm.sbl && <div className="flex justify-between"><span className="text-muted-foreground">SBL</span><span>{cm.sbl}</span></div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Financial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {cm.purchasePrice && <div className="flex justify-between"><span className="text-muted-foreground">Purchase Price</span><span>{fmt(cm.purchasePrice)}</span></div>}
                {cm.salePrice && <div className="flex justify-between"><span className="text-muted-foreground">Sale Price</span><span>{fmt(cm.salePrice)}</span></div>}
                {cm.downPayment && <div className="flex justify-between"><span className="text-muted-foreground">Down Payment</span><span>{fmt(cm.downPayment)} ({Number(cm.downPaymentPercentage || 0)}%)</span></div>}
                {cm.mortgageAmount && <div className="flex justify-between"><span className="text-muted-foreground">Mortgage</span><span>{fmt(cm.mortgageAmount)}</span></div>}
                {cm.mortgageLender && <div className="flex justify-between"><span className="text-muted-foreground">Lender</span><span>{cm.mortgageLender}</span></div>}
                {cm.contractDeposit && <div className="flex justify-between"><span className="text-muted-foreground">Contract Deposit</span><span>{fmt(cm.contractDeposit)}</span></div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Parties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {cm.buyerName && <div className="flex justify-between"><span className="text-muted-foreground">Buyer</span><span>{cm.buyerName}</span></div>}
                {cm.buyerAttorney && <div className="flex justify-between"><span className="text-muted-foreground">Buyer Attorney</span><span>{cm.buyerAttorney}</span></div>}
                {cm.sellerName && <div className="flex justify-between"><span className="text-muted-foreground">Seller</span><span>{cm.sellerName}</span></div>}
                {cm.sellerAttorney && <div className="flex justify-between"><span className="text-muted-foreground">Seller Attorney</span><span>{cm.sellerAttorney}</span></div>}
                {cm.lenderName && <div className="flex justify-between"><span className="text-muted-foreground">Lender</span><span>{cm.lenderName}</span></div>}
                {cm.titleOfficer && <div className="flex justify-between"><span className="text-muted-foreground">Title Officer</span><span>{cm.titleOfficer}</span></div>}
                {cm.brokerName && <div className="flex justify-between"><span className="text-muted-foreground">Broker</span><span>{cm.brokerName}</span></div>}
                {cm.managingAgent && <div className="flex justify-between"><span className="text-muted-foreground">Managing Agent</span><span>{cm.managingAgent}</span></div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Contingencies & Dates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {cm.contractDate && <div className="flex justify-between"><span className="text-muted-foreground">Contract Date</span><span>{new Date(cm.contractDate).toLocaleDateString()}</span></div>}
                {cm.inspectionDate && <div className="flex justify-between"><span className="text-muted-foreground">Inspection</span><span>{new Date(cm.inspectionDate).toLocaleDateString()} {cm.inspectionResult && `(${cm.inspectionResult})`}</span></div>}
                {cm.appraisalDate && <div className="flex justify-between"><span className="text-muted-foreground">Appraisal</span><span>{new Date(cm.appraisalDate).toLocaleDateString()} {cm.appraisalValue && `(${fmt(cm.appraisalValue)})`}</span></div>}
                {cm.surveyDate && <div className="flex justify-between"><span className="text-muted-foreground">Survey</span><span>{new Date(cm.surveyDate).toLocaleDateString()}</span></div>}
                {cm.mortgageCommitmentDate && <div className="flex justify-between"><span className="text-muted-foreground">Mortgage Commitment</span><span>{new Date(cm.mortgageCommitmentDate).toLocaleDateString()}</span></div>}
                {cm.clearToCloseDate && <div className="flex justify-between"><span className="text-muted-foreground">Clear to Close</span><span>{new Date(cm.clearToCloseDate).toLocaleDateString()}</span></div>}
                {cm.closingDate && <div className="flex justify-between"><span className="text-muted-foreground">Closing</span><span>{new Date(cm.closingDate).toLocaleDateString()} {cm.closingTime}</span></div>}
                {cm.closingLocation && <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span>{cm.closingLocation}</span></div>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Closing Readiness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${readinessPct}%` }} /></div>
                <span className="text-sm font-medium">{readinessPct}%</span>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {readinessItems.map((r) => (
                  <div key={r.label} className="flex items-center gap-2 text-sm">
                    {r.done ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={r.done ? "" : "text-muted-foreground"}>{r.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${overallChecklistPct}%` }} /></div>
            <span className="text-sm font-medium">{overallChecklistPct}% Complete</span>
          </div>
          {checklistsByCategory.length === 0 && (
            <p className="text-sm text-muted-foreground">No checklists assigned to this transaction.</p>
          )}
          {checklistsByCategory.map((cl: any) => (
            <Card key={cl.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Checklist</span>
                  <Badge variant="outline">{cl.completedCount}/{cl.totalCount}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cl.parsedItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      {item.completed ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border" />
                      )}
                      <span className={item.completed ? "line-through text-muted-foreground" : ""}>{item.name || item.label || item.title || `Item ${idx + 1}`}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="title" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Scale className="h-4 w-4" /> Title Exceptions</span>
                {openExceptions > 0 && <Badge variant="destructive">{openExceptions} open</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {titleExceptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No title exceptions recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium">Type</th>
                        <th className="px-3 py-2 text-left font-medium">Description</th>
                        <th className="px-3 py-2 text-left font-medium">Holder</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-left font-medium">Deadline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {titleExceptions.map((te: any) => (
                        <tr key={te.id} className="border-b">
                          <td className="px-3 py-2">{EXCEPTION_TYPE_LABELS[te.exceptionType] || te.exceptionType}</td>
                          <td className="px-3 py-2 max-w-xs truncate">{te.description}</td>
                          <td className="px-3 py-2">{te.holder || "--"}</td>
                          <td className="px-3 py-2 text-right">{te.amount ? fmt(te.amount) : "--"}</td>
                          <td className="px-3 py-2">
                            <Badge variant={te.status === "CLEARED" ? "default" : te.status === "OPEN" ? "destructive" : "secondary"}>
                              {te.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">{te.deadline ? new Date(te.deadline).toLocaleDateString() : "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <Card>
              <CardContent className="pt-4 space-y-1">
                <p className="text-muted-foreground">Title Company</p>
                <p className="font-medium">{cm.titleCompany || "Not set"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 space-y-1">
                <p className="text-muted-foreground">Title Search Ordered</p>
                <p className="font-medium">{cm.titleSearchOrdered ? new Date(cm.titleSearchOrdered).toLocaleDateString() : "Not ordered"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 space-y-1">
                <p className="text-muted-foreground">Title Insurance Premium</p>
                <p className="font-medium">{cm.titleInsurancePremium ? fmt(cm.titleInsurancePremium) : "Not set"}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Closing Adjustments</CardTitle>
            </CardHeader>
            <CardContent>
              {adjustments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No adjustments recorded.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Description</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium">Adjusted</th>
                      <th className="px-3 py-2 text-left font-medium">Credit To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustments.map((adj: any) => (
                      <tr key={adj.id} className="border-b">
                        <td className="px-3 py-2">{adj.adjustmentType}</td>
                        <td className="px-3 py-2">{adj.description}</td>
                        <td className="px-3 py-2 text-right">{fmt(adj.totalAmount)}</td>
                        <td className="px-3 py-2 text-right">{fmt(adj.adjustedAmount)}</td>
                        <td className="px-3 py-2"><Badge variant="outline">{adj.creditTo}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Closing Costs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {cm.transferTaxAmount && <div className="flex justify-between"><span className="text-muted-foreground">Transfer Tax</span><span>{fmt(cm.transferTaxAmount)}</span></div>}
              {cm.mansionTaxAmount && <div className="flex justify-between"><span className="text-muted-foreground">Mansion Tax</span><span>{fmt(cm.mansionTaxAmount)}</span></div>}
              {cm.recordingFees && <div className="flex justify-between"><span className="text-muted-foreground">Recording Fees</span><span>{fmt(cm.recordingFees)}</span></div>}
              {cm.titleInsurancePremium && <div className="flex justify-between"><span className="text-muted-foreground">Title Insurance</span><span>{fmt(cm.titleInsurancePremium)}</span></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Closing Statements</CardTitle>
            </CardHeader>
            <CardContent>
              {statements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No closing statements generated.</p>
              ) : (
                <div className="space-y-3">
                  {statements.map((stmt: any) => (
                    <div key={stmt.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="font-medium">{stmt.statementType} Statement</p>
                        <p className="text-sm text-muted-foreground">Balance Due: {fmt(stmt.buyerBalanceDue)}</p>
                      </div>
                      <Badge variant={stmt.status === "APPROVED" ? "default" : "outline"}>{stmt.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</span>
                <div className="flex items-center gap-2">
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger className="w-52"><SelectValue placeholder="Generate document..." /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((dt) => (
                        <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!docType || generateDoc.isPending}
                    onClick={() => {
                      if (docType) generateDoc.mutate({ conveyancingMatterId: id, documentType: docType });
                    }}
                  >
                    <Download className="mr-1 h-4 w-4" /> Generate
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Select a document type above and click Generate to create a new document for this transaction.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {activities
                    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((act: any) => (
                      <div key={act.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                          <div className="flex-1 w-px bg-border" />
                        </div>
                        <div className="pb-4">
                          <p className="text-sm font-medium">{act.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{act.activityType}</Badge>
                            {act.performedBy && <span className="text-xs text-muted-foreground">{act.performedBy}</span>}
                            <span className="text-xs text-muted-foreground">{new Date(act.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

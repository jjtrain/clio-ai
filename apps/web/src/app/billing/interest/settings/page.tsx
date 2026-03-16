"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, AlertTriangle } from "lucide-react";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export default function InterestSettingsPage() {
  const { toast } = useToast();
  const { data: settings, refetch } = trpc.interest.getSettings.useQuery();
  const updateSettings = trpc.interest.updateSettings.useMutation({
    onSuccess: () => { refetch(); toast({ title: "Settings saved" }); },
  });

  const [form, setForm] = useState<any>({});
  const [selectedState, setSelectedState] = useState("");
  const { data: usuryCap } = trpc.interest.getUsuryCap.useQuery(
    { state: selectedState },
    { enabled: !!selectedState }
  );

  useEffect(() => {
    if (settings) setForm({
      isEnabled: settings.isEnabled,
      lateInterestEnabled: settings.lateInterestEnabled,
      lateInterestType: settings.lateInterestType,
      flatFeeAmount: settings.flatFeeAmount ? Number(settings.flatFeeAmount) : "",
      percentageRate: settings.percentageRate ? Number(settings.percentageRate) * 100 : "",
      dailyRate: settings.dailyRate ? Number(settings.dailyRate) * 100 : "",
      gracePeriodDays: settings.gracePeriodDays,
      compoundFrequency: settings.compoundFrequency,
      maxInterestPercentage: settings.maxInterestPercentage ? Number(settings.maxInterestPercentage) : "",
      applyFlatFeeOnce: settings.applyFlatFeeOnce,
      earlyPaymentEnabled: settings.earlyPaymentEnabled,
      earlyPaymentDiscountPercentage: settings.earlyPaymentDiscountPercentage ? Number(settings.earlyPaymentDiscountPercentage) : "",
      earlyPaymentDays: settings.earlyPaymentDays,
      earlyPaymentTerms: settings.earlyPaymentTerms || "",
      includeInterestOnStatements: settings.includeInterestOnStatements,
      autoApply: settings.autoApply,
      notifyClientOnInterest: settings.notifyClientOnInterest,
      notifyClientOnDiscount: settings.notifyClientOnDiscount,
      legalDisclosure: settings.legalDisclosure || "",
      usuryRateCap: settings.usuryRateCap ? Number(settings.usuryRateCap) : "",
    });
  }, [settings]);

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );

  const earlyTerms = form.earlyPaymentDiscountPercentage && form.earlyPaymentDays
    ? `${form.earlyPaymentDiscountPercentage}/${form.earlyPaymentDays} Net 30`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/billing/interest"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold text-slate-900">Interest & Discount Settings</h1>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Late Payment Interest */}
        <Card>
          <CardHeader><CardTitle>Late Payment Interest</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Toggle label="Enable late payment interest" checked={form.lateInterestEnabled ?? true} onChange={(v) => setForm({ ...form, lateInterestEnabled: v })} />

            <div className="space-y-2">
              <Label>Interest Type</Label>
              <Select value={form.lateInterestType || "PERCENTAGE"} onValueChange={(v) => setForm({ ...form, lateInterestType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FLAT_FEE">Flat Fee</SelectItem>
                  <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  <SelectItem value="DAILY_RATE">Daily Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.lateInterestType === "FLAT_FEE" && (
              <div className="space-y-3 pl-4 border-l-2 border-amber-200">
                <div className="space-y-2"><Label>Fee Amount ($)</Label><Input type="number" step="0.01" value={form.flatFeeAmount} onChange={(e) => setForm({ ...form, flatFeeAmount: e.target.value })} /></div>
                <Toggle label="Apply flat fee only once per invoice" checked={form.applyFlatFeeOnce ?? true} onChange={(v) => setForm({ ...form, applyFlatFeeOnce: v })} />
              </div>
            )}

            {form.lateInterestType === "PERCENTAGE" && (
              <div className="space-y-3 pl-4 border-l-2 border-orange-200">
                <div className="space-y-2"><Label>Rate (%)</Label><Input type="number" step="0.01" placeholder="1.5" value={form.percentageRate} onChange={(e) => setForm({ ...form, percentageRate: e.target.value })} /><p className="text-xs text-slate-500">e.g. 1.5 for 1.5% per period</p></div>
                <div className="space-y-2">
                  <Label>Compound Frequency</Label>
                  <Select value={form.compoundFrequency || "monthly"} onValueChange={(v) => setForm({ ...form, compoundFrequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">One-time</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Max Interest Cap (%)</Label><Input type="number" step="0.1" placeholder="25" value={form.maxInterestPercentage} onChange={(e) => setForm({ ...form, maxInterestPercentage: e.target.value })} /></div>
              </div>
            )}

            {form.lateInterestType === "DAILY_RATE" && (
              <div className="space-y-3 pl-4 border-l-2 border-red-200">
                <div className="space-y-2"><Label>Daily Rate (%)</Label><Input type="number" step="0.001" placeholder="0.05" value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} /><p className="text-xs text-slate-500">e.g. 0.05 for 0.05% per day</p></div>
                <div className="space-y-2"><Label>Max Interest Cap (%)</Label><Input type="number" step="0.1" value={form.maxInterestPercentage} onChange={(e) => setForm({ ...form, maxInterestPercentage: e.target.value })} /></div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Grace Period (days): {form.gracePeriodDays ?? 0}</Label>
              <Input type="range" min={0} max={30} value={form.gracePeriodDays ?? 0} onChange={(e) => setForm({ ...form, gracePeriodDays: Number(e.target.value) })} />
            </div>

            {/* Usury Cap */}
            <div className="space-y-2">
              <Label>State (for usury cap)</Label>
              <div className="flex gap-2">
                <Select value={selectedState || "__none__"} onValueChange={(v) => {
                  const state = v === "__none__" ? "" : v;
                  setSelectedState(state);
                }}>
                  <SelectTrigger className="w-32"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {usuryCap && <p className="text-sm text-amber-700 self-center">Cap: {usuryCap.cap}% annual</p>}
              </div>
              {form.usuryRateCap && <p className="text-xs text-slate-500">Current usury cap: {form.usuryRateCap}%</p>}
            </div>

            <Toggle label="Auto-apply interest (daily cron)" checked={form.autoApply ?? true} onChange={(v) => setForm({ ...form, autoApply: v })} />
          </CardContent>
        </Card>

        {/* Early Payment */}
        <Card>
          <CardHeader><CardTitle>Early Payment Discount</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Toggle label="Enable early payment discounts" checked={form.earlyPaymentEnabled ?? false} onChange={(v) => setForm({ ...form, earlyPaymentEnabled: v })} />
            {form.earlyPaymentEnabled && (
              <div className="space-y-3 pl-4 border-l-2 border-green-200">
                <div className="space-y-2"><Label>Discount (%)</Label><Input type="number" step="0.1" placeholder="2" value={form.earlyPaymentDiscountPercentage} onChange={(e) => setForm({ ...form, earlyPaymentDiscountPercentage: e.target.value })} /></div>
                <div className="space-y-2"><Label>Payment Window (days from issue)</Label><Input type="number" value={form.earlyPaymentDays ?? 10} onChange={(e) => setForm({ ...form, earlyPaymentDays: Number(e.target.value) })} /></div>
                {earlyTerms && <p className="text-sm font-medium text-green-700">Terms: {earlyTerms}</p>}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                  <p>Preview: Pay within {form.earlyPaymentDays || 10} days and save {form.earlyPaymentDiscountPercentage || 0}% (${((1000 * (form.earlyPaymentDiscountPercentage || 0)) / 100).toFixed(2)} on a $1,000 invoice)</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent>
            <Toggle label="Notify client when interest is applied" checked={form.notifyClientOnInterest ?? true} onChange={(v) => setForm({ ...form, notifyClientOnInterest: v })} />
            <Toggle label="Notify client of early payment opportunity" checked={form.notifyClientOnDiscount ?? true} onChange={(v) => setForm({ ...form, notifyClientOnDiscount: v })} />
            <Toggle label="Include interest on statements" checked={form.includeInterestOnStatements ?? true} onChange={(v) => setForm({ ...form, includeInterestOnStatements: v })} />
          </CardContent>
        </Card>

        {/* Legal Disclosure */}
        <Card>
          <CardHeader><CardTitle>Legal Disclosure</CardTitle><CardDescription>Added to invoices when interest is applicable</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={4} value={form.legalDisclosure || ""} onChange={(e) => setForm({ ...form, legalDisclosure: e.target.value })} placeholder="Invoices not paid within the grace period are subject to late fees..." />
          </CardContent>
        </Card>

        {/* Compliance */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Compliance Notice</p>
                <p>Ensure your interest rates comply with your state's usury laws. Consult with your bar association's ethics guidelines regarding interest charges on legal fees.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" onClick={() => updateSettings.mutate({
          ...form,
          flatFeeAmount: form.flatFeeAmount ? Number(form.flatFeeAmount) : null,
          percentageRate: form.percentageRate ? Number(form.percentageRate) / 100 : null,
          dailyRate: form.dailyRate ? Number(form.dailyRate) / 100 : null,
          maxInterestPercentage: form.maxInterestPercentage ? Number(form.maxInterestPercentage) : null,
          earlyPaymentDiscountPercentage: form.earlyPaymentDiscountPercentage ? Number(form.earlyPaymentDiscountPercentage) : null,
          earlyPaymentTerms: earlyTerms || null,
          legalDisclosure: form.legalDisclosure || null,
          usuryRateCap: usuryCap?.cap || (form.usuryRateCap ? Number(form.usuryRateCap) : null),
        })} disabled={updateSettings.isLoading}>
          {updateSettings.isLoading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";

export default function PaymentSettingsPage() {
  const { toast } = useToast();
  const { data: settings, refetch } = trpc.payments.getSettings.useQuery();
  const updateSettings = trpc.payments.updateSettings.useMutation({
    onSuccess: () => { refetch(); toast({ title: "Settings saved" }); },
  });
  const testConnection = trpc.payments.testConnection.useMutation({
    onSuccess: (data) => {
      toast({ title: data.connected ? "Connected!" : "Connection failed", description: data.error, variant: data.connected ? "default" : "destructive" });
    },
  });

  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (settings) {
      setForm({
        isEnabled: settings.isEnabled,
        processor: settings.processor,
        helcimApiToken: settings.helcimApiToken || "",
        helcimAccountId: settings.helcimAccountId || "",
        acceptCreditCard: settings.acceptCreditCard,
        acceptDebitCard: settings.acceptDebitCard,
        acceptEcheck: settings.acceptEcheck,
        acceptApplePay: settings.acceptApplePay,
        acceptGooglePay: settings.acceptGooglePay,
        surchargeEnabled: settings.surchargeEnabled,
        surchargePercentage: settings.surchargePercentage ? Number(settings.surchargePercentage) : "",
        convenienceFeeEnabled: settings.convenienceFeeEnabled,
        convenienceFeeAmount: settings.convenienceFeeAmount ? Number(settings.convenienceFeeAmount) : "",
        paymentLinkDefaultExpiry: settings.paymentLinkDefaultExpiry,
        autoApplyToInvoice: settings.autoApplyToInvoice,
        sendReceiptEmail: settings.sendReceiptEmail,
        trustAccountPayments: settings.trustAccountPayments,
        firmName: settings.firmName || "",
        firmEmail: settings.firmEmail || "",
      });
    }
  }, [settings]);

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`}
        onClick={() => onChange(!checked)}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/payments"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold text-slate-900">Payment Settings</h1>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Enable/Disable */}
        <Card>
          <CardHeader><CardTitle>Payments</CardTitle><CardDescription>Enable online payments</CardDescription></CardHeader>
          <CardContent>
            <Toggle label="Enable Payments" checked={form.isEnabled ?? false} onChange={(v) => setForm({ ...form, isEnabled: v })} />
          </CardContent>
        </Card>

        {/* Processor */}
        <Card>
          <CardHeader><CardTitle>Payment Processor</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button variant={form.processor === "helcim" ? "default" : "outline"} onClick={() => setForm({ ...form, processor: "helcim" })}>Helcim</Button>
              <Button variant="outline" disabled>Stripe (Coming Soon)</Button>
            </div>
            {form.processor === "helcim" && (
              <div className="space-y-3 mt-4">
                <div className="space-y-2"><Label>Helcim API Token</Label><Input type="password" value={form.helcimApiToken} onChange={(e) => setForm({ ...form, helcimApiToken: e.target.value })} /></div>
                <div className="space-y-2"><Label>Helcim Account ID</Label><Input value={form.helcimAccountId} onChange={(e) => setForm({ ...form, helcimAccountId: e.target.value })} /></div>
                <Button variant="outline" size="sm" onClick={() => testConnection.mutate()} disabled={testConnection.isLoading}>
                  {testConnection.isLoading ? "Testing..." : "Test Connection"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accepted Methods */}
        <Card>
          <CardHeader><CardTitle>Accepted Payment Methods</CardTitle></CardHeader>
          <CardContent>
            <Toggle label="Credit Card" checked={form.acceptCreditCard ?? true} onChange={(v) => setForm({ ...form, acceptCreditCard: v })} />
            <Toggle label="Debit Card" checked={form.acceptDebitCard ?? true} onChange={(v) => setForm({ ...form, acceptDebitCard: v })} />
            <Toggle label="eCheck / ACH" checked={form.acceptEcheck ?? true} onChange={(v) => setForm({ ...form, acceptEcheck: v })} />
            <Toggle label="Apple Pay" checked={form.acceptApplePay ?? false} onChange={(v) => setForm({ ...form, acceptApplePay: v })} />
            <Toggle label="Google Pay" checked={form.acceptGooglePay ?? false} onChange={(v) => setForm({ ...form, acceptGooglePay: v })} />
          </CardContent>
        </Card>

        {/* Fees */}
        <Card>
          <CardHeader><CardTitle>Fees</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Toggle label="Surcharge" checked={form.surchargeEnabled ?? false} onChange={(v) => setForm({ ...form, surchargeEnabled: v })} />
            {form.surchargeEnabled && (
              <div className="space-y-2 pl-4"><Label>Surcharge Percentage (%)</Label><Input type="number" step="0.01" value={form.surchargePercentage} onChange={(e) => setForm({ ...form, surchargePercentage: e.target.value })} /></div>
            )}
            <Toggle label="Convenience Fee" checked={form.convenienceFeeEnabled ?? false} onChange={(v) => setForm({ ...form, convenienceFeeEnabled: v })} />
            {form.convenienceFeeEnabled && (
              <div className="space-y-2 pl-4"><Label>Fee Amount ($)</Label><Input type="number" step="0.01" value={form.convenienceFeeAmount} onChange={(e) => setForm({ ...form, convenienceFeeAmount: e.target.value })} /></div>
            )}
          </CardContent>
        </Card>

        {/* Payment Links */}
        <Card>
          <CardHeader><CardTitle>Payment Links</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2"><Label>Default Link Expiry (days)</Label><Input type="number" value={form.paymentLinkDefaultExpiry ?? 30} onChange={(e) => setForm({ ...form, paymentLinkDefaultExpiry: Number(e.target.value) })} /></div>
            <Toggle label="Auto-apply to invoice" checked={form.autoApplyToInvoice ?? true} onChange={(v) => setForm({ ...form, autoApplyToInvoice: v })} />
          </CardContent>
        </Card>

        {/* Receipts & Trust */}
        <Card>
          <CardHeader><CardTitle>Receipts & Trust</CardTitle></CardHeader>
          <CardContent>
            <Toggle label="Send receipt email" checked={form.sendReceiptEmail ?? true} onChange={(v) => setForm({ ...form, sendReceiptEmail: v })} />
            <Toggle label="Allow trust account payments" checked={form.trustAccountPayments ?? true} onChange={(v) => setForm({ ...form, trustAccountPayments: v })} />
          </CardContent>
        </Card>

        {/* Display */}
        <Card>
          <CardHeader><CardTitle>Display</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2"><Label>Firm Name (shown on payment page)</Label><Input value={form.firmName} onChange={(e) => setForm({ ...form, firmName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Firm Email (for receipts)</Label><Input type="email" value={form.firmEmail} onChange={(e) => setForm({ ...form, firmEmail: e.target.value })} /></div>
          </CardContent>
        </Card>

        <Button className="w-full" onClick={() => updateSettings.mutate({
          ...form,
          surchargePercentage: form.surchargePercentage ? Number(form.surchargePercentage) : null,
          convenienceFeeAmount: form.convenienceFeeAmount ? Number(form.convenienceFeeAmount) : null,
          helcimApiToken: form.helcimApiToken || null,
          helcimAccountId: form.helcimAccountId || null,
          firmName: form.firmName || null,
          firmEmail: form.firmEmail || null,
        })} disabled={updateSettings.isLoading}>
          {updateSettings.isLoading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

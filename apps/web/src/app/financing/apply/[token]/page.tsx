"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Wallet, Lock } from "lucide-react";

function cur(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PublicFinancingApplyPage() {
  const { token } = useParams<{ token: string }>();
  const [termPreference, setTermPreference] = useState(12);
  const [applied, setApplied] = useState(false);

  // For a public financing page, the token would reference a financing application
  // In production, you'd load the application by a public token
  // For now, show a demo financing application page
  const amount = 5000; // Would come from the application
  const estimate = {
    threeMonth: Math.ceil((amount / 3) * 100) / 100,
    sixMonth: Math.ceil((amount / 6) * 100) / 100,
    twelveMonth: Math.ceil((amount / 12) * 100) / 100,
  };

  const monthlyAmount = termPreference === 3 ? estimate.threeMonth : termPreference === 6 ? estimate.sixMonth : estimate.twelveMonth;

  if (applied) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-700 mb-2">Financing Approved!</h2>
            <p className="text-slate-600 mb-4">Your financing has been approved. The firm will be notified and your payment plan will begin shortly.</p>
            <p className="text-sm text-slate-500">You will receive a confirmation email with your loan details.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Pay Over Time</h1>
          <div className="flex items-center gap-1 text-sm text-slate-500"><Lock className="h-4 w-4" /> Secure</div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <Wallet className="h-10 w-10 text-blue-600 mx-auto mb-3" />
            <h2 className="text-lg font-medium mb-1">Legal Services Financing</h2>
            <p className="text-3xl font-bold text-slate-900 mb-2">{cur(amount)}</p>
            <p className="text-sm text-slate-500">Split into easy monthly payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <Label>Choose your term</Label>
            <div className="grid grid-cols-3 gap-3">
              {[3, 6, 12].map((months) => {
                const monthly = months === 3 ? estimate.threeMonth : months === 6 ? estimate.sixMonth : estimate.twelveMonth;
                return (
                  <button
                    key={months}
                    onClick={() => setTermPreference(months)}
                    className={`p-3 rounded-lg border-2 text-center transition-colors ${
                      termPreference === months ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="text-lg font-bold">{cur(monthly)}</p>
                    <p className="text-xs text-slate-500">/month</p>
                    <p className="text-xs text-slate-400 mt-1">{months} months</p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 text-center">0% APR available for qualifying applicants. Actual rate determined during checkout.</p>
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-sm text-blue-800 font-medium">Buy now, pay over time</p>
          <p className="text-xs text-blue-600 mt-1">0% APR financing available &middot; No hidden fees &middot; Powered by Affirm</p>
        </div>

        <Button className="w-full h-14 text-lg font-semibold" onClick={() => setApplied(true)}>
          Apply with Affirm
        </Button>
      </div>

      <footer className="text-center py-6 text-xs text-slate-400 space-y-1">
        <p><Lock className="inline h-3 w-3 mr-1" />Secure application processing</p>
        <p>Powered by Clio AI &middot; Financing by Affirm</p>
      </footer>
    </div>
  );
}

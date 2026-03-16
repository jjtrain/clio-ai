"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Lock, CheckCircle, XCircle, CreditCard, Building2, Smartphone, AlertCircle, Wallet } from "lucide-react";

function cur(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function detectCardBrand(num: string): string {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^6(?:011|5)/.test(n)) return "discover";
  return "";
}

const BRAND_LABELS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover" };

export default function PublicPaymentPage() {
  const { token } = useParams<{ token: string }>();
  const { data: linkData, isLoading } = trpc.payments.getLinkByToken.useQuery({ token });

  const [payTab, setPayTab] = useState("card");
  const [payAmount, setPayAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [billingZip, setBillingZip] = useState("");
  const [bankName, setBankName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [accountHolder, setAccountHolder] = useState("");
  const [paymentResult, setPaymentResult] = useState<{ success: boolean; transactionId?: string; error?: string } | null>(null);

  const processPayment = trpc.payments.processPublicPayment.useMutation({
    onSuccess: (data) => setPaymentResult({ success: data.success, transactionId: data.transactionId }),
    onError: (err) => setPaymentResult({ success: false, error: err.message }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Loading payment details...</p>
      </div>
    );
  }

  if (!linkData || (linkData as any).expired || linkData.status !== "ACTIVE") {
    const statusMsg = linkData?.status === "PAID" ? "This payment has already been completed."
      : linkData?.status === "EXPIRED" || (linkData as any)?.expired ? "This payment link has expired."
      : linkData?.status === "CANCELLED" ? "This payment link has been cancelled."
      : "Payment link not found.";

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Payment Unavailable</h2>
            <p className="text-slate-600">{statusMsg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const amount = Number(linkData.amount);
  const actualAmount = linkData.allowPartialPayment && payAmount ? Number(payAmount) : amount;
  const surchargeAmt = (linkData as any).surcharge ? actualAmount * ((linkData as any).surcharge / 100) : 0;
  const feeAmt = (linkData as any).convenienceFee || 0;
  const totalAmount = actualAmount + surchargeAmt + feeAmt;
  const cardBrand = detectCardBrand(cardNumber);
  const methods = (linkData as any).acceptedMethods || {};

  // Success screen
  if (paymentResult?.success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-700 mb-2">Payment Successful!</h2>
            <p className="text-3xl font-bold mb-2">{cur(totalAmount)}</p>
            <p className="text-sm text-slate-500 mb-4">Transaction ID: {paymentResult.transactionId}</p>
            <p className="text-sm text-slate-600">A receipt has been sent to your email.</p>
            <Button className="mt-6" variant="outline" onClick={() => window.print()}>Print Receipt</Button>
          </CardContent>
        </Card>
        <footer className="fixed bottom-0 w-full text-center py-4 text-xs text-slate-400">
          <Lock className="inline h-3 w-3 mr-1" />Secure payment processing &middot; Powered by Clio AI
        </footer>
      </div>
    );
  }

  // Error screen
  if (paymentResult && !paymentResult.success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700 mb-2">Payment Failed</h2>
            <p className="text-slate-600 mb-4">{paymentResult.error || "An error occurred processing your payment."}</p>
            <Button onClick={() => setPaymentResult(null)}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCardValid = cardNumber.replace(/\s/g, "").length >= 15 && expiry.length >= 4 && cvv.length >= 3 && cardholderName;
  const isBankValid = routingNumber.length >= 9 && accountNumber.length >= 4 && accountHolder;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">{(linkData as any).firmName || "Law Firm"}</h1>
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <Lock className="h-4 w-4" /> Secure Payment
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Payment Details */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-medium mb-1">{linkData.title}</h2>
            {linkData.description && <p className="text-sm text-slate-500 mb-4">{linkData.description}</p>}
            <p className="text-3xl font-bold text-slate-900">{cur(amount)}</p>

            {linkData.allowPartialPayment && (
              <div className="mt-4 space-y-2">
                <Label>Payment Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={linkData.minimumPayment ? Number(linkData.minimumPayment) : 0.01}
                  max={amount}
                  value={payAmount || amount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
                {linkData.minimumPayment && (
                  <p className="text-xs text-slate-500">Minimum payment: {cur(Number(linkData.minimumPayment))}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardContent className="pt-6">
            <Tabs value={payTab} onValueChange={setPayTab}>
              <TabsList className="w-full">
                {(methods.creditCard || methods.debitCard) && (
                  <TabsTrigger value="card" className="flex-1"><CreditCard className="h-4 w-4 mr-1" /> Card</TabsTrigger>
                )}
                {methods.echeck && (
                  <TabsTrigger value="bank" className="flex-1"><Building2 className="h-4 w-4 mr-1" /> Bank</TabsTrigger>
                )}
                {(methods.applePay || methods.googlePay) && (
                  <TabsTrigger value="wallet" className="flex-1"><Smartphone className="h-4 w-4 mr-1" /> Wallet</TabsTrigger>
                )}
                {amount >= 50 && (
                  <TabsTrigger value="paylater" className="flex-1"><Wallet className="h-4 w-4 mr-1" /> Pay Later</TabsTrigger>
                )}
              </TabsList>

              {/* Card Tab */}
              <TabsContent value="card" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Card Number</Label>
                  <div className="relative">
                    <Input
                      placeholder="4242 4242 4242 4242"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      maxLength={19}
                    />
                    {cardBrand && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">
                        {BRAND_LABELS[cardBrand] || cardBrand}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Expiry (MM/YY)</Label><Input placeholder="12/28" value={expiry} onChange={(e) => setExpiry(e.target.value)} maxLength={5} /></div>
                  <div className="space-y-2"><Label>CVV</Label><Input placeholder="123" value={cvv} onChange={(e) => setCvv(e.target.value)} maxLength={4} type="password" /></div>
                </div>
                <div className="space-y-2"><Label>Cardholder Name</Label><Input placeholder="John Smith" value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Billing ZIP Code</Label><Input placeholder="12345" value={billingZip} onChange={(e) => setBillingZip(e.target.value)} maxLength={10} /></div>
              </TabsContent>

              {/* Bank Tab */}
              <TabsContent value="bank" className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Bank Name</Label><Input placeholder="Bank of America" value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Routing Number</Label><Input placeholder="021000021" value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} maxLength={9} /></div>
                <div className="space-y-2"><Label>Account Number</Label><Input placeholder="1234567890" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} type="password" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Select value={accountType} onValueChange={setAccountType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checking">Checking</SelectItem>
                        <SelectItem value="savings">Savings</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Account Holder</Label><Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} /></div>
                </div>
              </TabsContent>

              {/* Wallet Tab */}
              <TabsContent value="wallet" className="space-y-4 mt-4">
                {methods.applePay && (
                  <Button className="w-full bg-black text-white hover:bg-gray-800 h-12 text-base" onClick={() => {
                    processPayment.mutate({ token, amount: totalAmount, method: "APPLE_PAY" });
                  }}>
                     Pay
                  </Button>
                )}
                {methods.googlePay && (
                  <Button className="w-full bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 h-12 text-base" onClick={() => {
                    processPayment.mutate({ token, amount: totalAmount, method: "GOOGLE_PAY" });
                  }}>
                    Google Pay
                  </Button>
                )}
                <p className="text-xs text-slate-500 text-center">Digital wallet payments require a compatible device</p>
              </TabsContent>

              {/* Pay Later Tab */}
              <TabsContent value="paylater" className="space-y-4 mt-4">
                <div className="text-center space-y-3">
                  <Wallet className="h-10 w-10 text-blue-600 mx-auto" />
                  <h3 className="font-medium">Pay over time with Affirm</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <p className="font-medium text-blue-800">Estimated monthly payments:</p>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div><p className="font-bold">{cur(Math.ceil((actualAmount / 3) * 100) / 100)}</p><p className="text-xs text-blue-600">3 months</p></div>
                      <div><p className="font-bold">{cur(Math.ceil((actualAmount / 6) * 100) / 100)}</p><p className="text-xs text-blue-600">6 months</p></div>
                      <div><p className="font-bold">{cur(Math.ceil((actualAmount / 12) * 100) / 100)}</p><p className="text-xs text-blue-600">12 months</p></div>
                    </div>
                    <p className="text-xs text-blue-500 mt-2">0% APR available for qualifying applicants</p>
                  </div>
                  <Button className="w-full h-12" onClick={() => {
                    window.location.href = `/financing/apply/${token}`;
                  }}>
                    Apply Now with Affirm
                  </Button>
                  <p className="text-xs text-slate-400">You'll be redirected to Affirm to complete your application</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Fees notice */}
        {(surchargeAmt > 0 || feeAmt > 0) && (
          <div className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            {surchargeAmt > 0 && <p>A {(linkData as any).surcharge}% processing surcharge ({cur(surchargeAmt)}) will be applied.</p>}
            {feeAmt > 0 && <p>A {cur(feeAmt)} convenience fee applies.</p>}
            <p className="font-medium mt-1">Total: {cur(totalAmount)}</p>
          </div>
        )}

        {/* Pay Button */}
        {payTab !== "wallet" && payTab !== "paylater" && (
          <Button
            className="w-full h-14 text-lg font-semibold"
            disabled={processPayment.isLoading || (payTab === "card" ? !isCardValid : !isBankValid)}
            onClick={() => {
              const method = payTab === "card" ? (cardBrand === "amex" ? "CREDIT_CARD" : "CREDIT_CARD") : "ECHECK";
              processPayment.mutate({
                token,
                amount: totalAmount,
                method: method as any,
                cardLast4: payTab === "card" ? cardNumber.replace(/\s/g, "").slice(-4) : undefined,
                cardBrand: payTab === "card" ? cardBrand : undefined,
                bankName: payTab === "bank" ? bankName : undefined,
                cardholderName: payTab === "card" ? cardholderName : accountHolder,
              });
            }}
          >
            {processPayment.isLoading ? "Processing..." : `Pay ${cur(totalAmount)}`}
          </Button>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400 space-y-1">
        <p><Lock className="inline h-3 w-3 mr-1" />Secure payment processing</p>
        <p>Powered by Clio AI</p>
      </footer>
    </div>
  );
}

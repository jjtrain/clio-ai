"use client";

import { useState } from "react";
import { Mail, ArrowRight, CheckCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export function PortalLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const requestLink = trpc.portalClient.requestMagicLink.useMutation({
    onSuccess: () => setSent(true),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      requestLink.mutate({ email: email.trim() });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <Globe className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Client Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Secure access to your case information</p>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Check your email</h2>
            <p className="text-sm text-gray-500">
              We've sent a secure login link to <span className="font-medium text-gray-700">{email}</span>.
              The link expires in 1 hour.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="text-sm text-blue-600 hover:text-blue-800 mt-4"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={requestLink.isLoading || !email.trim()}
            >
              {requestLink.isLoading ? "Sending..." : "Send Login Link"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-gray-400 text-center">
              We'll email you a secure link — no password needed.
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}

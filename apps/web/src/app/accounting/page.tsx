"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign, FileText, Receipt, Landmark, BookOpen, Users, PieChart, Calculator,
} from "lucide-react";

function cur(n: number | null | undefined) {
  if (n == null) return "$0.00";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const quickLinks = [
  { name: "Chart of Accounts", href: "/accounting/chart", icon: BookOpen, color: "bg-blue-100 text-blue-600" },
  { name: "Journal Entries", href: "/accounting/journal", icon: FileText, color: "bg-green-100 text-green-600" },
  { name: "Expenses", href: "/accounting/expenses", icon: Receipt, color: "bg-amber-100 text-amber-600" },
  { name: "Bank Accounts", href: "/accounting/bank", icon: Landmark, color: "bg-purple-100 text-purple-600" },
  { name: "Reports", href: "/accounting/reports", icon: PieChart, color: "bg-teal-100 text-teal-600" },
  { name: "Vendors", href: "/accounting/vendors", icon: Users, color: "bg-pink-100 text-pink-600" },
  { name: "Budgets", href: "/accounting/budgets", icon: Calculator, color: "bg-indigo-100 text-indigo-600" },
];

export default function AccountingDashboardPage() {
  const { data: stats } = trpc.accounting.getDashboardStats.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Accounting</h1>
        <p className="text-sm text-slate-500">Full legal accounting platform</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-blue-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Cash Balance</p><p className="text-lg font-bold text-blue-700">{cur(stats?.cashBalance)}</p></CardContent></Card>
        <Card className="border-amber-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Accounts Receivable</p><p className="text-lg font-bold text-amber-700">{cur(stats?.arBalance)}</p></CardContent></Card>
        <Card className="border-green-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Revenue (Month)</p><p className="text-lg font-bold text-green-700">{cur(stats?.monthRevenue)}</p></CardContent></Card>
        <Card className="border-red-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Expenses (Month)</p><p className="text-lg font-bold text-red-700">{cur(stats?.monthExpenses)}</p></CardContent></Card>
        <Card className="border-emerald-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Net Income (Month)</p><p className="text-lg font-bold text-emerald-700">{cur(stats?.netIncome)}</p></CardContent></Card>
        <Card className="border-purple-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Trust Balance</p><p className="text-lg font-bold text-purple-700">{cur(stats?.trustBalance)}</p></CardContent></Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${link.color}`}><link.icon className="h-5 w-5" /></div>
                <span className="font-medium">{link.name}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

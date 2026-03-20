"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, DollarSign, BarChart3, Star, Plus, Pencil, Upload, Archive } from "lucide-react";

const statusStyles: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PUBLISHED: "bg-green-100 text-green-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  ARCHIVED: "bg-red-100 text-red-600",
};

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center">
          <Icon className="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PublishDashboardPage() {
  const { data, isLoading } = trpc.marketplace["publisher.getPackages"].useQuery({
    publisherId: "current-user",
  });

  const packages = (data ?? []) as any[];
  const stats = { totalPackages: packages.length, totalSales: packages.reduce((s: number, p: any) => s + (p.totalSales || 0), 0), totalRevenue: packages.reduce((s: number, p: any) => s + Number(p.totalRevenue || 0), 0), avgRating: 0 };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Publisher Dashboard</h1>
        <Link href="/marketplace/publish/new">
          <Button><Plus className="h-4 w-4 mr-2" /> Create Package</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Packages" value={String(stats.totalPackages)} />
        <StatCard icon={BarChart3} label="Sales" value={String(stats.totalSales)} />
        <StatCard icon={DollarSign} label="Revenue" value={`$${(stats.totalRevenue / 100).toFixed(2)}`} />
        <StatCard icon={Star} label="Avg Rating" value={stats.avgRating?.toFixed(1) ?? "—"} />
      </div>

      {/* Packages Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-400">Loading...</p>
        ) : packages.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No packages yet. Create your first one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Sales</th>
                <th className="px-6 py-3">Rating</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg: any) => (
                <tr key={pkg.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{pkg.name}</td>
                  <td className="px-6 py-4">
                    <Badge className={`${statusStyles[pkg.status] ?? statusStyles.DRAFT} border-0 text-xs`}>
                      {pkg.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {pkg.price === 0 ? "Free" : `$${(pkg.price / 100).toFixed(2)}`}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{pkg.sales}</td>
                  <td className="px-6 py-4">
                    <span className="text-yellow-400">{"★".repeat(Math.round(pkg.rating))}</span>
                    <span className="text-gray-300">{"★".repeat(5 - Math.round(pkg.rating))}</span>
                    <span className="ml-1 text-gray-400">({pkg.rating?.toFixed(1)})</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/marketplace/publish/${pkg.id}/edit`}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      {pkg.status === "DRAFT" && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <Upload className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {pkg.status === "PUBLISHED" && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600">
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

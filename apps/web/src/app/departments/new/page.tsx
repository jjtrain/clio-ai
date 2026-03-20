"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

const presets = [
  { name: "Family Law", areas: "Divorce, Child Custody, Adoption, Prenuptial", color: "#ec4899" },
  { name: "Litigation", areas: "Civil Litigation, Appeals, Arbitration", color: "#ef4444" },
  { name: "Corporate", areas: "M&A, Contracts, Compliance, Governance", color: "#3b82f6" },
  { name: "Real Estate", areas: "Commercial, Residential, Zoning, Leasing", color: "#10b981" },
  { name: "Personal Injury", areas: "Auto Accidents, Medical Malpractice, Slip & Fall", color: "#f59e0b" },
  { name: "Criminal Defense", areas: "Felony, Misdemeanor, DUI, White Collar", color: "#6366f1" },
  { name: "Immigration", areas: "Visas, Green Cards, Citizenship, Deportation", color: "#8b5cf6" },
  { name: "Estate Planning", areas: "Wills, Trusts, Probate, Power of Attorney", color: "#14b8a6" },
];

export default function NewDepartmentPage() {
  const router = useRouter();
  const createMut = trpc.departments["create"].useMutation({
    onSuccess: (data: any) => router.push(`/departments/${data.id}`),
  });
  const [form, setForm] = useState({
    name: "", description: "", practiceAreas: "", headAttorney: "", headAttorneyEmail: "",
    color: "#3b82f6", defaultBillingRate: 350, defaultBillingType: "hourly",
  });
  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));
  const prefill = (p: typeof presets[0]) => setForm(f => ({ ...f, name: p.name, practiceAreas: p.areas, color: p.color }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ ...form, practiceAreas: form.practiceAreas.split(",").map(s => s.trim()).filter(Boolean) });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/departments" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" />Back to Departments
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">Create Department</h1>

      <div>
        <p className="text-sm text-gray-500 mb-2 flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Quick start from a template</p>
        <div className="flex flex-wrap gap-2">
          {presets.map(p => (
            <button key={p.name} onClick={() => prefill(p)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 transition flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />{p.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Department Name *</label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} required placeholder="e.g. Family Law" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
          <textarea className="w-full border rounded-lg p-2 text-sm" rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Brief description of the department" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Practice Areas (comma-separated)</label>
          <Input value={form.practiceAreas} onChange={e => set("practiceAreas", e.target.value)} placeholder="Divorce, Child Custody, Adoption" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Head Attorney</label>
            <Input value={form.headAttorney} onChange={e => set("headAttorney", e.target.value)} placeholder="Jane Smith" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Head Attorney Email</label>
            <Input type="email" value={form.headAttorneyEmail} onChange={e => set("headAttorneyEmail", e.target.value)} placeholder="jane@firm.com" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Color</label>
            <input type="color" value={form.color} onChange={e => set("color", e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Default Rate ($/hr)</label>
            <Input type="number" value={form.defaultBillingRate} onChange={e => set("defaultBillingRate", Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Billing Type</label>
            <select className="w-full border rounded-lg p-2 text-sm" value={form.defaultBillingType} onChange={e => set("defaultBillingType", e.target.value)}>
              {["hourly", "flat", "contingency", "retainer"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <Button type="submit" disabled={!form.name || createMut.isPending} className="w-full">
          {createMut.isPending ? "Creating..." : "Create Department"}
        </Button>
        {createMut.isError && <p className="text-sm text-red-600">Failed to create department. Please try again.</p>}
      </form>
    </div>
  );
}

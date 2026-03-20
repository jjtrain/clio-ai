"use client";
import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Users, Briefcase, Plus } from "lucide-react";

export default function DepartmentsPage() {
  const { data: departments = [], refetch } = trpc.departments["list"].useQuery();
  const createMut = trpc.departments["create"].useMutation({ onSuccess: () => { refetch(); setOpen(false); } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", practiceAreas: "", color: "#3b82f6", headAttorney: "" });

  const totalAttorneys = departments.reduce((s: number, d: any) => s + (d.memberCount ?? 0), 0);
  const totalMatters = departments.reduce((s: number, d: any) => s + (d.matterCount ?? 0), 0);

  const stats = [
    { label: "Total Departments", value: departments.length, icon: Building2, color: "text-blue-600 bg-blue-50" },
    { label: "Total Attorneys", value: totalAttorneys, icon: Users, color: "text-emerald-600 bg-emerald-50" },
    { label: "Active Matters", value: totalMatters, icon: Briefcase, color: "text-purple-600 bg-purple-50" },
  ];

  const handleCreate = () => {
    createMut.mutate({ ...form, practiceAreas: form.practiceAreas.split(",").map(s => s.trim()).filter(Boolean) });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Create Department</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Department</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Input placeholder="Department name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <textarea className="w-full border rounded-lg p-2 text-sm" rows={2} placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <Input placeholder="Practice areas (comma-separated)" value={form.practiceAreas} onChange={e => setForm({ ...form, practiceAreas: e.target.value })} />
              <Input placeholder="Head Attorney" value={form.headAttorney} onChange={e => setForm({ ...form, headAttorney: e.target.value })} />
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Color</label>
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
              </div>
              <Button onClick={handleCreate} disabled={!form.name || createMut.isPending} className="w-full">
                {createMut.isPending ? "Creating..." : "Create Department"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${s.color}`}><s.icon className="w-5 h-5" /></div>
            <div><p className="text-sm text-gray-500">{s.label}</p><p className="text-2xl font-bold text-gray-900">{s.value}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept: any) => (
          <div key={dept.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex">
            <div className="w-1.5 shrink-0" style={{ backgroundColor: dept.color ?? "#3b82f6" }} />
            <div className="p-5 flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">{dept.name}</h3>
              <div className="flex flex-wrap gap-1 mb-3">
                {(dept.practiceAreas ?? []).map((pa: string) => (
                  <Badge key={pa} variant="secondary" className="text-xs">{pa}</Badge>
                ))}
              </div>
              {dept.headAttorney && <p className="text-sm text-gray-500 mb-2">Head: {dept.headAttorney}</p>}
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                <span><Users className="w-3.5 h-3.5 inline mr-1" />{dept.memberCount ?? 0} members</span>
                <span><Briefcase className="w-3.5 h-3.5 inline mr-1" />{dept.matterCount ?? 0} matters</span>
              </div>
              <Link href={`/departments/${dept.id}`}>
                <Button variant="outline" size="sm">Manage</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Briefcase, UserPlus, Settings, LayoutDashboard, FileText, Megaphone, Save } from "lucide-react";

const tabs = ["Overview", "Members", "Matters", "Settings"] as const;
type Tab = typeof tabs[number];
const tabIcons: Record<Tab, any> = { Overview: LayoutDashboard, Members: Users, Matters: Briefcase, Settings };

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: dept, refetch } = trpc.departments["getById"].useQuery({ id });
  const { data: widgets = [] } = trpc.departments["dashboard.getWidgets"].useQuery({ departmentId: id });
  const { data: announcements = [] } = trpc.departments["announcements.list"].useQuery({ departmentId: id });
  const { data: matters = [] } = trpc.departments["matters.listByDepartment"].useQuery({ departmentId: id });
  const addMemberMut = trpc.departments["members.add"].useMutation({ onSuccess: () => { refetch(); setMemberOpen(false); } });
  const updateMut = trpc.departments["update"].useMutation({ onSuccess: () => refetch() });

  const [tab, setTab] = useState<Tab>("Overview");
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({ userName: "", userEmail: "", role: "Attorney" });
  const [settings, setSettings] = useState<any>(null);

  if (!dept) return <div className="p-6 text-gray-500">Loading...</div>;
  if (!settings && dept) {
    const areas = (() => { try { return JSON.parse(dept.practiceAreas); } catch { return []; } })();
    const s = { color: dept.color ?? "#3b82f6", icon: dept.icon ?? "", defaultBillingRate: Number(dept.defaultBillingRate ?? 0), practiceAreas: areas.join(", ") };
    if (!settings) setTimeout(() => setSettings(s), 0);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: dept.color ?? "#3b82f6" }} />
            <h1 className="text-2xl font-bold text-gray-900">{dept.name}</h1>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {((() => { try { return JSON.parse(dept.practiceAreas); } catch { return []; } })() as string[]).map((pa: string) => <Badge key={pa} variant="secondary">{pa}</Badge>)}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {dept.headAttorney && <span>Head: {dept.headAttorney}</span>}
            <span><Users className="w-4 h-4 inline mr-1" />{dept.memberCount ?? 0} members</span>
            <span><Briefcase className="w-4 h-4 inline mr-1" />{dept.matterCount ?? 0} matters</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "Overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {widgets.map((w: any) => (
              <div key={w.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm text-gray-500 mb-1">{w.label}</p>
                <p className="text-2xl font-bold text-gray-900">{w.value}</p>
                {w.change && <p className={`text-xs mt-1 ${w.change > 0 ? "text-green-600" : "text-red-600"}`}>{w.change > 0 ? "+" : ""}{w.change}%</p>}
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Megaphone className="w-4 h-4" /> Announcements</h3>
            <div className="space-y-2">
              {announcements.length === 0 && <p className="text-sm text-gray-400">No announcements yet.</p>}
              {announcements.map((a: any) => (
                <div key={a.id} className="bg-white rounded-lg border border-gray-100 p-4">
                  <p className="font-medium text-sm text-gray-900">{a.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{a.content}</p>
                  <p className="text-xs text-gray-400 mt-2">{a.createdAt}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Members */}
      {tab === "Members" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
              <DialogTrigger asChild><Button size="sm"><UserPlus className="w-4 h-4 mr-2" />Add Member</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <Input placeholder="Name" value={memberForm.userName} onChange={e => setMemberForm({ ...memberForm, userName: e.target.value })} />
                  <Input placeholder="Email" value={memberForm.userEmail} onChange={e => setMemberForm({ ...memberForm, userEmail: e.target.value })} />
                  <select className="w-full border rounded-lg p-2 text-sm" value={memberForm.role} onChange={e => setMemberForm({ ...memberForm, role: e.target.value })}>
                    {["Head", "Attorney", "Paralegal", "Associate", "Secretary"].map(r => <option key={r}>{r}</option>)}
                  </select>
                  <Button onClick={() => addMemberMut.mutate({ departmentId: id, userId: memberForm.userEmail, ...memberForm })} disabled={!memberForm.userName || !memberForm.userEmail || addMemberMut.isPending} className="w-full">
                    {addMemberMut.isPending ? "Adding..." : "Add Member"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left p-3 font-medium text-gray-600">Name</th>
                <th className="text-left p-3 font-medium text-gray-600">Email</th>
                <th className="text-left p-3 font-medium text-gray-600">Role</th>
                <th className="text-left p-3 font-medium text-gray-600">Billing Rate</th>
              </tr></thead>
              <tbody>
                {(dept.members ?? []).map((m: any) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="p-3 font-medium text-gray-900">{m.userName}</td>
                    <td className="p-3 text-gray-500">{m.userEmail}</td>
                    <td className="p-3"><Badge variant={m.role === "Head" ? "default" : "secondary"}>{m.role}</Badge></td>
                    <td className="p-3 text-gray-500">{m.billingRate ? `$${m.billingRate}/hr` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(dept.members ?? []).length === 0 && <p className="p-6 text-center text-gray-400 text-sm">No members yet.</p>}
          </div>
        </div>
      )}

      {/* Matters */}
      {tab === "Matters" && (
        <div className="space-y-3">
          {matters.length === 0 && <p className="text-sm text-gray-400">No matters assigned to this department.</p>}
          {matters.map((m: any) => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{m.name}</p>
                <p className="text-sm text-gray-500">{m.client}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.practiceArea && <Badge variant="secondary">{m.practiceArea}</Badge>}
                <Badge className={m.status === "Active" ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-600 border-0"}>{m.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      {tab === "Settings" && settings && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4 max-w-lg">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Color</label>
            <input type="color" value={settings.color} onChange={e => setSettings({ ...settings, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Icon Name</label>
            <Input value={settings.icon} onChange={e => setSettings({ ...settings, icon: e.target.value })} placeholder="e.g. scale, briefcase" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Default Billing Rate ($/hr)</label>
            <Input type="number" value={settings.defaultBillingRate} onChange={e => setSettings({ ...settings, defaultBillingRate: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Practice Areas (comma-separated)</label>
            <Input value={settings.practiceAreas} onChange={e => setSettings({ ...settings, practiceAreas: e.target.value })} />
          </div>
          <Button onClick={() => updateMut.mutate({ id, ...settings, practiceAreas: settings.practiceAreas.split(",").map((s: string) => s.trim()).filter(Boolean) })} disabled={updateMut.isPending}>
            <Save className="w-4 h-4 mr-2" />{updateMut.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      )}
    </div>
  );
}

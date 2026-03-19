"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  DollarSign,
  Scale,
  GraduationCap,
  Clock,
  Briefcase,
  CalendarDays,
  Target,
  BarChart3,
  Plus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const roleBadgeColor: Record<string, string> = {
  PARTNER: "bg-purple-100 text-purple-700",
  ASSOCIATE: "bg-blue-100 text-blue-700",
  OF_COUNSEL: "bg-indigo-100 text-indigo-700",
  PARALEGAL: "bg-green-100 text-green-700",
  ADMIN: "bg-gray-100 text-gray-700",
  OTHER: "bg-gray-100 text-gray-600",
};

const TABS = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "utilization", label: "Utilization", icon: BarChart3 },
  { key: "timeoff", label: "Time Off", icon: CalendarDays },
  { key: "matters", label: "Matters", icon: Briefcase },
  { key: "cle", label: "CLE", icon: GraduationCap },
];

export default function EmployeeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState("overview");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestType, setRequestType] = useState("VACATION");
  const [requestStart, setRequestStart] = useState("");
  const [requestEnd, setRequestEnd] = useState("");
  const [requestNotes, setRequestNotes] = useState("");

  const utils = trpc.useUtils();
  const { data: employee, isLoading } = trpc.hr["employees.get"].useQuery({ id });
  const { data: timeOffBalances } = trpc.hr["timeOff.getBalances"].useQuery({ employeeId: id });
  const { data: timeOffRequests } = trpc.hr["timeOff.list"].useQuery({ employeeId: id });
  const matters: any[] = [];
  const { data: cleRecords } = trpc.hr["cle.getTracking"].useQuery({ employeeId: id });
  const { data: utilizationData } = trpc.hr["utilization.getHistory"].useQuery({ employeeId: id });

  const requestMut = trpc.hr["timeOff.create"].useMutation({
    onSuccess: () => {
      utils.hr["timeOff.list"].invalidate();
      utils.hr["timeOff.getBalances"].invalidate();
      setShowRequestForm(false);
      setRequestStart("");
      setRequestEnd("");
      setRequestNotes("");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-400">
        <p className="text-lg">Employee not found</p>
        <Link href="/hr/employees" className="text-blue-600 mt-2 text-sm hover:underline">
          Back to directory
        </Link>
      </div>
    );
  }

  const emp = employee as any;
  const displayName = emp.fullName ?? `${emp.firstName} ${emp.lastName}`;
  const cleEarned = emp.cleCreditsEarned ?? 0;
  const cleRequired = emp.cleCreditsRequired ?? 0;
  const cleRemaining = Math.max(0, cleRequired - cleEarned);
  const cleCompliant = cleEarned >= cleRequired;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/hr/employees"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Directory
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold shrink-0">
            {(emp.firstName?.[0] ?? "").toUpperCase()}
            {(emp.lastName?.[0] ?? "").toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-gray-900">{displayName}</h1>
              <Badge className={roleBadgeColor[emp.role] ?? roleBadgeColor.OTHER}>
                {emp.role}
              </Badge>
              {!emp.isActive && (
                <Badge variant="outline" className="text-gray-400">
                  Inactive
                </Badge>
              )}
            </div>
            <p className="text-gray-500 mt-1">{emp.title}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
              {emp.department && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {emp.department}
                </span>
              )}
              {emp.email && (
                <a href={`mailto:${emp.email}`} className="flex items-center gap-1 hover:text-blue-600">
                  <Mail className="h-3.5 w-3.5" /> {emp.email}
                </a>
              )}
              {emp.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {emp.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Personal Information</h3>
            <dl className="space-y-3">
              {[
                { label: "Full Name", value: displayName },
                { label: "Email", value: emp.email },
                { label: "Phone", value: emp.phone },
                { label: "Title", value: emp.title },
                { label: "Department", value: emp.department },
                { label: "Role", value: emp.role },
                { label: "Status", value: emp.isActive ? "Active" : "Inactive" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <dt className="text-sm text-gray-500">{item.label}</dt>
                  <dd className="text-sm font-medium text-gray-900">{item.value ?? "-"}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Billing & Bar */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Billing</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Billable Rate</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {emp.billableRate ? `$${Number(emp.billableRate).toFixed(2)}/hr` : "-"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Target Billable Hours</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {emp.targetBillableHours ?? "-"} hrs/year
                  </dd>
                </div>
              </dl>
            </div>

            {/* CLE Status */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4">CLE Status</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Credits Earned</dt>
                  <dd className="text-sm font-medium text-gray-900">{cleEarned}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Credits Required</dt>
                  <dd className="text-sm font-medium text-gray-900">{cleRequired}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Remaining</dt>
                  <dd className="text-sm font-medium text-gray-900">{cleRemaining}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Deadline</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {emp.cleDeadline ? new Date(emp.cleDeadline).toLocaleDateString() : "-"}
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-gray-500">Compliance</dt>
                  <dd>
                    {cleCompliant ? (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700">
                        <AlertCircle className="h-3 w-3 mr-1" /> Needs {cleRemaining} credits
                      </Badge>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {activeTab === "utilization" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Current Utilization",
                value: `${utilizationData?.[0] ? Number(utilizationData[0].utilizationRate) : 0}%`,
                icon: Target,
              },
              {
                label: "Billable Hours (YTD)",
                value: (utilizationData ?? []).reduce((s: number, r: any) => s + Number(r.billableHours ?? 0), 0).toFixed(1),
                icon: Clock,
              },
              {
                label: "Target Hours",
                value: emp.targetBillableHours ?? 0,
                icon: Target,
              },
              {
                label: "Revenue (YTD)",
                value: `$${(utilizationData ?? []).reduce((s: number, r: any) => s + Number(r.revenue ?? 0), 0).toLocaleString()}`,
                icon: DollarSign,
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">{stat.label}</span>
                  <stat.icon className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Chart Placeholder */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Monthly Utilization</h3>
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <div className="text-center text-gray-400">
                <BarChart3 className="h-10 w-10 mx-auto mb-2" />
                <p className="text-sm">Monthly utilization chart</p>
                <p className="text-xs mt-1">Data visualization coming soon</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "timeoff" && (
        <div className="space-y-6">
          {/* Balances */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(timeOffBalances ?? []).map((bal: any) => (
              <div key={bal.type} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-sm text-gray-500 mb-1">{bal.type}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {bal.remaining ?? 0}{" "}
                  <span className="text-sm font-normal text-gray-400">
                    / {bal.total ?? 0} days
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-1">{bal.used ?? 0} used</p>
              </div>
            ))}
            {(!timeOffBalances || timeOffBalances.length === 0) && (
              <div className="col-span-3 bg-white rounded-xl border p-6 text-center text-gray-400 text-sm">
                No time off balances on record
              </div>
            )}
          </div>

          {/* Request Button + Form */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Time Off Requests</h3>
              <Button
                size="sm"
                onClick={() => setShowRequestForm(!showRequestForm)}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Plus className="h-4 w-4 mr-1" />
                Request Time Off
              </Button>
            </div>

            {showRequestForm && (
              <div className="border rounded-lg p-4 mb-4 bg-gray-50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-sm">Type</Label>
                    <Select value={requestType} onValueChange={setRequestType}>
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VACATION">Vacation</SelectItem>
                        <SelectItem value="SICK">Sick</SelectItem>
                        <SelectItem value="PERSONAL">Personal</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Start Date</Label>
                    <Input
                      type="date"
                      value={requestStart}
                      onChange={(e) => setRequestStart(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">End Date</Label>
                    <Input
                      type="date"
                      value={requestEnd}
                      onChange={(e) => setRequestEnd(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Notes</Label>
                  <Textarea
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    placeholder="Optional notes..."
                    className="bg-white"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowRequestForm(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-500 hover:bg-blue-600"
                    disabled={!requestStart || !requestEnd || requestMut.isPending}
                    onClick={() =>
                      requestMut.mutate({
                        employeeId: id,
                        type: requestType,
                        startDate: requestStart,
                        endDate: requestEnd,
                        notes: requestNotes || undefined,
                      })
                    }
                  >
                    {requestMut.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </div>
            )}

            {/* Requests List */}
            <div className="space-y-2">
              {(timeOffRequests ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No time off requests</p>
              ) : (
                (timeOffRequests ?? []).map((req: any) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between border rounded-lg p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{req.type}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(req.startDate).toLocaleDateString()} &ndash;{" "}
                        {new Date(req.endDate).toLocaleDateString()}
                      </p>
                      {req.notes && <p className="text-xs text-gray-400 mt-1">{req.notes}</p>}
                    </div>
                    <Badge
                      className={
                        req.status === "APPROVED"
                          ? "bg-green-100 text-green-700"
                          : req.status === "PENDING"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }
                    >
                      {req.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "matters" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Matter</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Practice Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Billable Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(matters ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-gray-400">
                    <Briefcase className="h-8 w-8 mx-auto mb-2" />
                    No active matters
                  </TableCell>
                </TableRow>
              ) : (
                (matters ?? []).map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium text-gray-900">{m.name ?? m.title}</TableCell>
                    <TableCell className="text-gray-600">{m.clientName ?? "-"}</TableCell>
                    <TableCell className="text-gray-600">{m.practiceArea ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-gray-700">
                      {m.billableHours ?? 0}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {activeTab === "cle" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm text-gray-500">Earned</p>
              <p className="text-2xl font-bold text-gray-900">{cleEarned}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm text-gray-500">Required</p>
              <p className="text-2xl font-bold text-gray-900">{cleRequired}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm text-gray-500">Remaining</p>
              <p className="text-2xl font-bold text-gray-900">{cleRemaining}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm text-gray-500">Deadline</p>
              <p className="text-lg font-bold text-gray-900">
                {emp.cleDeadline ? new Date(emp.cleDeadline).toLocaleDateString() : "N/A"}
              </p>
            </div>
          </div>

          {/* Credits Log */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Date</TableHead>
                  <TableHead>Course / Activity</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead>Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((cleRecords as any)?.attorneys || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-gray-400">
                      <GraduationCap className="h-8 w-8 mx-auto mb-2" />
                      No CLE records
                    </TableCell>
                  </TableRow>
                ) : (
                  ((cleRecords as any)?.attorneys || []).map((rec: any) => (
                    <TableRow key={rec.id}>
                      <TableCell className="text-gray-600">
                        {new Date(rec.date ?? rec.completedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {rec.courseName ?? rec.name}
                      </TableCell>
                      <TableCell className="text-gray-600">{rec.provider ?? "-"}</TableCell>
                      <TableCell className="text-right font-medium text-gray-900">
                        {rec.credits}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rec.category ?? "General"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

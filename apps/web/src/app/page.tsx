"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Briefcase,
  Clock,
  FileText,
  TrendingUp,
  Calendar,
  ArrowRight,
  DollarSign,
  Receipt,
  AlertCircle,
  Landmark,
  CheckSquare,
  Flag,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "blue"
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  trend?: string;
  color?: "blue" | "green" | "purple" | "orange";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600"
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <div className="flex items-center gap-2">
            {trend && (
              <span className="inline-flex items-center text-xs font-medium text-emerald-600">
                <TrendingUp className="h-3 w-3 mr-1" />
                {trend}
              </span>
            )}
            <span className="text-xs text-gray-500">{subtitle}</span>
          </div>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: clientsData } = trpc.clients.list.useQuery({});
  const { data: mattersData } = trpc.matters.list.useQuery({ status: "OPEN" });
  const { data: timeSummary } = trpc.timeEntries.summary.useQuery({});
  const { data: upcomingEvents } = trpc.calendar.upcoming.useQuery({ limit: 5 });
  const { data: recentMatters } = trpc.matters.list.useQuery({ limit: 5 });
  const { data: invoiceSummary } = trpc.invoices.summary.useQuery();
  const { data: trustSummary } = trpc.trust.summary.useQuery();
  const { data: tasksSummary } = trpc.tasks.dashboardSummary.useQuery();

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}.${Math.round(mins / 6)}`;
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here is your practice overview.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Clients"
          value={clientsData?.clients.length ?? 0}
          subtitle="Active clients"
          icon={Users}
          color="blue"
        />
        <MetricCard
          title="Open Matters"
          value={mattersData?.matters.length ?? 0}
          subtitle="Active cases"
          icon={Briefcase}
          color="purple"
        />
        <MetricCard
          title="Hours Logged"
          value={formatHours(timeSummary?.totalMinutes ?? 0)}
          subtitle="Total billable"
          icon={Clock}
          color="green"
        />
        <MetricCard
          title="Billable Amount"
          value={`$${((timeSummary?.billableMinutes ?? 0) / 60 * 250).toLocaleString()}`}
          subtitle="At $250/hr"
          icon={DollarSign}
          color="orange"
        />
      </div>

      {/* Outstanding Receivables */}
      {(invoiceSummary?.totalOutstanding ?? 0) > 0 && (
        <Card className="shadow-sm border-gray-100 bg-gradient-to-r from-blue-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-100">
                  <Receipt className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Outstanding Receivables</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(invoiceSummary?.totalOutstanding ?? 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                {(invoiceSummary?.totalOverdue ?? 0) > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-xs text-red-600 font-medium">Overdue</p>
                      <p className="text-lg font-bold text-red-700">
                        {formatCurrency(invoiceSummary?.totalOverdue ?? 0)}
                      </p>
                    </div>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {invoiceSummary?.sentCount ?? 0} sent • {invoiceSummary?.overdueCount ?? 0} overdue
                  </p>
                  <Button variant="link" asChild className="text-blue-600 p-0 h-auto">
                    <Link href="/billing">
                      View all invoices
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trust Funds Widget */}
      {(trustSummary?.totalTrustFunds ?? 0) > 0 && (
        <Card className="shadow-sm border-gray-100 bg-gradient-to-r from-emerald-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-100">
                  <Landmark className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Trust Funds</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(trustSummary?.totalTrustFunds ?? 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center px-4 py-2 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-emerald-600 font-medium">Accounts</p>
                    <p className="text-lg font-bold text-emerald-700">
                      {trustSummary?.accountCount ?? 0}
                    </p>
                  </div>
                  <div className="text-center px-4 py-2 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 font-medium">Ledgers</p>
                    <p className="text-lg font-bold text-purple-700">
                      {trustSummary?.clientLedgerCount ?? 0}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    Held for clients
                  </p>
                  <Button variant="link" asChild className="text-emerald-600 p-0 h-auto">
                    <Link href="/trust">
                      Manage trust accounts
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks Widget - Overdue and Due Today */}
      {((tasksSummary?.overdueCount ?? 0) > 0 || (tasksSummary?.dueTodayCount ?? 0) > 0) && (
        <Card className="shadow-sm border-gray-100 bg-gradient-to-r from-amber-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <CheckSquare className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Tasks Requiring Attention</p>
                  <p className="text-sm text-gray-500">
                    {tasksSummary?.overdueCount ?? 0} overdue, {tasksSummary?.dueTodayCount ?? 0} due today
                  </p>
                </div>
              </div>
              <Button variant="link" asChild className="text-amber-600 p-0 h-auto">
                <Link href="/tasks">
                  View all tasks
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
            <div className="space-y-2">
              {/* Overdue Tasks */}
              {tasksSummary?.overdueTasks.slice(0, 3).map((task: any) => (
                <Link
                  key={task.id}
                  href="/tasks"
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-red-700 text-sm">{task.title}</p>
                      {task.matter && (
                        <p className="text-xs text-red-500">{task.matter.name}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-red-600 font-medium">
                    Overdue: {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                </Link>
              ))}
              {/* Due Today Tasks */}
              {tasksSummary?.dueTodayTasks.slice(0, 3).map((task: any) => (
                <Link
                  key={task.id}
                  href="/tasks"
                  className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Flag className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-amber-700 text-sm">{task.title}</p>
                      {task.matter && (
                        <p className="text-xs text-amber-500">{task.matter.name}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-amber-600 font-medium">Due Today</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Matters */}
        <Card className="lg:col-span-2 shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold">Recent Matters</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-700">
              <Link href="/matters">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentMatters?.matters.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No matters yet</p>
                <Button asChild className="mt-4" variant="outline">
                  <Link href="/matters/new">Create your first matter</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMatters?.matters.slice(0, 5).map((matter) => (
                  <Link
                    key={matter.id}
                    href={"/matters/" + matter.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Briefcase className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{matter.name}</p>
                        <p className="text-sm text-gray-500">{matter.client.name}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      matter.status === "OPEN"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {matter.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold">Upcoming Events</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-700">
              <Link href="/calendar">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingEvents?.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No upcoming events</p>
                <Button asChild className="mt-4" variant="outline">
                  <Link href="/calendar/new">Schedule an event</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents?.map((event) => (
                  <Link
                    key={event.id}
                    href={"/calendar/" + event.id}
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 flex flex-col items-center justify-center text-blue-600">
                        <span className="text-xs font-bold leading-none">
                          {new Date(event.startTime).toLocaleDateString("en-US", { day: "numeric" })}
                        </span>
                        <span className="text-[10px] uppercase">
                          {new Date(event.startTime).toLocaleDateString("en-US", { month: "short" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{event.title}</p>
                        <p className="text-sm text-gray-500">
                          {event.allDay
                            ? "All day"
                            : new Date(event.startTime).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit"
                              })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Button variant="outline" asChild className="h-auto py-4 flex flex-col items-center gap-2">
              <Link href="/clients/new">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="text-sm">New Client</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-4 flex flex-col items-center gap-2">
              <Link href="/matters/new">
                <Briefcase className="h-5 w-5 text-purple-600" />
                <span className="text-sm">New Matter</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-4 flex flex-col items-center gap-2">
              <Link href="/time/new">
                <Clock className="h-5 w-5 text-emerald-600" />
                <span className="text-sm">Log Time</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-4 flex flex-col items-center gap-2">
              <Link href="/billing/new">
                <Receipt className="h-5 w-5 text-amber-600" />
                <span className="text-sm">New Invoice</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-4 flex flex-col items-center gap-2">
              <Link href="/documents/new">
                <FileText className="h-5 w-5 text-orange-600" />
                <span className="text-sm">Upload Doc</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-4 flex flex-col items-center gap-2">
              <Link href="/calendar/new">
                <Calendar className="h-5 w-5 text-pink-600" />
                <span className="text-sm">New Event</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

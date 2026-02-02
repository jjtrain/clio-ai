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
    <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{value}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {trend && (
              <span className="inline-flex items-center text-xs font-medium text-emerald-600">
                <TrendingUp className="h-3 w-3 mr-1" />
                {trend}
              </span>
            )}
            <span className="text-xs text-gray-500">{subtitle}</span>
          </div>
        </div>
        <div className={`p-2 sm:p-3 rounded-lg ${colorClasses[color]} flex-shrink-0 ml-3`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
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
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">Welcome back! Here is your practice overview.</p>
      </div>

      {/* Metric Cards - Stack on mobile, 2 cols on sm, 4 cols on lg */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6 lg:grid-cols-4">
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
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-xl bg-blue-100 flex-shrink-0">
                  <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Outstanding Receivables</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {formatCurrency(invoiceSummary?.totalOutstanding ?? 0)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                {(invoiceSummary?.totalOverdue ?? 0) > 0 && (
                  <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-50 rounded-lg">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-red-600 font-medium">Overdue</p>
                      <p className="text-base sm:text-lg font-bold text-red-700">
                        {formatCurrency(invoiceSummary?.totalOverdue ?? 0)}
                      </p>
                    </div>
                  </div>
                )}
                <div className="text-left sm:text-right">
                  <p className="text-xs sm:text-sm text-gray-500">
                    {invoiceSummary?.sentCount ?? 0} sent • {invoiceSummary?.overdueCount ?? 0} overdue
                  </p>
                  <Button variant="link" asChild className="text-blue-600 p-0 h-auto text-sm">
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
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-xl bg-emerald-100 flex-shrink-0">
                  <Landmark className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Total Trust Funds</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {formatCurrency(trustSummary?.totalTrustFunds ?? 0)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="text-center px-3 sm:px-4 py-2 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-emerald-600 font-medium">Accounts</p>
                    <p className="text-base sm:text-lg font-bold text-emerald-700">
                      {trustSummary?.accountCount ?? 0}
                    </p>
                  </div>
                  <div className="text-center px-3 sm:px-4 py-2 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 font-medium">Ledgers</p>
                    <p className="text-base sm:text-lg font-bold text-purple-700">
                      {trustSummary?.clientLedgerCount ?? 0}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs sm:text-sm text-gray-500">
                    Held for clients
                  </p>
                  <Button variant="link" asChild className="text-emerald-600 p-0 h-auto text-sm">
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
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-amber-100 flex-shrink-0">
                  <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">Tasks Requiring Attention</p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {tasksSummary?.overdueCount ?? 0} overdue, {tasksSummary?.dueTodayCount ?? 0} due today
                  </p>
                </div>
              </div>
              <Button variant="link" asChild className="text-amber-600 p-0 h-auto text-sm flex-shrink-0">
                <Link href="/tasks">
                  <span className="hidden sm:inline">View all tasks</span>
                  <span className="sm:hidden">View</span>
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
                  className="flex items-center justify-between p-2 sm:p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors gap-2"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-red-700 text-xs sm:text-sm truncate">{task.title}</p>
                      {task.matter && (
                        <p className="text-xs text-red-500 truncate">{task.matter.name}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-red-600 font-medium whitespace-nowrap flex-shrink-0">
                    <span className="hidden sm:inline">Overdue: </span>
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                </Link>
              ))}
              {/* Due Today Tasks */}
              {tasksSummary?.dueTodayTasks.slice(0, 3).map((task: any) => (
                <Link
                  key={task.id}
                  href="/tasks"
                  className="flex items-center justify-between p-2 sm:p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors gap-2"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Flag className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-amber-700 text-xs sm:text-sm truncate">{task.title}</p>
                      {task.matter && (
                        <p className="text-xs text-amber-500 truncate">{task.matter.name}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-amber-600 font-medium whitespace-nowrap flex-shrink-0">Due Today</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid - Stack on mobile */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Recent Matters */}
        <Card className="lg:col-span-2 shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-4 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-semibold">Recent Matters</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-700 text-sm">
              <Link href="/matters">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {recentMatters?.matters.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <Briefcase className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm sm:text-base">No matters yet</p>
                <Button asChild className="mt-4" variant="outline" size="sm">
                  <Link href="/matters/new">Create your first matter</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {recentMatters?.matters.slice(0, 5).map((matter) => (
                  <Link
                    key={matter.id}
                    href={"/matters/" + matter.id}
                    className="flex items-center justify-between p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors gap-2"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{matter.name}</p>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">{matter.client.name}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex-shrink-0 ${
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
          <CardHeader className="flex flex-row items-center justify-between pb-4 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-semibold">Upcoming Events</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-700 text-sm">
              <Link href="/calendar">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {upcomingEvents?.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <Calendar className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm sm:text-base">No upcoming events</p>
                <Button asChild className="mt-4" variant="outline" size="sm">
                  <Link href="/calendar/new">Schedule an event</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {upcomingEvents?.map((event) => (
                  <Link
                    key={event.id}
                    href={"/calendar/" + event.id}
                    className="block p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-blue-100 flex flex-col items-center justify-center text-blue-600 flex-shrink-0">
                        <span className="text-xs font-bold leading-none">
                          {new Date(event.startTime).toLocaleDateString("en-US", { day: "numeric" })}
                        </span>
                        <span className="text-[10px] uppercase">
                          {new Date(event.startTime).toLocaleDateString("en-US", { month: "short" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm sm:text-base">{event.title}</p>
                        <p className="text-xs sm:text-sm text-gray-500">
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

      {/* Quick Actions - 3 cols on mobile, 6 on md+ */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4">
            <Button variant="outline" asChild className="h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2">
              <Link href="/clients/new">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <span className="text-xs sm:text-sm">New Client</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2">
              <Link href="/matters/new">
                <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                <span className="text-xs sm:text-sm">New Matter</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2">
              <Link href="/time/new">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                <span className="text-xs sm:text-sm">Log Time</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2">
              <Link href="/billing/new">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                <span className="text-xs sm:text-sm">New Invoice</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2">
              <Link href="/documents/new">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                <span className="text-xs sm:text-sm">Upload Doc</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2">
              <Link href="/calendar/new">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-pink-600" />
                <span className="text-xs sm:text-sm">New Event</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Globe, Users, FileText, BarChart3, Send, Palette, Plus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import Link from "next/link";

export function PortalAdminHub() {
  const { data: analytics } = trpc.clientPortal.getPortalAnalytics.useQuery();
  const { data: accounts } = trpc.clientPortal.listPortalUsers.useQuery({});
  const { data: themes } = trpc.clientPortal.getThemes.useQuery();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="h-7 w-7 text-blue-600" />
            Client Portal Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage client access, publish updates, and customize the portal experience
          </p>
        </div>
        <Link href="/client-portal/users">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Invite Client
          </Button>
        </Link>
      </div>

      {/* Stats */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalAccounts}</p>
                <p className="text-xs text-gray-500">Total Accounts</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics.activeClients}</p>
                <p className="text-xs text-gray-500">Active (30d)</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Send className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics.messagesSent}</p>
                <p className="text-xs text-gray-500">Messages</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <FileText className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics.documentsShared}</p>
                <p className="text-xs text-gray-500">Documents</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.avgSatisfaction ? analytics.avgSatisfaction.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-gray-500">Avg Rating</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/client-portal/users">
          <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900">Client Accounts</h2>
            </div>
            <p className="text-xs text-gray-500">Manage portal access, invite new clients, view login activity</p>
            <p className="text-xs text-blue-600 mt-2 font-medium">{accounts?.length || 0} accounts</p>
          </Card>
        </Link>

        <Link href="/client-portal/messages">
          <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-3 mb-2">
              <Send className="h-5 w-5 text-purple-600" />
              <h2 className="text-sm font-semibold text-gray-900">Messages & Updates</h2>
            </div>
            <p className="text-xs text-gray-500">Send messages, publish status updates, manage content queue</p>
          </Card>
        </Link>

        <Link href="/client-portal/settings">
          <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-3 mb-2">
              <Palette className="h-5 w-5 text-pink-600" />
              <h2 className="text-sm font-semibold text-gray-900">Branding & Themes</h2>
            </div>
            <p className="text-xs text-gray-500">Customize portal appearance per practice area</p>
            <p className="text-xs text-pink-600 mt-2 font-medium">{themes?.length || 0} themes configured</p>
          </Card>
        </Link>
      </div>

      {/* Recent Client Activity */}
      {accounts && accounts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Client Activity</h2>
          <div className="space-y-2">
            {accounts.slice(0, 10).map((account: any) => (
              <Card key={account.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">
                      {account.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{account.name}</p>
                    <p className="text-xs text-gray-500">{account.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={account.isActive ? "secondary" : "outline"} className="text-[10px]">
                    {account.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {account.lastLoginAt && (
                    <span className="text-[10px] text-gray-400">
                      Last: {new Date(account.lastLoginAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  MessageSquare,
  Settings,
  UserPlus,
  ExternalLink,
  Shield,
  Mail,
  Activity,
} from "lucide-react";

export default function ClientPortalPage() {
  const { data: stats } = trpc.clientPortal.getStats.useQuery();
  const { data: settings } = trpc.clientPortal.getSettings.useQuery();
  const { data: recentMessages } = trpc.clientPortal.listMessages.useQuery({ unreadOnly: true });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Client Portal</h1>
          <p className="text-muted-foreground">Manage secure client access and communications</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/client-portal/settings">
              <Settings className="h-4 w-4 mr-2" />
              Portal Settings
            </Link>
          </Button>
          <Button asChild>
            <Link href="/client-portal/users">
              <UserPlus className="h-4 w-4 mr-2" />
              Manage Users
            </Link>
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`rounded-xl border p-4 flex items-center gap-3 ${
        settings?.isEnabled
          ? "bg-green-50 border-green-200"
          : "bg-amber-50 border-amber-200"
      }`}>
        <Shield className={`h-5 w-5 ${settings?.isEnabled ? "text-green-600" : "text-amber-600"}`} />
        <div className="flex-1">
          <p className={`text-sm font-medium ${settings?.isEnabled ? "text-green-800" : "text-amber-800"}`}>
            {settings?.isEnabled ? "Client Portal is Active" : "Client Portal is Disabled"}
          </p>
          <p className={`text-xs ${settings?.isEnabled ? "text-green-600" : "text-amber-600"}`}>
            {settings?.isEnabled
              ? "Clients can log in and access their matters, documents, and messages"
              : "Enable the portal in settings to allow client access"}
          </p>
        </div>
        {settings?.isEnabled && (
          <Link href="/portal" target="_blank">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-3 w-3 mr-1" />
              View Portal
            </Button>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Total Users</span>
          </div>
          <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
          <p className="text-xs text-gray-400 mt-1">{stats?.activeUsers || 0} active</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <Mail className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-sm text-gray-500">Unread Messages</span>
          </div>
          <p className="text-2xl font-bold">{stats?.unreadMessages || 0}</p>
          <p className="text-xs text-gray-400 mt-1">From clients</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-50">
              <Activity className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Recent Activity</span>
          </div>
          <p className="text-2xl font-bold">{stats?.recentMessages || 0}</p>
          <p className="text-xs text-gray-400 mt-1">Messages this week</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <MessageSquare className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">Quick Actions</span>
          </div>
          <div className="space-y-2 mt-1">
            <Link href="/client-portal/messages" className="block text-sm text-blue-600 hover:underline">
              View Messages
            </Link>
            <Link href="/client-portal/users" className="block text-sm text-blue-600 hover:underline">
              Add Portal User
            </Link>
          </div>
        </div>
      </div>

      {/* Unread Messages */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Unread Client Messages</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/client-portal/messages">View All</Link>
          </Button>
        </div>
        <div className="divide-y divide-gray-50">
          {!recentMessages?.length ? (
            <div className="p-8 text-center text-gray-400">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No unread messages</p>
            </div>
          ) : (
            recentMessages.slice(0, 5).map((msg) => (
              <div key={msg.id} className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                  {msg.portalUser.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{msg.portalUser.name}</span>
                    {msg.matter && (
                      <Badge variant="secondary" className="text-[10px]">{msg.matter.name}</Badge>
                    )}
                  </div>
                  {msg.subject && <p className="text-sm font-medium text-gray-700">{msg.subject}</p>}
                  <p className="text-sm text-gray-500 truncate">{msg.content}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(msg.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

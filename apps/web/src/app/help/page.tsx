"use client";

import Link from "next/link";
import { HelpCircle, BookOpen, Keyboard, Mail, Phone, ExternalLink, Zap, Users, FileText, BarChart3, Shield, Brain } from "lucide-react";

const gettingStarted = [
  { name: "Dashboard", href: "/", icon: BarChart3, desc: "Overview of your firm's activity" },
  { name: "Clients & Matters", href: "/clients", icon: Users, desc: "Manage clients and cases" },
  { name: "Documents", href: "/documents", icon: FileText, desc: "Upload and manage documents" },
  { name: "AI Assistant", href: "/ai", icon: Brain, desc: "AI-powered tools and search" },
  { name: "Billing", href: "/billing", icon: Zap, desc: "Time tracking and invoicing" },
  { name: "Security", href: "/security", icon: Shield, desc: "Compliance and audit logs" },
];

const shortcuts = [
  { keys: "Ctrl + K", action: "Quick search" },
  { keys: "Ctrl + N", action: "New matter" },
  { keys: "Ctrl + T", action: "New time entry" },
  { keys: "Ctrl + /", action: "Show keyboard shortcuts" },
  { keys: "Ctrl + S", action: "Save current form" },
  { keys: "Esc", action: "Close dialog / cancel" },
];

export default function HelpPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2"><HelpCircle className="h-6 w-6 text-blue-500" /> Help & Support</h1>
        <p className="text-gray-500 mt-1 text-sm">Get help with Clio AI features and find answers to common questions.</p>
      </div>

      {/* Getting Started */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4"><BookOpen className="h-5 w-5 text-blue-500" /> Getting Started</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {gettingStarted.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all">
              <item.icon className="h-5 w-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4"><Keyboard className="h-5 w-5 text-blue-500" /> Keyboard Shortcuts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
              <span className="text-sm text-gray-700">{s.action}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-200 rounded text-gray-600">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4"><Mail className="h-5 w-5 text-blue-500" /> Contact Support</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a href="mailto:JR@RubEsq.com" className="flex items-center gap-3 p-4 rounded-lg border border-gray-100 hover:border-blue-200 transition-all">
            <Mail className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">Email Support</p>
              <p className="text-xs text-blue-600">JR@RubEsq.com</p>
            </div>
          </a>
          <a href="tel:+15162687077" className="flex items-center gap-3 p-4 rounded-lg border border-gray-100 hover:border-blue-200 transition-all">
            <Phone className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">Phone Support</p>
              <p className="text-xs text-green-600">(516) 268-7077</p>
            </div>
          </a>
        </div>
      </div>

      {/* Documentation */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4"><BookOpen className="h-5 w-5 text-blue-500" /> Documentation</h2>
        <p className="text-sm text-gray-500">Full documentation is being prepared. In the meantime, reach out to support for any questions about features, integrations, or configuration.</p>
      </div>
    </div>
  );
}

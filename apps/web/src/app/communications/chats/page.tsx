"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageSquare, ArrowLeft } from "lucide-react";

export default function ChatCenterPage() {
  const [channel, setChannel] = useState("all");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/communications" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Chat Center</h1>
          <p className="text-gray-500 mt-1 text-sm">Live chat conversations from website widgets and messaging integrations.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {["all", "website", "sms", "whatsapp"].map((ch) => (
          <button key={ch} onClick={() => setChannel(ch)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${channel === ch ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {ch === "all" ? "All Channels" : ch.charAt(0).toUpperCase() + ch.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-medium text-gray-700">Date</th>
            <th className="text-left p-3 font-medium text-gray-700">Participant</th>
            <th className="text-left p-3 font-medium text-gray-700">Matter</th>
            <th className="text-left p-3 font-medium text-gray-700">Channel</th>
            <th className="text-left p-3 font-medium text-gray-700">Messages</th>
            <th className="text-left p-3 font-medium text-gray-700">Status</th>
          </tr></thead>
          <tbody>
            <tr><td colSpan={6} className="text-center py-16 text-gray-400">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No chat conversations yet</p>
              <p className="text-xs mt-1">Conversations from your website chat widget and messaging integrations will appear here.</p>
            </td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { Globe, CheckCircle, AlertTriangle, BookOpen, Languages } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export function TranslationDashboard() {
  const { data: stats } = trpc.translation.getTranslationStats.useQuery();
  const { data: languages } = trpc.translation.getLanguages.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="h-7 w-7 text-blue-600" />
            Translations & Languages
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage multilingual client portal translations</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Languages className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.activeLanguages}</p>
                <p className="text-xs text-gray-500">Active Languages</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Globe className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTranslations}</p>
                <p className="text-xs text-gray-500">Total Translations</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.verificationRate}%</p>
                <p className="text-xs text-gray-500">Verified</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", stats.needsReview > 0 ? "bg-orange-50" : "bg-green-50")}>
                <AlertTriangle className={cn("h-5 w-5", stats.needsReview > 0 ? "text-orange-600" : "text-green-600")} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.needsReview}</p>
                <p className="text-xs text-gray-500">Needs Review</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Language Cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Configured Languages</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {languages?.map((lang) => (
            <Card key={lang.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{lang.nativeName}</p>
                  <p className="text-xs text-gray-500">{lang.languageName}</p>
                </div>
                <Badge className={cn("text-[10px]", lang.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                  {lang.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">UI Coverage</span>
                  <span className="font-medium">{Math.round(lang.uiCoverage * 100)}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${lang.uiCoverage * 100}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                  <span>{lang.glossarySize} glossary terms</span>
                  <span>{lang.activeClients} clients</span>
                </div>
              </div>
              {lang.isRTL && <Badge variant="outline" className="text-[10px] mt-2">RTL</Badge>}
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Translations needing review */}
      {stats && stats.needsReview > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Translations Needing Review ({stats.needsReview})
          </h2>
          <p className="text-xs text-gray-500">
            These translations were auto-generated and may need human review for accuracy.
          </p>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Star, Download, ArrowRight, Package } from "lucide-react";

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [practiceArea, setPracticeArea] = useState("all");
  const [jurisdiction, setJurisdiction] = useState("");
  const [sortBy, setSortBy] = useState("rating");

  const { data: featured } = trpc.practiceArea["community.getFeatured"].useQuery();
  const { data: templates } = trpc.practiceArea["community.search"].useQuery({
    query: search,
    practiceArea: practiceArea === "all" ? undefined : practiceArea,
    jurisdiction: jurisdiction || undefined,
    sortBy,
  });

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Marketplace</h1>
          <p className="text-gray-500">Browse and install community pipeline templates</p>
        </div>
        <div className="flex gap-2">
          <Link href="/practice-areas/marketplace/installed">
            <Button variant="outline">Installed Pipelines</Button>
          </Link>
          <Link href="/practice-areas/marketplace/publish">
            <Button><Package className="mr-2 h-4 w-4" />Publish Pipeline</Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={practiceArea} onValueChange={setPracticeArea}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Practice Area" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Practice Areas</SelectItem>
            <SelectItem value="family">Family Law</SelectItem>
            <SelectItem value="corporate">Corporate</SelectItem>
            <SelectItem value="litigation">Litigation</SelectItem>
            <SelectItem value="immigration">Immigration</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Jurisdiction..." value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className="w-40" />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rating">Top Rated</SelectItem>
            <SelectItem value="downloads">Most Downloaded</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {featured && featured.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Featured Templates</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((t: any) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold">All Templates</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(templates as any)?.templates?.map((t: any) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
        {(templates as any)?.templates?.length === 0 && (
          <p className="py-12 text-center text-gray-400">No templates found matching your criteria.</p>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: any }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-start justify-between">
        <h3 className="font-semibold">{template.title}</h3>
        <span className="text-xs text-gray-400">by {template.publisher}</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary">{template.practiceArea}</Badge>
        {template.jurisdiction && <Badge variant="outline">{template.jurisdiction}</Badge>}
      </div>
      <div className="mb-3 flex items-center gap-4 text-sm text-gray-500">
        <span className="flex items-center gap-1">{template.stageCount} stages</span>
        <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />{template.rating?.toFixed(1)}</span>
        <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" />{template.downloads}</span>
      </div>
      {template.tags?.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {template.tags.map((tag: string) => (
            <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tag}</span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Link href={`/practice-areas/marketplace/${template.id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full">Preview <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
        </Link>
        <Link href={`/practice-areas/marketplace/${template.id}`} className="flex-1">
          <Button size="sm" className="w-full">Install</Button>
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, ChevronLeft, ChevronRight } from "lucide-react";

const practiceAreas = [
  "All", "Corporate", "Litigation", "Real Estate", "Family Law",
  "Immigration", "Criminal Defense", "IP / Patent", "Employment",
  "Estate Planning", "Tax", "Personal Injury", "Bankruptcy",
];

const categories = ["All", "Contracts", "Pleadings", "Discovery", "Correspondence", "Forms", "Checklists"];

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-sm">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < Math.round(rating) ? "text-yellow-400" : "text-gray-300"}>★</span>
      ))}
    </span>
  );
}

export default function BrowsePage() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("All");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("popular");
  const [priceFilter, setPriceFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.marketplace["browse"].useQuery({
    search: query || undefined,
    practiceArea: area !== "All" ? area : undefined,
    category: category !== "All" ? category : undefined,
    sortBy: sort,
    page,
    perPage: 12,
  });

  const packages = data?.packages ?? [];
  const totalPages = data?.total ? Math.ceil(data.total / 12) : 1;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Search */}
      <div className="relative max-w-2xl mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search packages..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          className="pl-10"
        />
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 space-y-5">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">Practice Area</label>
            <Select value={area} onValueChange={(v) => { setArea(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {practiceAreas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">Category</label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">Sort By</label>
            <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Popular</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="top-rated">Top Rated</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">Price</label>
            <Select value={priceFilter} onValueChange={(v) => { setPriceFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="free">Free Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1">
          {isLoading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : packages.length === 0 ? (
            <p className="text-gray-400 text-sm">No packages found.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.map((pkg: any) => (
                  <div key={pkg.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{pkg.name}</h3>
                      {pkg.price === 0 ? (
                        <Badge className="bg-green-100 text-green-700 border-0 text-xs">Free</Badge>
                      ) : (
                        <span className="text-sm font-semibold">${(pkg.price / 100).toFixed(2)}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">by {pkg.publisherName}</p>
                    <div className="flex gap-1.5 mb-3">
                      <Badge variant="outline" className="text-xs">{pkg.practiceArea}</Badge>
                      {pkg.category && <Badge variant="secondary" className="text-xs">{pkg.category}</Badge>}
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Stars rating={pkg.rating} />
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <Package className="h-3 w-3" /> {pkg.templateCount}
                        </span>
                      </div>
                      <Link href={`/marketplace/${pkg.slug}`}>
                        <Button size="sm" variant="outline" className="text-xs h-7">View</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-4 mt-8">
                <Button
                  variant="outline" size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <Button
                  variant="outline" size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

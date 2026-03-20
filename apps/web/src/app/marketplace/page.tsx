"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Star, Package, ArrowRight } from "lucide-react";

const practiceAreas = [
  "Corporate", "Litigation", "Real Estate", "Family Law",
  "Immigration", "Criminal Defense", "IP / Patent", "Employment",
  "Estate Planning", "Tax", "Personal Injury", "Bankruptcy",
];

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-sm">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < Math.round(rating) ? "text-yellow-400" : "text-gray-300"}>
          ★
        </span>
      ))}
    </span>
  );
}

function PackageCard({ pkg }: { pkg: any }) {
  return (
    <Link href={`/marketplace/${pkg.slug}`}>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow h-full flex flex-col">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-1">{pkg.name}</h3>
          {pkg.price === 0 ? (
            <Badge className="bg-green-100 text-green-700 border-0">Free</Badge>
          ) : (
            <span className="text-sm font-semibold text-gray-900">${(pkg.price / 100).toFixed(2)}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-2">by {pkg.publisherName}</p>
        <Badge variant="outline" className="w-fit mb-3 text-xs">{pkg.practiceArea}</Badge>
        <div className="mt-auto flex items-center justify-between">
          <Stars rating={pkg.rating} />
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Package className="h-3 w-3" /> {pkg.templateCount} templates
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const { data: featured } = trpc.marketplace["getFeatured"].useQuery();
  const { data: newArrivals } = trpc.marketplace["getNewArrivals"].useQuery();

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
      {/* Hero */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">Template Marketplace</h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Discover, purchase, and install professionally crafted legal template packages for every practice area.
        </p>
        <div className="relative max-w-lg mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search templates, packages, publishers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            onKeyDown={(e) => {
              if (e.key === "Enter" && search.trim()) {
                window.location.href = `/marketplace/browse?q=${encodeURIComponent(search)}`;
              }
            }}
          />
        </div>
      </section>

      {/* Featured */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Featured Packages</h2>
          <Link href="/marketplace/browse" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featured?.map((pkg: any) => <PackageCard key={pkg.id} pkg={pkg} />)}
        </div>
      </section>

      {/* Browse by Practice Area */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Browse by Practice Area</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {practiceAreas.map((area) => (
            <Link key={area} href={`/marketplace/browse?area=${encodeURIComponent(area)}`}>
              <Button variant="outline" className="w-full justify-start text-sm">
                {area}
              </Button>
            </Link>
          ))}
        </div>
      </section>

      {/* New Arrivals */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">New Arrivals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {newArrivals?.map((pkg: any) => <PackageCard key={pkg.id} pkg={pkg} />)}
        </div>
      </section>
    </div>
  );
}

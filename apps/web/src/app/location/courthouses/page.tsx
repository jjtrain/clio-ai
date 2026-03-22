"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Search, MapPin, ParkingCircle, ShieldCheck, Plus, Navigation, Building2 } from "lucide-react";

export default function CourthouseDirectoryPage() {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const filters: any = {};
  if (stateFilter) filters.state = stateFilter;
  if (typeFilter) filters.courtType = typeFilter;

  const courthouses = trpc.location["courthouses.list"].useQuery(filters);
  const checkIn = trpc.location["checkIn"].useMutation();
  const seed = trpc.location["courthouses.seed"].useMutation({ onSuccess: () => courthouses.refetch() });

  const filtered = (courthouses.data as any[] || []).filter((c: any) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.city.toLowerCase().includes(search.toLowerCase())
  );

  const states = Array.from(new Set((courthouses.data as any[] || []).map((c: any) => c.state))).sort() as string[];
  const types = Array.from(new Set((courthouses.data as any[] || []).map((c: any) => c.courtType).filter(Boolean))).sort() as string[];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6" /> Courthouse Directory</h1>
          <p className="text-muted-foreground">Browse and manage courthouse locations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => seed.mutate()} className="text-sm border rounded px-3 py-2 hover:bg-muted">
            {seed.isLoading ? "Seeding..." : "Seed Defaults"}
          </button>
          <Link href="/location/courthouses/new" className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" /> Add Courthouse
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courthouses..." className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm" />
        </div>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All States</option>
          {states.map((s: any) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Types</option>
          {types.map((t: any) => <option key={t} value={t}>{String(t).replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {/* Grid */}
      {courthouses.isLoading ? (
        <p className="text-muted-foreground">Loading courthouses...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No courthouses found. Try seeding defaults.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c: any) => (
            <div key={c.id} className="border rounded-lg p-4 space-y-3 hover:shadow-sm transition-shadow">
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-sm leading-tight">{c.name}</h3>
                  {c.courtType && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded whitespace-nowrap ml-2">
                      {String(c.courtType).replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{c.city}, {c.state}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.address}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {c.parkingNotes && <span className="flex items-center gap-1"><ParkingCircle className="h-3.5 w-3.5" /> Parking</span>}
                {c.securityNotes && <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Security</span>}
              </div>
              <div className="flex gap-2">
                <Link href={`/location/courthouses/${c.id}`} className="flex-1 text-center border rounded py-1.5 text-xs font-medium hover:bg-muted">
                  View Details
                </Link>
                <button onClick={() => checkIn.mutate({ courthouseId: c.id, userId: "current-user" })} className="flex-1 text-center bg-primary text-primary-foreground rounded py-1.5 text-xs font-medium hover:opacity-90">
                  <MapPin className="h-3 w-3 inline mr-1" /> Check In
                </button>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`} target="_blank" rel="noopener noreferrer" className="border rounded py-1.5 px-2 text-xs hover:bg-muted" title="Directions">
                  <Navigation className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

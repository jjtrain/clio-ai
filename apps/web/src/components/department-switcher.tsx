"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  departments: { id: string; name: string; color?: string }[];
  activeDepartmentId: string | null;
  onSwitch: (id: string | null) => void;
}

export function DepartmentSwitcher({ departments, activeDepartmentId, onSwitch }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (departments.length <= 1) return null;
  const active = departments.find(d => d.id === activeDepartmentId);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50 transition">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active?.color ?? "#6b7280" }} />
        {active?.name ?? "All Departments"}
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-lg z-50 py-1">
          <button onClick={() => { onSwitch(null); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-400" /> All Departments
          </button>
          {departments.map(d => (
            <button key={d.id} onClick={() => { onSwitch(d.id); setOpen(false); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${d.id === activeDepartmentId ? "bg-blue-50 text-blue-700" : ""}`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color ?? "#6b7280" }} /> {d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

interface DynamicFieldsProps {
  fields: Array<{
    id: string;
    fieldName: string;
    fieldLabel: string;
    fieldType: string;
    fieldOptions?: string | null;
    placeholder?: string | null;
    isRequired?: boolean;
    section: string;
    helpText?: string | null;
    value?: string | null;
  }>;
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  readOnly?: boolean;
  section?: string;
}

const SECTION_HEADERS: Record<string, string> = {
  details: "Details",
  parties: "Parties",
  court: "Court Info",
  financial: "Financial",
  dates: "Key Dates",
  custom: "Custom",
};

const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

function parseOptions(fieldOptions?: string | null): string[] {
  if (!fieldOptions) return [];
  try {
    return JSON.parse(fieldOptions);
  } catch {
    return [];
  }
}

function formatCurrency(val: string): string {
  const num = parseFloat(val);
  if (isNaN(num)) return "—";
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DynamicFields({ fields, values, onChange, readOnly, section }: DynamicFieldsProps) {
  const filtered = section ? fields.filter((f) => f.section === section) : fields;

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, field) => {
    (acc[field.section] ??= []).push(field);
    return acc;
  }, {});

  const renderReadOnly = (field: (typeof fields)[0], value: string) => {
    if (field.fieldType === "CFT_BOOLEAN") return <p className="text-sm text-gray-900">{value === "true" ? "Yes" : "No"}</p>;
    if (field.fieldType === "CFT_CURRENCY") return <p className="text-sm text-gray-900">{formatCurrency(value)}</p>;
    return <p className="text-sm text-gray-900">{value || "—"}</p>;
  };

  const renderInput = (field: (typeof fields)[0]) => {
    const value = values[field.id] ?? "";
    const ph = field.placeholder ?? undefined;

    if (readOnly) return renderReadOnly(field, value);

    switch (field.fieldType) {
      case "CFT_TEXT":
        return <input type="text" className={inputClass} value={value} placeholder={ph} required={field.isRequired} onChange={(e) => onChange(field.id, e.target.value)} />;
      case "CFT_TEXTAREA":
        return <textarea rows={3} className={inputClass} value={value} placeholder={ph} required={field.isRequired} onChange={(e) => onChange(field.id, e.target.value)} />;
      case "CFT_NUMBER":
        return <input type="number" className={inputClass} value={value} placeholder={ph} required={field.isRequired} onChange={(e) => onChange(field.id, e.target.value)} />;
      case "CFT_DATE":
        return <input type="date" className={inputClass} value={value} required={field.isRequired} onChange={(e) => onChange(field.id, e.target.value)} />;
      case "CFT_SELECT": {
        const options = parseOptions(field.fieldOptions);
        return (
          <select className={inputClass} value={value} required={field.isRequired} onChange={(e) => onChange(field.id, e.target.value)}>
            <option value="">Select...</option>
            {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      }
      case "CFT_MULTI_SELECT": {
        const options = parseOptions(field.fieldOptions);
        const selected = value ? value.split(",") : [];
        return (
          <div className="flex flex-wrap gap-3">
            {options.map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={(e) => {
                    const next = e.target.checked ? [...selected, opt] : selected.filter((s) => s !== opt);
                    onChange(field.id, next.join(","));
                  }}
                />
                {opt}
              </label>
            ))}
          </div>
        );
      }
      case "CFT_BOOLEAN":
        return (
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" className="peer sr-only" checked={value === "true"} onChange={(e) => onChange(field.id, String(e.target.checked))} />
            <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />
          </label>
        );
      case "CFT_CURRENCY":
        return (
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">$</span>
            <input type="number" step="0.01" className={`${inputClass} pl-7`} value={value} placeholder={ph} required={field.isRequired} onChange={(e) => onChange(field.id, e.target.value)} />
          </div>
        );
      case "CFT_URL":
        return <input type="url" className={inputClass} value={value} placeholder={ph} required={field.isRequired} onChange={(e) => onChange(field.id, e.target.value)} />;
      case "CFT_EMAIL":
        return <input type="email" className={inputClass} value={value} placeholder={ph} required={field.isRequired} onChange={(e) => onChange(field.id, e.target.value)} />;
      case "CFT_PHONE":
        return <input type="tel" className={inputClass} value={value} placeholder={ph} required={field.isRequired} onChange={(e) => onChange(field.id, e.target.value)} />;
      default:
        return <input type="text" className={inputClass} value={value} placeholder={ph} onChange={(e) => onChange(field.id, e.target.value)} />;
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([sec, sectionFields]) => (
        <div key={sec}>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            {SECTION_HEADERS[sec] ?? sec}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sectionFields.map((field) => (
              <div key={field.id} className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  {field.fieldLabel}
                  {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {renderInput(field)}
                {field.helpText && <p className="text-xs text-gray-400">{field.helpText}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

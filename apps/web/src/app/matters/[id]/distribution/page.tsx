"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Scale, Plus, Save, Camera, Download, Settings, ChevronDown,
  ChevronRight, DollarSign, AlertTriangle, Trash2, Copy,
  ArrowRightLeft, BarChart3, X, Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { computeWorksheetTotals, computeEqualizationPayment } from "@/lib/equitable-distribution/calculator";
import { ASSET_CATEGORIES, CLASSIFICATION_OPTIONS, DISPOSITION_OPTIONS, getJurisdictionContext } from "@/lib/equitable-distribution/jurisdiction-context";

export default function DistributionPage() {
  const params = useParams();
  const matterId = params.id as string;

  const [showAddRow, setShowAddRow] = useState(false);
  const [addCategory, setAddCategory] = useState("REAL_PROPERTY");
  const [addDescription, setAddDescription] = useState("");
  const [addValue, setAddValue] = useState("");
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  const worksheetQuery = trpc.equitableDistribution.getWorksheet.useQuery({ matterId });
  const createMut = trpc.equitableDistribution.createWorksheet.useMutation({ onSuccess: () => worksheetQuery.refetch() });
  const addRowMut = trpc.equitableDistribution.addRow.useMutation({ onSuccess: () => { worksheetQuery.refetch(); setAddDescription(""); setAddValue(""); } });
  const updateFieldMut = trpc.equitableDistribution.updateRowField.useMutation({ onSuccess: () => worksheetQuery.refetch() });
  const deleteRowMut = trpc.equitableDistribution.deleteRow.useMutation({ onSuccess: () => worksheetQuery.refetch() });
  const snapshotMut = trpc.equitableDistribution.takeSnapshot.useMutation();
  const updateSettingsMut = trpc.equitableDistribution.updateSettings.useMutation({ onSuccess: () => worksheetQuery.refetch() });

  const worksheet = worksheetQuery.data;
  const rows = worksheet?.rows || [];

  // Live totals
  const totals = useMemo(() => computeWorksheetTotals(rows as any), [rows]);
  const equalization = useMemo(() => computeEqualizationPayment(totals.payorNetAward, totals.payeeNetAward), [totals]);

  // Group rows by category
  const grouped = useMemo(() => {
    const groups: Record<string, typeof rows> = {};
    for (const cat of ASSET_CATEGORIES) {
      const catRows = rows.filter((r) => r.category === cat.value);
      if (catRows.length > 0) groups[cat.value] = catRows;
    }
    return groups;
  }, [rows]);

  if (!worksheet) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card className="p-12 text-center">
          <Scale className="h-16 w-16 text-indigo-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800">Equitable Distribution Worksheet</h2>
          <p className="text-sm text-gray-500 mt-2">Track assets and liabilities for property division</p>
          <Button className="mt-4" onClick={() => createMut.mutate({ matterId })}>
            {createMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Create Worksheet
          </Button>
        </Card>
      </div>
    );
  }

  const jCtx = getJurisdictionContext(worksheet.jurisdiction);

  function handleAddRow() {
    if (!addDescription) return;
    const isLiab = ASSET_CATEGORIES.find((c) => c.value === addCategory)?.isLiability || false;
    addRowMut.mutate({
      worksheetId: worksheet!.id,
      category: addCategory,
      description: addDescription,
      isLiability: isLiab,
      payorClaimedValue: addValue ? Number(addValue) : undefined,
    });
  }

  function toggleCategory(cat: string) {
    setExpandedCats((prev) => ({ ...prev, [cat]: prev[cat] === false ? true : false }));
  }

  const fmt = (n: number | null | undefined) => n != null ? `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 border-b bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-600" />
            <h1 className="text-sm font-semibold text-gray-900">Equitable Distribution</h1>
            <Badge className="text-[10px] bg-gray-100 text-gray-600">{worksheet.jurisdiction} — {jCtx.standard === "COMMUNITY_PROPERTY" ? "Community Property" : "Equitable"}</Badge>
            <Badge className={cn("text-[10px]", worksheet.status === "DRAFT" ? "bg-gray-100" : worksheet.status === "STIPULATED" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}>{worksheet.status}</Badge>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAddRow(!showAddRow)}><Plus className="h-3 w-3 mr-1" /> Add Row</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => snapshotMut.mutate({ worksheetId: worksheet.id, label: `Snapshot ${new Date().toLocaleDateString()}` })}><Camera className="h-3 w-3 mr-1" /> Snapshot</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowSidePanel(!showSidePanel)}><BarChart3 className="h-3 w-3 mr-1" /> Summary</Button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="px-3 py-2 bg-gray-50 border-b flex gap-3 flex-shrink-0 overflow-x-auto">
          <div className="text-center px-3 py-1 bg-white rounded-lg border min-w-[130px]">
            <p className="text-[10px] text-gray-500">Net Marital Estate</p>
            <p className="text-lg font-bold text-gray-900">{fmt(totals.netMaritalEstate)}</p>
          </div>
          <div className="text-center px-3 py-1 bg-blue-50 rounded-lg border border-blue-200 min-w-[130px]">
            <p className="text-[10px] text-blue-600">{worksheet.payorLabel}</p>
            <p className="text-lg font-bold text-blue-900">{fmt(totals.payorNetAward)} <span className="text-xs font-normal">({totals.payorSharePercent}%)</span></p>
          </div>
          <div className="text-center px-3 py-1 bg-green-50 rounded-lg border border-green-200 min-w-[130px]">
            <p className="text-[10px] text-green-600">{worksheet.payeeLabel}</p>
            <p className="text-lg font-bold text-green-900">{fmt(totals.payeeNetAward)} <span className="text-xs font-normal">({totals.payeeSharePercent}%)</span></p>
          </div>
          <div className="text-center px-3 py-1 bg-amber-50 rounded-lg border border-amber-200 min-w-[130px]">
            <p className="text-[10px] text-amber-600"><ArrowRightLeft className="h-3 w-3 inline" /> Equalization</p>
            <p className="text-sm font-bold text-amber-900">{fmt(totals.equalizationPayment)}</p>
          </div>
          {totals.undisposedRows > 0 && (
            <div className="text-center px-3 py-1 bg-red-50 rounded-lg border border-red-200 min-w-[100px]">
              <p className="text-[10px] text-red-600">Unresolved</p>
              <p className="text-sm font-bold text-red-900">{totals.undisposedRows} items</p>
            </div>
          )}
        </div>

        {/* Add Row Form */}
        {showAddRow && (
          <div className="px-3 py-2 bg-indigo-50 border-b flex gap-2 items-end flex-shrink-0">
            <Select value={addCategory} onValueChange={setAddCategory}>
              <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>{ASSET_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={addDescription} onChange={(e) => setAddDescription(e.target.value)} placeholder="Description *" className="h-8 text-xs flex-1" />
            <Input type="number" value={addValue} onChange={(e) => setAddValue(e.target.value)} placeholder="Value" className="h-8 text-xs w-[120px]" />
            <Button size="sm" className="h-8 text-xs" onClick={handleAddRow} disabled={!addDescription}><Plus className="h-3 w-3 mr-1" /> Add</Button>
            <button onClick={() => setShowAddRow(false)}><X className="h-4 w-4 text-gray-400" /></button>
          </div>
        )}

        {/* Spreadsheet Grid */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="text-left px-2 py-2 font-medium text-gray-500 w-[140px] sticky left-0 bg-gray-50">Category</th>
                <th className="text-left px-2 py-2 font-medium text-gray-500 w-[200px] sticky left-[140px] bg-gray-50">Description</th>
                <th className="text-left px-2 py-2 font-medium text-gray-500 w-[90px]">Titled In</th>
                <th className="text-left px-2 py-2 font-medium text-gray-500 w-[110px]">Classification</th>
                <th className="text-right px-2 py-2 font-medium text-blue-600 w-[110px] bg-blue-50">{worksheet.payorLabel}</th>
                <th className="text-right px-2 py-2 font-medium text-green-600 w-[110px] bg-green-50">{worksheet.payeeLabel}</th>
                <th className="text-right px-2 py-2 font-medium text-gray-600 w-[90px]">Gap</th>
                <th className="text-right px-2 py-2 font-medium text-gray-900 w-[110px]">Agreed</th>
                <th className="text-left px-2 py-2 font-medium text-gray-500 w-[120px]">Disposition</th>
                <th className="text-left px-2 py-2 font-medium text-gray-500 w-[80px]">Awarded</th>
                <th className="text-right px-2 py-2 font-medium text-blue-600 w-[100px] bg-blue-50">A Final</th>
                <th className="text-right px-2 py-2 font-medium text-green-600 w-[100px] bg-green-50">B Final</th>
                <th className="w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([cat, catRows]) => {
                const catMeta = ASSET_CATEGORIES.find((c) => c.value === cat);
                const isExpanded = expandedCats[cat] !== false;
                const catTotal = catRows.reduce((s, r) => s + (r.agreedValue || r.payorClaimedValue || 0), 0);

                return (
                  <tbody key={cat}>
                    {/* Category Header */}
                    <tr className="bg-gray-100 border-y">
                      <td colSpan={8} className="px-2 py-1.5">
                        <button onClick={() => toggleCategory(cat)} className="flex items-center gap-1 font-semibold text-gray-700">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {catMeta?.label || cat}
                          <span className="text-gray-400 font-normal ml-1">({catRows.length})</span>
                        </button>
                      </td>
                      <td colSpan={3} className="text-right px-2 py-1.5 font-semibold text-gray-700">{fmt(catTotal)}</td>
                      <td colSpan={2}></td>
                    </tr>

                    {/* Rows */}
                    {isExpanded && catRows.map((row) => {
                      const classOpt = CLASSIFICATION_OPTIONS.find((c) => c.value === row.classification);
                      const gap = (row.payorClaimedValue != null && row.payeeClaimedValue != null) ? Math.abs(row.payorClaimedValue - row.payeeClaimedValue) : null;
                      const rowBorder = row.classification === "DISPUTED" ? "border-l-4 border-l-amber-400 bg-amber-50/30"
                        : row.classification === "SEPARATE_PAYOR" ? "border-l-4 border-l-purple-300 bg-purple-50/20"
                        : row.classification === "SEPARATE_PAYEE" ? "border-l-4 border-l-green-300 bg-green-50/20"
                        : "";

                      return (
                        <tr key={row.id} className={cn("border-b hover:bg-gray-50", rowBorder)}>
                          <td className="px-2 py-1.5 sticky left-0 bg-white">
                            <Badge variant="outline" className="text-[9px]">{catMeta?.label?.split(" ")[0]}</Badge>
                          </td>
                          <td className="px-2 py-1.5 sticky left-[140px] bg-white">
                            <input defaultValue={row.description} onBlur={(e) => { if (e.target.value !== row.description) updateFieldMut.mutate({ id: row.id, field: "description", value: e.target.value }); }}
                              className="w-full bg-transparent text-sm text-gray-900 outline-none focus:bg-blue-50 focus:px-1 rounded" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input defaultValue={row.titledIn || ""} onBlur={(e) => updateFieldMut.mutate({ id: row.id, field: "titledIn", value: e.target.value })}
                              className="w-full bg-transparent outline-none focus:bg-blue-50 rounded text-gray-600" placeholder="—" />
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={row.classification} onChange={(e) => updateFieldMut.mutate({ id: row.id, field: "classification", value: e.target.value })}
                              className={cn("text-[10px] px-1.5 py-0.5 rounded border-0 font-medium", classOpt?.color || "bg-gray-100")}>
                              {CLASSIFICATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 bg-blue-50/30">
                            <input type="number" defaultValue={row.payorClaimedValue ?? ""} onBlur={(e) => updateFieldMut.mutate({ id: row.id, field: "payorClaimedValue", value: e.target.value ? Number(e.target.value) : null })}
                              className="w-full bg-transparent text-right font-mono outline-none focus:bg-blue-100 rounded" placeholder="—" />
                          </td>
                          <td className="px-2 py-1.5 bg-green-50/30">
                            <input type="number" defaultValue={row.payeeClaimedValue ?? ""} onBlur={(e) => updateFieldMut.mutate({ id: row.id, field: "payeeClaimedValue", value: e.target.value ? Number(e.target.value) : null })}
                              className="w-full bg-transparent text-right font-mono outline-none focus:bg-green-100 rounded" placeholder="—" />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {gap != null && gap > 0 && (
                              <span className={cn("font-mono", gap > 10000 ? "text-red-600 font-semibold" : gap > 1000 ? "text-amber-600" : "text-green-600")}>
                                {fmt(gap)}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" defaultValue={row.agreedValue ?? ""} onBlur={(e) => updateFieldMut.mutate({ id: row.id, field: "agreedValue", value: e.target.value ? Number(e.target.value) : null })}
                              className="w-full bg-transparent text-right font-mono font-semibold outline-none focus:bg-yellow-100 rounded" placeholder="—" />
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={row.disposition || ""} onChange={(e) => updateFieldMut.mutate({ id: row.id, field: "disposition", value: e.target.value || null })}
                              className="text-[10px] bg-transparent outline-none">
                              <option value="">—</option>
                              {DISPOSITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={row.awardedTo || ""} onChange={(e) => updateFieldMut.mutate({ id: row.id, field: "awardedTo", value: e.target.value || null })}
                              className="text-[10px] bg-transparent outline-none">
                              <option value="">—</option>
                              <option value="PAYOR">A</option>
                              <option value="PAYEE">B</option>
                              <option value="JOINT">Joint</option>
                              <option value="SOLD">Sold</option>
                            </select>
                          </td>
                          <td className="px-2 py-1.5 bg-blue-50/30">
                            <input type="number" defaultValue={row.payorFinalShare ?? ""} onBlur={(e) => updateFieldMut.mutate({ id: row.id, field: "payorFinalShare", value: e.target.value ? Number(e.target.value) : null })}
                              className="w-full bg-transparent text-right font-mono outline-none focus:bg-blue-100 rounded" placeholder="—" />
                          </td>
                          <td className="px-2 py-1.5 bg-green-50/30">
                            <input type="number" defaultValue={row.payeeFinalShare ?? ""} onBlur={(e) => updateFieldMut.mutate({ id: row.id, field: "payeeFinalShare", value: e.target.value ? Number(e.target.value) : null })}
                              className="w-full bg-transparent text-right font-mono outline-none focus:bg-green-100 rounded" placeholder="—" />
                          </td>
                          <td className="px-2 py-1.5">
                            <button onClick={() => deleteRowMut.mutate({ id: row.id })} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}

              {/* Grand Total */}
              <tr className="bg-gray-200 font-semibold border-t-2">
                <td colSpan={4} className="px-2 py-2 sticky left-0 bg-gray-200">TOTAL</td>
                <td className="px-2 py-2 text-right font-mono bg-blue-100">{fmt(rows.filter((r) => !r.isLiability).reduce((s, r) => s + (r.payorClaimedValue || 0), 0))}</td>
                <td className="px-2 py-2 text-right font-mono bg-green-100">{fmt(rows.filter((r) => !r.isLiability).reduce((s, r) => s + (r.payeeClaimedValue || 0), 0))}</td>
                <td className="px-2 py-2 text-right font-mono">{fmt(totals.totalValuationGap)}</td>
                <td className="px-2 py-2 text-right font-mono">{fmt(totals.totalGrossAssets - totals.totalGrossLiabilities)}</td>
                <td colSpan={2}></td>
                <td className="px-2 py-2 text-right font-mono bg-blue-100">{fmt(totals.payorNetAward)}</td>
                <td className="px-2 py-2 text-right font-mono bg-green-100">{fmt(totals.payeeNetAward)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="p-12 text-center">
              <DollarSign className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No assets or liabilities added yet</p>
              <Button variant="outline" className="mt-3" onClick={() => setShowAddRow(true)}><Plus className="h-4 w-4 mr-1" /> Add First Item</Button>
            </div>
          )}
        </div>
      </div>

      {/* Side Panel */}
      {showSidePanel && (
        <div className="w-[320px] border-l bg-white overflow-auto flex-shrink-0">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Distribution Summary</h3>
              <button onClick={() => setShowSidePanel(false)}><X className="h-4 w-4 text-gray-400" /></button>
            </div>

            {/* Equalization */}
            <Card className="p-3 bg-amber-50 border-amber-200">
              <p className="text-xs font-semibold text-amber-700 mb-1">Equalization Payment</p>
              <p className="text-lg font-bold text-amber-900">{fmt(equalization.amount)}</p>
              <p className="text-xs text-amber-700 mt-1">{equalization.explanation}</p>
            </Card>

            {/* Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Total Gross Assets</span><span className="font-mono">{fmt(totals.totalGrossAssets)}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Total Liabilities</span><span className="font-mono text-red-600">({fmt(totals.totalGrossLiabilities)})</span></div>
              <div className="flex justify-between py-1 border-b font-semibold"><span>Net Marital Estate</span><span className="font-mono">{fmt(totals.netMaritalEstate)}</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-500">Disputed Items</span><span className="font-mono text-amber-600">{fmt(totals.totalDisputedAssets)}</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-500">Unresolved</span><span>{totals.undisposedRows} items</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-500">Valuation Gap</span><span className="font-mono">{fmt(totals.totalValuationGap)}</span></div>
            </div>

            {/* Jurisdiction */}
            <Card className="p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-700 mb-1">{worksheet.jurisdiction} — {jCtx.statute}</p>
              <p className="text-[10px] text-gray-500">{jCtx.presumption}</p>
              {jCtx.caveats.map((c, i) => (
                <div key={i} className="flex gap-1 mt-1 text-[10px] text-gray-400"><AlertTriangle className="h-3 w-3 text-amber-400 flex-shrink-0" />{c}</div>
              ))}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, DollarSign } from "lucide-react";

const STATES = [
  { value: "NY", label: "New York" },
  { value: "NJ", label: "New Jersey" },
  { value: "CT", label: "Connecticut" },
  { value: "PA", label: "Pennsylvania" },
  { value: "FL", label: "Florida" },
  { value: "CA", label: "California" },
  { value: "TX", label: "Texas" },
];

const NY_COUNTIES = [
  "New York (Manhattan)", "Kings (Brooklyn)", "Queens", "Bronx", "Richmond (Staten Island)",
  "Nassau", "Suffolk", "Westchester", "Rockland", "Orange", "Putnam", "Dutchess",
];

const PROPERTY_TYPES = [
  { value: "RESIDENTIAL", label: "Residential (1-3 Family)" },
  { value: "CONDO", label: "Condominium" },
  { value: "COOP", label: "Co-op" },
  { value: "COMMERCIAL", label: "Commercial" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function calculateNYTaxes(salePrice: number, county: string, propertyType: string, mortgageAmount: number) {
  const isNYC = ["New York (Manhattan)", "Kings (Brooklyn)", "Queens", "Bronx", "Richmond (Staten Island)"].includes(county);

  // NYS Transfer Tax: $2 per $500 (0.4%)
  let transferTax = salePrice * 0.004;

  // NYC additional transfer tax
  if (isNYC) {
    if (salePrice <= 500000) {
      transferTax += salePrice * 0.01;
    } else {
      transferTax += salePrice * 0.01425;
    }
  }

  // Mansion Tax: 1% on sales >= $1M (buyer pays in NY)
  let mansionTax = 0;
  if (salePrice >= 1000000) {
    mansionTax = salePrice * 0.01;
    // Additional mansion tax tiers for NYC
    if (isNYC) {
      if (salePrice >= 25000000) mansionTax = salePrice * 0.0390;
      else if (salePrice >= 20000000) mansionTax = salePrice * 0.0365;
      else if (salePrice >= 15000000) mansionTax = salePrice * 0.0340;
      else if (salePrice >= 10000000) mansionTax = salePrice * 0.0315;
      else if (salePrice >= 5000000) mansionTax = salePrice * 0.0225;
      else if (salePrice >= 3000000) mansionTax = salePrice * 0.0175;
      else if (salePrice >= 2000000) mansionTax = salePrice * 0.0125;
    }
  }

  // Mortgage Recording Tax
  let mortgageTax = 0;
  if (mortgageAmount > 0) {
    // NYS: 0.5% on first $500K, 0.25% on remainder
    if (propertyType === "RESIDENTIAL" || propertyType === "CONDO") {
      const base = Math.min(mortgageAmount, 500000);
      const excess = Math.max(mortgageAmount - 500000, 0);
      mortgageTax = base * 0.005 + excess * 0.0025;
    } else {
      mortgageTax = mortgageAmount * 0.005;
    }
    // NYC additional mortgage tax
    if (isNYC) {
      if (mortgageAmount >= 500000) {
        mortgageTax += mortgageAmount * 0.0125;
      } else {
        mortgageTax += mortgageAmount * 0.01;
      }
    }
  }

  return { transferTax, mansionTax, mortgageTax };
}

export default function TaxCalculatorPage() {
  const [salePrice, setSalePrice] = useState("");
  const [state, setState] = useState("NY");
  const [county, setCounty] = useState("New York (Manhattan)");
  const [propertyType, setPropertyType] = useState("RESIDENTIAL");
  const [mortgageAmount, setMortgageAmount] = useState("");

  const price = parseFloat(salePrice) || 0;
  const mortgage = parseFloat(mortgageAmount) || 0;

  const results = useMemo(() => {
    if (price <= 0) return null;

    if (state === "NY") {
      const { transferTax, mansionTax, mortgageTax } = calculateNYTaxes(price, county, propertyType, mortgage);
      return { transferTax, mansionTax, mortgageTax, total: transferTax + mansionTax + mortgageTax };
    }

    // Simplified calculations for other states
    const transferTax = price * 0.004;
    const mansionTax = 0;
    const mortgageTax = mortgage * 0.005;
    return { transferTax, mansionTax, mortgageTax, total: transferTax + mansionTax + mortgageTax };
  }, [price, state, county, propertyType, mortgage]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Calculator className="h-8 w-8" /> Transfer Tax Calculator
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Sale Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  className="pl-9"
                  placeholder="0.00"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state === "NY" && (
              <div>
                <Label>County</Label>
                <Select value={county} onValueChange={setCounty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NY_COUNTIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Property Type</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mortgage Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  className="pl-9"
                  placeholder="0.00"
                  value={mortgageAmount}
                  onChange={(e) => setMortgageAmount(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax Estimates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!results ? (
              <p className="text-sm text-muted-foreground">Enter a sale price to calculate taxes.</p>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">Transfer Tax</p>
                      <p className="text-xs text-muted-foreground">
                        {state === "NY" ? "NYS + NYC transfer tax" : "State transfer tax"}
                      </p>
                    </div>
                    <span className="font-mono text-lg">{fmt(results.transferTax)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">Mansion Tax</p>
                      <p className="text-xs text-muted-foreground">
                        {price >= 1000000 ? "Applies (sale >= $1M)" : "Does not apply (sale < $1M)"}
                      </p>
                    </div>
                    <span className="font-mono text-lg">{fmt(results.mansionTax)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">Mortgage Recording Tax</p>
                      <p className="text-xs text-muted-foreground">
                        {mortgage > 0 ? "Based on mortgage amount" : "No mortgage entered"}
                      </p>
                    </div>
                    <span className="font-mono text-lg">{fmt(results.mortgageTax)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border-2 border-primary p-4">
                  <p className="text-lg font-bold">Total Estimated Taxes</p>
                  <span className="font-mono text-2xl font-bold">{fmt(results.total)}</span>
                </div>

                {state === "NY" && (
                  <p className="text-xs text-muted-foreground">
                    Estimates based on current NY tax rates. NYC rates apply to properties in Manhattan,
                    Brooklyn, Queens, Bronx, and Staten Island. Actual amounts may vary. Consult with a
                    tax professional for precise calculations.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

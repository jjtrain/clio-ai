"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

type Field = {
  id: string; label: string; fieldType: string; placeholder?: string;
  helpText?: string; isRequired?: boolean; options?: string;
};
type Section = { title: string; fields: Field[] };
type FormConfig = {
  name: string; headerText?: string; firmName?: string; firmLogo?: string;
  brandColor?: string; sections: Section[]; requiresPassword?: boolean;
  legalText?: string; confirmationMessage?: string;
};

function FieldInput({ field, value, onChange, error }: {
  field: Field; value: any; onChange: (v: any) => void; error?: string;
}) {
  const base = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition
    ${error ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`;
  const opts: string[] = field.options ? JSON.parse(field.options) : [];

  switch (field.fieldType.toLowerCase()) {
    case "textarea":
      return <textarea className={base} rows={4} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />;
    case "select":
      return (
        <select className={base} value={value || ""} onChange={e => onChange(e.target.value)}>
          <option value="">{field.placeholder || "Select..."}</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          {field.placeholder || "Yes"}
        </label>
      );
    case "radio":
      return (
        <div className="space-y-2">
          {opts.map(o => (
            <label key={o} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="radio" name={field.id} value={o} checked={value === o}
                onChange={() => onChange(o)} className="h-4 w-4 text-blue-600 focus:ring-blue-500" />
              {o}
            </label>
          ))}
        </div>
      );
    case "number":
      return <input type="number" className={base} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />;
    default:
      return <input type={field.fieldType.toLowerCase() === "email" ? "email" : field.fieldType.toLowerCase() === "phone" ? "tel" : field.fieldType.toLowerCase() === "date" ? "date" : "text"}
        className={base} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />;
  }
}

export default function PublicIntakeFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [pwError, setPwError] = useState("");
  const [section, setSection] = useState(0);
  const [data, setData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/intake/${slug}`).then(r => r.ok ? r.json() : Promise.reject("not found"))
      .then(d => { setConfig(d); setLoading(false); })
      .catch(() => { setError("This form is no longer available."); setLoading(false); });
  }, [slug]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );
  if (error || !config) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 font-[system-ui,sans-serif]">
      <svg className="h-14 w-14 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Form Not Available</h1>
      <p className="text-gray-500 text-center">{error || "This intake form is no longer accepting submissions."}</p>
    </div>
  );

  const brand = config.brandColor || "#3b82f6";
  const sections = config.sections?.length ? config.sections : [{ title: "", fields: [] }];
  const totalSections = sections.length;
  const currentFields = sections[section]?.fields || [];
  const isLast = section === totalSections - 1;

  const validateSection = (): boolean => {
    const next: Record<string, string> = {};
    for (const f of currentFields) {
      if (f.isRequired) {
        const v = data[f.id];
        if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) next[f.id] = `${f.label} is required`;
      }
      if (f.fieldType.toLowerCase() === "email" && data[f.id] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[f.id])) next[f.id] = "Invalid email";
      if (f.fieldType.toLowerCase() === "phone" && data[f.id] && !/^[+]?[(]?\d{1,4}[)]?[-\s./\d]*$/.test(data[f.id])) next[f.id] = "Invalid phone number";
    }
    setErrors(next);
    return !Object.keys(next).length;
  };

  const handleNext = () => { if (validateSection()) setSection(s => s + 1); };
  const handleBack = () => setSection(s => s - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSection()) return;
    if (isLast && config.legalText && !consent) { setErrors({ _consent: "You must agree to continue." }); return; }
    if (!isLast) { handleNext(); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/intake/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responses: data, referrer: document.referrer || undefined }) });
      if (!res.ok) throw new Error((await res.json()).message || "Submission failed");
      setSubmitted(true);
    } catch (err: any) { setErrors({ _form: err.message }); }
    finally { setSubmitting(false); }
  };

  // Password gate
  if (config.requiresPassword && !authenticated) return (
    <div className="flex items-center justify-center min-h-screen px-4 font-[system-ui,sans-serif]">
      <div className="w-full max-w-sm">
        {config.firmLogo && <img src={config.firmLogo} alt="" className="h-10 mx-auto mb-6" />}
        <h1 className="text-lg font-semibold text-gray-900 text-center mb-1">{config.name}</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Enter the password to access this form.</p>
        {pwError && <p className="text-sm text-red-600 text-center mb-3">{pwError}</p>}
        <input type="password" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm mb-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { fetch(`/api/intake/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }).then(r => r.ok ? setAuthenticated(true) : setPwError("Incorrect password")); } }} />
        <button onClick={() => { fetch(`/api/intake/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }).then(r => r.ok ? setAuthenticated(true) : setPwError("Incorrect password")); }}
          className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition" style={{ background: brand }}>Continue</button>
      </div>
    </div>
  );

  // Confirmation
  if (submitted) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 font-[system-ui,sans-serif]">
      <svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke={brand}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <h1 className="text-2xl font-semibold text-gray-900 mb-3">Submission Received</h1>
      <p className="text-gray-600 text-center max-w-md">{config.confirmationMessage || "Thank you. We've received your information and will be in touch soon."}</p>
    </div>
  );

  return (
    <div className="min-h-screen py-8 sm:py-12 px-4 font-[system-ui,sans-serif]">
      <div className="max-w-2xl mx-auto">
        {/* Branding */}
        <div className="text-center mb-8">
          {config.firmLogo && <img src={config.firmLogo} alt="" className="h-10 mx-auto mb-4" />}
          {config.firmName && <p className="text-sm font-medium mb-1" style={{ color: brand }}>{config.firmName}</p>}
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">{config.name}</h1>
          {config.headerText && <p className="text-gray-600 max-w-lg mx-auto text-sm">{config.headerText}</p>}
        </div>

        {/* Progress */}
        {totalSections > 1 && (
          <div className="mb-6">
            <p className="text-xs text-gray-500 mb-2 text-center">Section {section + 1} of {totalSections}{sections[section]?.title ? ` \u2014 ${sections[section].title}` : ""}</p>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${((section + 1) / totalSections) * 100}%`, background: brand }} />
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-5">
          {sections[section]?.title && <h2 className="text-lg font-semibold text-gray-900">{sections[section].title}</h2>}
          {errors._form && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{errors._form}</div>}

          {currentFields.map(f => (
            <div key={f.id} className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                {f.label}{f.isRequired && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <FieldInput field={f} value={data[f.id]} onChange={v => setData(prev => ({ ...prev, [f.id]: v }))} error={errors[f.id]} />
              {f.helpText && <p className="text-xs text-gray-500">{f.helpText}</p>}
              {errors[f.id] && <p className="text-xs text-red-600">{errors[f.id]}</p>}
            </div>
          ))}

          {/* Legal consent on last section */}
          {isLast && config.legalText && (
            <div className="border-t pt-4 mt-2">
              <p className="text-xs text-gray-600 mb-3 leading-relaxed">{config.legalText}</p>
              <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setErrors(prev => { const { _consent, ...rest } = prev; return rest; }); }}
                  className="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                I have read and agree to the above.
              </label>
              {errors._consent && <p className="text-xs text-red-600 mt-1">{errors._consent}</p>}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            {section > 0 && <button type="button" onClick={handleBack} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Back</button>}
            <button type="submit" disabled={submitting}
              className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
              style={{ background: brand }}>
              {submitting ? "Submitting..." : isLast ? "Submit" : "Continue"}
            </button>
          </div>

          {isLast && <p className="text-xs text-gray-400 text-center">Your information is kept confidential and secure.</p>}
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">Powered by {config.firmName || "Clio"}</p>
      </div>
    </div>
  );
}

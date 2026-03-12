"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, AlertCircle } from "lucide-react";

function IntakeField({
  field,
  value,
  onChange,
  error,
}: {
  field: any;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}) {
  const baseInputClass = `bg-white ${error ? "border-red-300 focus:ring-red-500" : "border-gray-300"}`;

  switch (field.fieldType) {
    case "TEXT":
      return (
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ""}
          className={baseInputClass}
        />
      );
    case "TEXTAREA":
      return (
        <Textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ""}
          className={baseInputClass}
          rows={4}
        />
      );
    case "EMAIL":
      return (
        <Input
          type="email"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ""}
          className={baseInputClass}
        />
      );
    case "PHONE":
      return (
        <Input
          type="tel"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ""}
          className={baseInputClass}
        />
      );
    case "DATE":
      return (
        <Input
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClass}
        />
      );
    case "CHECKBOX":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={!!value}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <span className="text-sm text-gray-600">{field.placeholder || "Yes"}</span>
        </div>
      );
    case "SELECT": {
      const options = field.options ? JSON.parse(field.options) : [];
      return (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger className={baseInputClass}>
            <SelectValue placeholder={field.placeholder || "Select an option"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt: string) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "MULTISELECT": {
      const options = field.options ? JSON.parse(field.options) : [];
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {options.map((opt: string) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={selected.includes(opt)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selected, opt]);
                  } else {
                    onChange(selected.filter((s) => s !== opt));
                  }
                }}
              />
              <span className="text-sm text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      );
    }
    case "FILE":
      return (
        <Input
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => onChange(reader.result);
              reader.readAsDataURL(file);
            }
          }}
          className={baseInputClass}
        />
      );
    default:
      return (
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClass}
        />
      );
  }
}

export default function PublicIntakeFormPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmationMsg, setConfirmationMsg] = useState("");

  const { data: form, isLoading } = trpc.intakeForms.getPublicForm.useQuery({
    slug,
  });

  const submitMutation = trpc.intakeForms.submitForm.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setConfirmationMsg(data.confirmationMsg);
    },
    onError: (err) => {
      setErrors({ _form: err.message });
    },
  });

  const validate = (): boolean => {
    if (!form) return false;
    const newErrors: Record<string, string> = {};

    for (const field of form.fields) {
      if (field.isRequired) {
        const value = formData[field.id];
        if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
          newErrors[field.id] = `${field.label} is required`;
        }
      }
      // Email validation
      if (field.fieldType === "EMAIL" && formData[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData[field.id])) {
          newErrors[field.id] = "Please enter a valid email address";
        }
      }
      // Phone validation
      if (field.fieldType === "PHONE" && formData[field.id]) {
        const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
        if (!phoneRegex.test(formData[field.id])) {
          newErrors[field.id] = "Please enter a valid phone number";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    submitMutation.mutate({
      slug,
      data: formData,
      referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <AlertCircle className="h-16 w-16 text-gray-300 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Form Not Available
        </h1>
        <p className="text-gray-500 text-center">
          This intake form is no longer accepting submissions.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="max-w-md w-full text-center">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">
            Submission Received
          </h1>
          <p className="text-gray-600">{confirmationMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 sm:py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-blue-600 mb-1">
            {form.firmName}
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
            {form.name}
          </h1>
          {form.headerText && (
            <p className="text-gray-600 max-w-lg mx-auto">{form.headerText}</p>
          )}
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6"
        >
          {errors._form && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {errors._form}
            </div>
          )}

          {form.fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                {field.label}
                {field.isRequired && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </Label>
              <IntakeField
                field={field}
                value={formData[field.id]}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, [field.id]: value }))
                }
                error={errors[field.id]}
              />
              {field.helpText && (
                <p className="text-xs text-gray-500">{field.helpText}</p>
              )}
              {errors[field.id] && (
                <p className="text-xs text-red-600">{errors[field.id]}</p>
              )}
            </div>
          ))}

          <Button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 py-3 text-base"
            disabled={submitMutation.isLoading}
          >
            {submitMutation.isLoading ? "Submitting..." : "Submit"}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            Your information is kept confidential and secure.
          </p>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by {form.firmName}
        </p>
      </div>
    </div>
  );
}

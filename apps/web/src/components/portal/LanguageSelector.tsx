"use client";

import { useState } from "react";
import { Globe, Check } from "lucide-react";
import { useTranslation } from "./PortalTranslationProvider";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const LANGUAGE_PROMPTS: Record<string, { question: string; yes: string }> = {
  es: { question: "¿Prefiere ver este portal en español?", yes: "Sí, en español" },
  zh: { question: "您是否希望以中文查看此门户网站?", yes: "是的，中文" },
  ru: { question: "Хотите просмотреть этот портал на русском языке?", yes: "Да, на русском" },
  ht: { question: "Èske ou prefere wè pòtay sa a an Kreyòl Ayisyen?", yes: "Wi, an Kreyòl" },
  ko: { question: "이 포털을 한국어로 보시겠습니까?", yes: "네, 한국어로" },
  ar: { question: "هل تفضل مشاهدة هذه البوابة باللغة العربية؟", yes: "نعم، بالعربية" },
  pt: { question: "Prefere ver este portal em português?", yes: "Sim, em português" },
  fr: { question: "Préférez-vous voir ce portail en français?", yes: "Oui, en français" },
};

export function LanguageSelector({ variant = "header" }: { variant?: "header" | "login" | "settings" }) {
  const { currentLanguage, setLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { data: languages } = trpc.translation.getLanguages.useQuery();

  const activeLanguages = languages?.filter((l) => l.isActive) || [];

  if (variant === "header") {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs font-medium">
            {activeLanguages.find((l) => l.languageCode === currentLanguage)?.nativeName || "English"}
          </span>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border z-50 py-1 min-w-[180px]">
              <button
                onClick={() => { setLanguage("en"); setIsOpen(false); }}
                className={cn("flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-gray-50", currentLanguage === "en" && "font-medium text-blue-600")}
              >
                <span>English</span>
                {currentLanguage === "en" && <Check className="h-3.5 w-3.5" />}
              </button>
              {activeLanguages.map((lang) => (
                <button
                  key={lang.languageCode}
                  onClick={() => { setLanguage(lang.languageCode); setIsOpen(false); }}
                  className={cn("flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-gray-50", currentLanguage === lang.languageCode && "font-medium text-blue-600")}
                >
                  <span>{lang.nativeName}</span>
                  {currentLanguage === lang.languageCode && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}

export function LanguageDetectionBanner({ detectedLanguage, onAccept, onDismiss }: {
  detectedLanguage: string;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const prompt = LANGUAGE_PROMPTS[detectedLanguage];
  if (!prompt) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-center">
      <p className="text-sm font-medium text-blue-900 mb-2">{prompt.question}</p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={onAccept} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          {prompt.yes}
        </button>
        <button onClick={onDismiss} className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800">
          No, English
        </button>
      </div>
    </div>
  );
}

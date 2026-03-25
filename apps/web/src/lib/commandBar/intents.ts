export type IntentType = "log_time" | "open_matter" | "create_matter" | "create_invoice" | "answer_question" | "navigate" | "search";

export interface ParsedIntent {
  type: IntentType;
  confidence: number;
  params: Record<string, string>;
  displayLabel: string;
}

const VERB_PATTERNS: Array<{ pattern: RegExp; intent: IntentType; label: string }> = [
  { pattern: /^(log|track|add|enter)\s+(time|hours|entry)/i, intent: "log_time", label: "Log time entry" },
  { pattern: /^(open|go\s+to|show|view)\s+(matter|case)\s+(.+)/i, intent: "open_matter", label: "Open matter" },
  { pattern: /^(create|new|add|start)\s+(matter|case)/i, intent: "create_matter", label: "Create new matter" },
  { pattern: /^(create|send|generate|new)\s+(invoice|bill)/i, intent: "create_invoice", label: "Create invoice" },
  { pattern: /^(what|who|when|where|how|why|show\s+me|find|list|get)/i, intent: "answer_question", label: "Ask AI" },
];

export function detectIntent(input: string): ParsedIntent | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Slash commands
  if (trimmed.startsWith("/")) return null; // handled separately

  // Verb detection
  for (const { pattern, intent, label } of VERB_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return { type: intent, confidence: 0.9, params: { raw: trimmed, match: match[0] }, displayLabel: label };
  }

  // If >3 words, likely AI question
  if (trimmed.split(/\s+/).length > 3) {
    return { type: "answer_question", confidence: 0.6, params: { raw: trimmed }, displayLabel: "Ask AI" };
  }

  return null;
}

export type InputMode = "search" | "ai" | "slash";

export function detectMode(input: string): InputMode {
  if (input.startsWith("/")) return "slash";
  const intent = detectIntent(input);
  if (intent && intent.confidence > 0.5) return "ai";
  return "search";
}

export const SLASH_COMMANDS = [
  { command: "/time", label: "Log time entry", description: "Open time entry form", href: "/time" },
  { command: "/matter", label: "New matter", description: "Create a new matter", href: "/matters" },
  { command: "/invoice", label: "New invoice", description: "Create an invoice", href: "/invoicing" },
  { command: "/client", label: "New client", description: "Add a new client", href: "/clients" },
  { command: "/search", label: "Search", description: "Search the full app", href: "/search" },
  { command: "/calendar", label: "Calendar", description: "Open calendar view", href: "/calendar" },
  { command: "/tasks", label: "Tasks", description: "View all tasks", href: "/tasks" },
  { command: "/settings", label: "Settings", description: "Open settings", href: "/settings" },
];

export const QUICK_ACTIONS = [
  { label: "Log time", description: "Track billable hours", href: "/time", icon: "Clock" },
  { label: "New matter", description: "Open a new case", href: "/matters", icon: "Briefcase" },
  { label: "New invoice", description: "Bill a client", href: "/invoicing", icon: "FileText" },
  { label: "New client", description: "Add contact", href: "/clients", icon: "Users" },
];

const RECENT_KEY = "managal_recent_items";
const MAX_RECENT = 10;

export function getRecentItems(): Array<{ label: string; href: string; type: string }> {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}

export function addRecentItem(item: { label: string; href: string; type: string }) {
  if (typeof window === "undefined") return;
  const recent = getRecentItems().filter((r) => r.href !== item.href);
  recent.unshift(item);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

import { DEFAULT_SETTINGS } from "./constants";
import type { CategoryRules, DailySummary, SessionRecord, Settings } from "./types";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getTodayKey(now = Date.now()): string {
  return toLocalDateKey(new Date(now));
}

export function getDateKey(timestamp: number): string {
  return toLocalDateKey(new Date(timestamp));
}

export function parseDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeDomain(url: string): string {
  return parseDomain(url) ?? "";
}

export function shouldTrackUrl(url: string, settings: Settings = DEFAULT_SETTINGS): boolean {
  if (!url) {
    return false;
  }

  const lowerUrl = url.toLowerCase();
  if (settings.excludedUrlPrefixes.some((prefix) => lowerUrl.startsWith(prefix.toLowerCase()))) {
    return false;
  }

  if (lowerUrl === "about:blank") {
    return false;
  }

  const domain = parseDomain(url);
  if (!domain) {
    return false;
  }

  if (domain === "newtab" || domain === "new-tab-page" || domain === "chrome") {
    return false;
  }

  if (settings.excludedDomains.map((entry) => entry.toLowerCase()).includes(domain)) {
    return false;
  }

  return true;
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${safeSeconds}s`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  const abs = Math.abs(value);
  const rounded = abs >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

export function getCategoryForDomain(domain: string, categoryRules: CategoryRules): string {
  const lowered = domain.toLowerCase();

  if (categoryRules[lowered]) {
    return categoryRules[lowered];
  }

  const parts = lowered.split(".");
  if (parts.length > 2) {
    const base = parts.slice(parts.length - 2).join(".");
    if (categoryRules[base]) {
      return categoryRules[base];
    }
  }

  return "Other";
}

export function getPastDateKeys(days: number, from = Date.now()): string[] {
  const keys: string[] = [];
  const base = new Date(from);
  base.setHours(12, 0, 0, 0);

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(base);
    date.setDate(base.getDate() - i);
    keys.push(toLocalDateKey(date));
  }

  return keys;
}

export function getPast7DaysData(dailySummariesByDate: Record<string, DailySummary>, now = Date.now()) {
  return getPastDateKeys(7, now).map((key) => ({
    key,
    totalSeconds: dailySummariesByDate[key]?.totalSeconds ?? 0
  }));
}

export function getTopDomainsForDate(
  dailySummariesByDate: Record<string, DailySummary>,
  dateKey: string,
  limit = 5
) {
  const domains = dailySummariesByDate[dateKey]?.domains ?? {};
  return Object.entries(domains)
    .sort(([, a], [, b]) => b.seconds - a.seconds)
    .slice(0, limit)
    .map(([domain, data]) => ({ domain, ...data }));
}

export function summarizeRangeSessions(sessions: SessionRecord[]) {
  const totalSeconds = sessions.reduce((sum, item) => sum + item.durationSeconds, 0);
  const totalSessions = sessions.length;
  return { totalSeconds, totalSessions };
}

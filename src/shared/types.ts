export type IdleState = "active" | "idle" | "locked";

export interface Settings {
  trackFullUrl: boolean;
  idleThresholdSeconds: number;
  excludedDomains: string[];
  excludedUrlPrefixes: string[];
  onboardingSeen: boolean;
  historySyncDays: number;
}

export interface CurrentSession {
  domain: string;
  url?: string;
  startTime: number;
  tabId: number;
  windowId: number;
}

export interface SessionRecord {
  domain: string;
  url?: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  tabId: number;
  windowId: number;
  dateKey: string;
  category: string;
}

export interface DomainSummary {
  seconds: number;
  sessions: number;
  category: string;
}

export interface DailySummary {
  totalSeconds: number;
  totalSessions: number;
  topDomain: string;
  topCategory: string;
  longestSessionSeconds: number;
  domains: Record<string, DomainSummary>;
  categories: Record<string, number>;
  hourly: number[];
}

export type DailySummariesByDate = Record<string, DailySummary>;

export type CategoryRules = Record<string, string>;

export interface StorageShape {
  settings: Settings;
  currentSession: CurrentSession | null;
  dailySummariesByDate: DailySummariesByDate;
  recentSessions: SessionRecord[];
  categoryRules: CategoryRules;
  backfillMeta: BackfillMeta;
}

export type BreakdownRange = "today" | "yesterday" | "last7";

export interface BackfillMeta {
  lastRunAt: number | null;
  lastRangeDays: number | null;
  lastImportedSessions: number;
  lastImportedSeconds: number;
}

import type { CategoryRules, DailySummary, Settings } from "./types";

export const STORAGE_KEYS = {
  settings: "settings",
  currentSession: "currentSession",
  dailySummariesByDate: "dailySummariesByDate",
  recentSessions: "recentSessions",
  categoryRules: "categoryRules",
  backfillMeta: "backfillMeta"
} as const;

export const RECENT_SESSIONS_LIMIT = 500;
export const RECENT_SESSIONS_MAX_AGE_DAYS = 30;

export const DEFAULT_SETTINGS: Settings = {
  trackFullUrl: false,
  idleThresholdSeconds: 60,
  excludedDomains: [],
  onboardingSeen: false,
  historySyncDays: 14,
  excludedUrlPrefixes: [
    "chrome://",
    "chrome-extension://",
    "about:",
    "edge://",
    "brave://",
    "devtools://",
    "view-source:"
  ]
};

export const CATEGORY_ORDER = [
  "Productivity",
  "Social",
  "Video",
  "News",
  "Learning",
  "Shopping",
  "Messaging",
  "Developer Tools",
  "Finance",
  "Other"
] as const;

export const DEFAULT_CATEGORY_RULES: CategoryRules = {
  "youtube.com": "Video",
  "youtu.be": "Video",
  "github.com": "Developer Tools",
  "stackoverflow.com": "Developer Tools",
  "linkedin.com": "Social",
  "x.com": "Social",
  "twitter.com": "Social",
  "reddit.com": "Social",
  "docs.google.com": "Productivity",
  "drive.google.com": "Productivity",
  "chat.openai.com": "Productivity",
  "udemy.com": "Learning",
  "coursera.org": "Learning",
  "khanacademy.org": "Learning",
  "amazon.com": "Shopping",
  "walmart.com": "Shopping",
  "news.ycombinator.com": "News",
  "nytimes.com": "News",
  "bbc.com": "News",
  "whatsapp.com": "Messaging",
  "discord.com": "Messaging",
  "slack.com": "Messaging",
  "notion.so": "Productivity",
  "gmail.com": "Productivity",
  "google.com": "Productivity",
  "bankofamerica.com": "Finance",
  "chase.com": "Finance"
};

export const DEFAULT_BACKFILL_META = {
  lastRunAt: null,
  lastRangeDays: null,
  lastImportedSessions: 0,
  lastImportedSeconds: 0
} as const;

export function createEmptyDailySummary(): DailySummary {
  return {
    totalSeconds: 0,
    totalSessions: 0,
    topDomain: "",
    topCategory: "Other",
    longestSessionSeconds: 0,
    domains: {},
    categories: {},
    hourly: new Array(24).fill(0)
  };
}

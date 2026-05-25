import {
  DEFAULT_BACKFILL_META,
  DEFAULT_CATEGORY_RULES,
  DEFAULT_SETTINGS,
  RECENT_SESSIONS_LIMIT,
  RECENT_SESSIONS_MAX_AGE_DAYS,
  STORAGE_KEYS,
  createEmptyDailySummary
} from "../shared/constants";
import { getDateKey } from "../shared/utils";
import type { DailySummary, SessionRecord, StorageShape } from "../shared/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getStorageState(): Promise<StorageShape> {
  const raw = await chrome.storage.local.get(Object.values(STORAGE_KEYS));

  return {
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    currentSession: raw.currentSession ?? null,
    dailySummariesByDate: raw.dailySummariesByDate ?? {},
    recentSessions: raw.recentSessions ?? [],
    categoryRules: { ...DEFAULT_CATEGORY_RULES, ...(raw.categoryRules ?? {}) },
    backfillMeta: { ...DEFAULT_BACKFILL_META, ...(raw.backfillMeta ?? {}) }
  };
}

export async function saveStorageState(patch: Partial<StorageShape>): Promise<void> {
  await chrome.storage.local.set(patch);
}

export function aggregateSessionIntoDailySummary(
  base: DailySummary | undefined,
  session: SessionRecord
): DailySummary {
  const next = base ? structuredClone(base) : createEmptyDailySummary();

  next.totalSeconds += session.durationSeconds;
  next.totalSessions += 1;
  next.longestSessionSeconds = Math.max(next.longestSessionSeconds, session.durationSeconds);

  const domainSummary = next.domains[session.domain] ?? {
    seconds: 0,
    sessions: 0,
    category: session.category
  };

  domainSummary.seconds += session.durationSeconds;
  domainSummary.sessions += 1;
  domainSummary.category = session.category;
  next.domains[session.domain] = domainSummary;

  next.categories[session.category] = (next.categories[session.category] ?? 0) + session.durationSeconds;
  next.hourly = mergeHourly(next.hourly, session.startTime, session.endTime);

  const topDomainEntry = Object.entries(next.domains).sort(([, a], [, b]) => b.seconds - a.seconds)[0];
  next.topDomain = topDomainEntry?.[0] ?? "";

  const topCategoryEntry = Object.entries(next.categories).sort(([, a], [, b]) => b - a)[0];
  next.topCategory = topCategoryEntry?.[0] ?? "Other";

  return next;
}

function mergeHourly(existing: number[], start: number, end: number): number[] {
  const hourly = existing.length === 24 ? [...existing] : new Array(24).fill(0);
  let cursor = start;

  while (cursor < end) {
    const current = new Date(cursor);
    const hour = current.getHours();
    const hourEnd = new Date(current);
    hourEnd.setMinutes(59, 59, 999);

    const sliceEnd = Math.min(end, hourEnd.getTime() + 1);
    const seconds = Math.max(0, Math.floor((sliceEnd - cursor) / 1000));
    hourly[hour] += seconds;

    cursor = sliceEnd;
  }

  return hourly;
}

export async function appendRecentSession(session: SessionRecord): Promise<void> {
  const state = await getStorageState();
  const now = Date.now();
  const minTimestamp = now - RECENT_SESSIONS_MAX_AGE_DAYS * DAY_MS;

  const filtered = state.recentSessions.filter((entry) => entry.endTime >= minTimestamp);
  filtered.push(session);

  const trimmed = filtered.slice(-RECENT_SESSIONS_LIMIT);
  await saveStorageState({ recentSessions: trimmed });
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.set({
    settings: DEFAULT_SETTINGS,
    currentSession: null,
    dailySummariesByDate: {},
    recentSessions: [],
    categoryRules: DEFAULT_CATEGORY_RULES,
    backfillMeta: DEFAULT_BACKFILL_META
  });
}

export function splitSessionAcrossDays(session: SessionRecord): SessionRecord[] {
  const chunks: SessionRecord[] = [];
  let cursor = session.startTime;

  while (cursor < session.endTime) {
    const currentDate = new Date(cursor);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);

    const chunkEnd = Math.min(session.endTime, dayEnd.getTime() + 1);
    const durationSeconds = Math.max(0, Math.floor((chunkEnd - cursor) / 1000));

    if (durationSeconds > 0) {
      chunks.push({
        ...session,
        startTime: cursor,
        endTime: chunkEnd,
        durationSeconds,
        dateKey: getDateKey(cursor)
      });
    }

    cursor = chunkEnd;
  }

  return chunks;
}

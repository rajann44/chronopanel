import { DEFAULT_SETTINGS, createEmptyDailySummary } from "../shared/constants";
import { getCategoryForDomain, getDateKey, getPastDateKeys, normalizeDomain, shouldTrackUrl } from "../shared/utils";
import type { SessionRecord } from "../shared/types";
import {
  aggregateSessionIntoDailySummary,
  clearAllData,
  getStorageState,
  saveStorageState,
  splitSessionAcrossDays
} from "./storage";

const MAX_HISTORY_ITEMS = 2000;
const MIN_SESSION_SECONDS = 5;
const DEFAULT_SESSION_SECONDS = 45;
const MAX_SESSION_SECONDS = 10 * 60;

function clampDays(days: number): number {
  if (!Number.isFinite(days)) {
    return 14;
  }
  return Math.max(1, Math.min(30, Math.floor(days)));
}

async function collectHistoryEvents(startTime: number) {
  const state = await getStorageState();
  const historyItems = await chrome.history.search({ text: "", startTime, maxResults: MAX_HISTORY_ITEMS });
  const events: Array<{ visitTime: number; url: string }> = [];
  const seen = new Set<string>();

  for (const item of historyItems) {
    if (!item.url || !shouldTrackUrl(item.url, state.settings)) {
      continue;
    }

    let visits: chrome.history.VisitItem[] = [];
    try {
      visits = await chrome.history.getVisits({ url: item.url });
    } catch {
      continue;
    }

    for (const visit of visits) {
      if (!visit.visitTime || visit.visitTime < startTime) {
        continue;
      }

      const key = `${item.url}|${visit.visitTime}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      events.push({
        visitTime: visit.visitTime,
        url: item.url
      });
    }
  }

  events.sort((a, b) => a.visitTime - b.visitTime);
  return events;
}

function buildEstimatedSessions(
  events: Array<{ visitTime: number; url: string }>,
  now: number,
  trackFullUrl: boolean
): SessionRecord[] {
  const sessions: SessionRecord[] = [];

  for (let i = 0; i < events.length; i += 1) {
    const current = events[i];
    const next = events[i + 1];

    const rawSeconds = next
      ? Math.floor((next.visitTime - current.visitTime) / 1000)
      : DEFAULT_SESSION_SECONDS;

    if (next && rawSeconds <= 0) {
      continue;
    }

    const durationSeconds = Math.max(MIN_SESSION_SECONDS, Math.min(MAX_SESSION_SECONDS, rawSeconds));

    if (durationSeconds <= 0) {
      continue;
    }

    const endTime = Math.min(now, current.visitTime + durationSeconds * 1000);
    const domain = normalizeDomain(current.url);
    if (!domain) {
      continue;
    }

    sessions.push({
      domain,
      startTime: current.visitTime,
      endTime,
      durationSeconds,
      tabId: -1,
      windowId: -1,
      dateKey: getDateKey(current.visitTime),
      url: trackFullUrl ? current.url : undefined,
      category: "Other"
    });
  }

  return sessions;
}

async function runHistorySync(daysInput?: number) {
  const state = await getStorageState();
  const days = clampDays(daysInput ?? state.settings.historySyncDays ?? 14);
  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  const events = await collectHistoryEvents(startTime);
  const rawSessions = buildEstimatedSessions(events, now, state.settings.trackFullUrl);

  const sessions = rawSessions.map((session) => ({
    ...session,
    category: getCategoryForDomain(session.domain, state.categoryRules)
  }));

  const rangeKeys = new Set(getPastDateKeys(days));
  const summaries = { ...state.dailySummariesByDate };

  for (const key of rangeKeys) {
    delete summaries[key];
  }

  for (const session of sessions) {
    const chunks = splitSessionAcrossDays(session);
    for (const chunk of chunks) {
      if (!rangeKeys.has(chunk.dateKey)) {
        continue;
      }
      summaries[chunk.dateKey] = aggregateSessionIntoDailySummary(summaries[chunk.dateKey], chunk);
    }
  }

  for (const key of rangeKeys) {
    if (!summaries[key]) {
      summaries[key] = createEmptyDailySummary();
    }
  }

  await saveStorageState({
    currentSession: null,
    dailySummariesByDate: summaries,
    recentSessions: sessions.slice(-500),
    backfillMeta: {
      lastRunAt: now,
      lastRangeDays: days,
      lastImportedSessions: sessions.length,
      lastImportedSeconds: sessions.reduce((sum, item) => sum + item.durationSeconds, 0)
    }
  });

  return {
    importedSessions: sessions.length,
    importedSeconds: sessions.reduce((sum, item) => sum + item.durationSeconds, 0),
    scannedEvents: events.length,
    days
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  const state = await getStorageState();
  await saveStorageState({
    settings: {
      ...DEFAULT_SETTINGS,
      ...state.settings
    },
    currentSession: null,
    dailySummariesByDate: state.dailySummariesByDate,
    recentSessions: state.recentSessions,
    categoryRules: state.categoryRules,
    backfillMeta: state.backfillMeta
  });

  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.permissions.contains({ permissions: ["history"] }).then((hasPermission) => {
    if (hasPermission) {
      void runHistorySync();
    }
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId !== undefined) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "settings-updated") {
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "clear-all-data") {
    void (async () => {
      await clearAllData();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "sync-history") {
    void (async () => {
      const contains = await chrome.permissions.contains({ permissions: ["history"] });
      if (!contains) {
        sendResponse({ ok: false, error: "history-permission-missing" });
        return;
      }

      try {
        const result = await runHistorySync(Number(message?.days));
        sendResponse({ ok: true, ...result });
      } catch (err) {
        console.error("History sync failed", err);
        sendResponse({ ok: false, error: "history-sync-failed" });
      }
    })();

    return true;
  }

  return false;
});

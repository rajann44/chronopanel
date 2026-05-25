import { CATEGORY_ORDER, DEFAULT_CATEGORY_RULES, DEFAULT_SETTINGS, STORAGE_KEYS } from "../shared/constants";
import {
  formatDuration,
  formatPercent,
  getPast7DaysData,
  getPastDateKeys,
  getDateKey,
  getTodayKey,
  getTopDomainsForDate
} from "../shared/utils";
import type { BreakdownRange, DailySummary, Settings, StorageShape } from "../shared/types";

const summaryRoot = document.getElementById("summaryView") as HTMLDivElement;
const websitesRoot = document.getElementById("websitesView") as HTMLDivElement;
const settingsRoot = document.getElementById("settingsView") as HTMLDivElement;
const refreshButton = document.getElementById("refreshButton") as HTMLButtonElement;
const dayTitle = document.getElementById("dayTitle") as HTMLHeadingElement | null;

let activeView: "summary" | "websites" | "settings" = "summary";
let websiteRange: BreakdownRange = "today";
let websiteFilter = "";
let selectedDateKey: string | null = null;

const CATEGORY_COLORS: Record<string, string> = {
  Productivity: "var(--cat-productivity)",
  Social: "var(--cat-social)",
  Video: "var(--cat-video)",
  News: "var(--cat-news)",
  Learning: "var(--cat-learning)",
  Shopping: "var(--cat-shopping)",
  Messaging: "var(--cat-messaging)",
  "Developer Tools": "var(--cat-devtools)",
  Finance: "var(--cat-finance)",
  Other: "var(--cat-other)"
};

function switchView(view: typeof activeView) {
  activeView = view;

  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"))) {
    button.classList.toggle("active", button.dataset.view === view);
  }

  summaryRoot.classList.toggle("active", view === "summary");
  websitesRoot.classList.toggle("active", view === "websites");
  settingsRoot.classList.toggle("active", view === "settings");
}

async function loadState(): Promise<StorageShape> {
  const raw = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  return {
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    currentSession: raw.currentSession ?? null,
    dailySummariesByDate: raw.dailySummariesByDate ?? {},
    recentSessions: raw.recentSessions ?? [],
    categoryRules: { ...DEFAULT_CATEGORY_RULES, ...(raw.categoryRules ?? {}) },
    backfillMeta: {
      lastRunAt: raw.backfillMeta?.lastRunAt ?? null,
      lastRangeDays: raw.backfillMeta?.lastRangeDays ?? null,
      lastImportedSessions: raw.backfillMeta?.lastImportedSessions ?? 0,
      lastImportedSeconds: raw.backfillMeta?.lastImportedSeconds ?? 0
    }
  };
}

function getYesterdayKey(from = Date.now()) {
  return getPastDateKeys(2, from)[0];
}

function getPreviousDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() - 1);
  return getDateKey(date.getTime());
}

function calcComparison(todaySeconds: number, yesterdaySeconds: number): string {
  if (yesterdaySeconds <= 0) {
    return "No data from yesterday";
  }

  const pct = ((todaySeconds - yesterdaySeconds) / yesterdaySeconds) * 100;
  return `${formatPercent(pct)} vs yesterday`;
}

function formatHourRange(hour: number): string {
  const start = String(hour).padStart(2, "0");
  const end = String((hour + 1) % 24).padStart(2, "0");
  return `${start}:00-${end}:00`;
}

function formatDateParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  const date = new Date(year, month - 1, day);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const shortDate = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return {
    weekday,
    day,
    shortDate
  };
}

function getWeeklyInsights(state: StorageShape) {
  const keys = getPastDateKeys(7);
  const summaries = keys.map((key) => state.dailySummariesByDate[key]).filter(Boolean) as DailySummary[];

  if (summaries.length === 0) {
    return {
      mostIntentionalHour: "No data yet",
      mostDistractingSite: "No data yet"
    };
  }

  const hourly = new Array(24).fill(0) as number[];
  const domains: Record<string, number> = {};

  for (const summary of summaries) {
    for (let i = 0; i < 24; i += 1) {
      hourly[i] += summary.hourly?.[i] ?? 0;
    }

    for (const [domain, data] of Object.entries(summary.domains)) {
      domains[domain] = (domains[domain] ?? 0) + data.seconds;
    }
  }

  const peakHour = hourly.reduce((best, value, index) => (value > hourly[best] ? index : best), 0);
  const topDomainEntry = Object.entries(domains).sort(([, a], [, b]) => b - a)[0];

  const mostIntentionalHour =
    hourly[peakHour] > 0 ? `${formatHourRange(peakHour)} (${formatDuration(hourly[peakHour])})` : "No data yet";

  const mostDistractingSite =
    topDomainEntry && topDomainEntry[1] > 0
      ? `${topDomainEntry[0]} (${formatDuration(topDomainEntry[1])})`
      : "No data yet";

  return {
    mostIntentionalHour,
    mostDistractingSite
  };
}

function buildCategoryRingGradient(categories: Array<[string, number]>, totalSeconds: number): string {
  if (totalSeconds <= 0 || categories.length === 0) {
    return "conic-gradient(var(--accent-soft) 0 100%)";
  }

  let cursor = 0;
  const slices: string[] = [];

  for (const [name, seconds] of categories) {
    const pct = Math.max(0, (seconds / totalSeconds) * 100);
    if (pct <= 0) {
      continue;
    }

    const color = CATEGORY_COLORS[name] ?? "var(--cat-other)";
    const start = cursor;
    const end = Math.min(100, cursor + pct);
    slices.push(`${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
    cursor = end;
  }

  if (cursor < 100) {
    slices.push(`var(--accent-soft) ${cursor.toFixed(2)}% 100%`);
  }

  return `conic-gradient(${slices.join(",")})`;
}

function renderEmptyState() {
  summaryRoot.innerHTML = `
    <article class="card empty-state">
      <h2>No tracked browsing yet</h2>
      <p class="subtle">Open Settings and run a Chrome history sync to populate your dashboard.</p>
    </article>
  `;
}

function renderSummary(state: StorageShape) {
  const todayKey = getTodayKey();
  const sevenDay = getPast7DaysData(state.dailySummariesByDate);
  const sevenDayKeys = new Set(sevenDay.map((item) => item.key));

  if (!selectedDateKey || !sevenDayKeys.has(selectedDateKey)) {
    selectedDateKey = todayKey;
  }

  const activeDateKey = selectedDateKey;
  const previousDateKey = getPreviousDateKey(activeDateKey);

  const daySummary = state.dailySummariesByDate[activeDateKey];
  const previousSummary = state.dailySummariesByDate[previousDateKey];

  if (!daySummary || daySummary.totalSeconds === 0) {
    renderEmptyState();
    return;
  }

  const maxSeven = Math.max(1, ...sevenDay.map((item) => item.totalSeconds));

  const categories = Object.entries(daySummary.categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const categoriesForRing = Object.entries(daySummary.categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const selectedDayTotal = sevenDay.find((item) => item.key === activeDateKey)?.totalSeconds ?? 0;

  const topSites = getTopDomainsForDate(state.dailySummariesByDate, activeDateKey, 5);
  const hourlyData = daySummary.hourly ?? new Array(24).fill(0);
  const hourlyMax = Math.max(1, ...hourlyData);
  const peakHour = hourlyData.reduce((best, value, index) => (value > hourlyData[best] ? index : best), 0);

  const stats = [
    { label: "Total browsing", value: formatDuration(daySummary.totalSeconds) },
    { label: "Sessions", value: String(daySummary.totalSessions) },
    { label: "Top website", value: daySummary.topDomain || "-" },
    { label: "Top category", value: daySummary.topCategory || "Other" },
    { label: "Longest session", value: formatDuration(daySummary.longestSessionSeconds || 0) }
  ];
  const weeklyInsights = getWeeklyInsights(state);
  const activeDateParts = formatDateParts(activeDateKey);
  const ringGradient = buildCategoryRingGradient(categoriesForRing, daySummary.totalSeconds);
  const comparisonText = calcComparison(daySummary.totalSeconds, previousSummary?.totalSeconds ?? 0);

  if (dayTitle) {
    dayTitle.textContent = activeDateKey === todayKey ? "Today" : activeDateParts.shortDate;
  }

  summaryRoot.innerHTML = `
    ${
      !state.settings.onboardingSeen
        ? `
      <article class="card onboarding-card">
        <div class="inline" style="justify-content:space-between;align-items:flex-start;">
          <div>
            <h2>Welcome to ChronoPanel</h2>
            <p class="subtle" style="margin-top:4px;">
              Sync is local-only and private. Use "Sync now" to estimate usage from your recent Chrome history.
            </p>
          </div>
          <button id="dismissOnboarding" class="ghost-button" type="button">Dismiss</button>
        </div>
      </article>
    `
        : ""
    }

    <article class="card">
      <div class="dw-hero">
        <div class="dw-ring" style="--ring-gradient:${ringGradient};">
          <div class="dw-ring-inner">
            <p class="subtle">Screen time</p>
            <p class="ring-time">${formatDuration(daySummary.totalSeconds)}</p>
            <p class="ring-day">${activeDateParts.shortDate}</p>
          </div>
        </div>
        <div class="dw-meta">
          <p class="subtle ${daySummary.totalSeconds >= (previousSummary?.totalSeconds ?? 0) ? "" : "good"}">${comparisonText}</p>
          <div class="chip-row">
            <div class="stat-chip">
              <span class="subtle">Sessions</span>
              <strong>${daySummary.totalSessions}</strong>
            </div>
            <div class="stat-chip">
              <span class="subtle">Top app/site</span>
              <strong class="truncate">${daySummary.topDomain || "-"}</strong>
            </div>
          </div>
          <div class="legend-row">
            ${categoriesForRing
              .map(([name, seconds]) => {
                const color = CATEGORY_COLORS[name] ?? "var(--cat-other)";
                const pct = daySummary.totalSeconds > 0 ? Math.round((seconds / daySummary.totalSeconds) * 100) : 0;
                return `<span class="legend-pill"><i style="--legend:${color}"></i>${name} ${pct}%</span>`;
              })
              .join("")}
          </div>
        </div>
      </div>
    </article>

    <article class="card">
      <h2>7-day activity</h2>
      <div class="week-bars" role="group" aria-label="Choose a day to view its summary">
        ${sevenDay
          .map((item) => {
            const parts = formatDateParts(item.key);
            const height = Math.max(4, Math.round((item.totalSeconds / maxSeven) * 100));
            const isToday = item.key === todayKey;
            const isSelected = item.key === activeDateKey;
            return `
              <button class="week-col ${isSelected ? "selected" : ""}" data-day-key="${item.key}" type="button" aria-pressed="${isSelected ? "true" : "false"}" aria-label="${parts.shortDate}: ${formatDuration(item.totalSeconds)}" title="${parts.shortDate}: ${formatDuration(item.totalSeconds)}">
                <div class="week-bar-track">
                  <div class="week-bar ${isToday ? "today" : ""}" style="height:${height}%"></div>
                </div>
                <p class="week-label">${parts.weekday}</p>
                <p class="week-date">${parts.day}</p>
              </button>
            `;
          })
          .join("")}
      </div>
      <p class="subtle">Selected day: ${activeDateParts.shortDate} • ${formatDuration(selectedDayTotal)}</p>
    </article>

    <article class="card">
      <h2>Categories</h2>
      <div class="list">
        ${categories
          .map(([name, seconds]) => {
            const width = Math.max(2, Math.round((seconds / daySummary.totalSeconds) * 100));
            const barColor = CATEGORY_COLORS[name] ?? "var(--cat-other)";
            return `
              <div>
                <div class="inline" style="justify-content:space-between">
                  <span>${name}</span>
                  <span class="subtle">${formatDuration(seconds)}</span>
                </div>
                <div class="progress"><span style="width:${width}%; --bar-color:${barColor}"></span></div>
              </div>
            `;
          })
          .join("")}
      </div>
    </article>

    <article class="card">
      <h2>Top websites</h2>
      <div class="list">
        ${topSites
          .map(
            (site) => `
              <div class="row">
                <img class="favicon" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(site.domain)}&sz=32" alt="" />
                <div class="row-domain">
                  <strong>${site.domain}</strong>
                  <span class="subtle">${site.sessions} sessions</span>
                </div>
                <strong>${formatDuration(site.seconds)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </article>

    <article class="card">
      <h2>Time of day</h2>
      <div class="hourly-strip">
        ${hourlyData
          .map((value, hour) => {
            const h = Math.max(2, Math.round((value / hourlyMax) * 100));
            const isPeak = hour === peakHour && value > 0;
            return `<div class="hourly-cell ${isPeak ? "peak" : ""}" style="height:${h}%" title="${formatHourRange(hour)} • ${formatDuration(value)}"></div>`;
          })
          .join("")}
      </div>
      <div class="hourly-axis">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
      <p class="subtle">Peak hour: ${hourlyData[peakHour] > 0 ? `${formatHourRange(peakHour)} • ${formatDuration(hourlyData[peakHour])}` : "No activity"}</p>
    </article>

    <article class="card">
      <h2>Key stats</h2>
      <div class="kv-grid">
        ${stats
          .map(
            (item) => `
              <div class="kv-item">
                <p class="subtle">${item.label}</p>
                <p><strong>${item.value}</strong></p>
              </div>
            `
          )
          .join("")}
      </div>
    </article>

    <article class="card">
      <h2>Weekly insights</h2>
      <div class="kv-grid">
        <div class="kv-item">
          <p class="subtle">Most intentional hour</p>
          <p><strong>${weeklyInsights.mostIntentionalHour}</strong></p>
        </div>
        <div class="kv-item">
          <p class="subtle">Most distracting site</p>
          <p><strong>${weeklyInsights.mostDistractingSite}</strong></p>
        </div>
      </div>
    </article>
  `;

  const dismissButton = document.getElementById("dismissOnboarding") as HTMLButtonElement | null;
  dismissButton?.addEventListener("click", async () => {
    await chrome.storage.local.set({
      settings: {
        ...state.settings,
        onboardingSeen: true
      }
    });
    await render();
  });

  for (const dayButton of Array.from(document.querySelectorAll<HTMLButtonElement>(".week-col"))) {
    dayButton.addEventListener("click", () => {
      selectedDateKey = dayButton.dataset.dayKey ?? todayKey;
      websiteRange = "today";
      void render();
    });
  }
}

function collectRangeSummaries(daily: Record<string, DailySummary>, range: BreakdownRange) {
  const today = selectedDateKey ?? getTodayKey();
  if (range === "today") {
    return [daily[today]].filter(Boolean) as DailySummary[];
  }

  if (range === "yesterday") {
    return [daily[getYesterdayKey()]].filter(Boolean) as DailySummary[];
  }

  const keys = getPastDateKeys(7);
  return keys.map((key) => daily[key]).filter(Boolean) as DailySummary[];
}

function buildWebsiteRows(summaries: DailySummary[]) {
  const combined: Record<string, { seconds: number; sessions: number }> = {};

  for (const day of summaries) {
    for (const [domain, data] of Object.entries(day.domains)) {
      combined[domain] = combined[domain] ?? { seconds: 0, sessions: 0 };
      combined[domain].seconds += data.seconds;
      combined[domain].sessions += data.sessions;
    }
  }

  const rows = Object.entries(combined)
    .map(([domain, data]) => ({ domain, ...data }))
    .sort((a, b) => b.seconds - a.seconds);

  return rows;
}

function renderWebsites(state: StorageShape) {
  const summaries = collectRangeSummaries(state.dailySummariesByDate, websiteRange);
  const rows = buildWebsiteRows(summaries);
  const total = rows.reduce((sum, item) => sum + item.seconds, 0);
  const selectedDayLabel = selectedDateKey ? formatDateParts(selectedDateKey).shortDate : "Today";

  const filtered = rows.filter((row) => row.domain.toLowerCase().includes(websiteFilter.toLowerCase()));

  websitesRoot.innerHTML = `
    <article class="card">
      <div class="inline" style="justify-content:space-between; margin-bottom: 10px;">
        <h2>Website breakdown</h2>
        <select id="rangeSelect">
          <option value="today" ${websiteRange === "today" ? "selected" : ""}>Selected day (${selectedDayLabel})</option>
          <option value="yesterday" ${websiteRange === "yesterday" ? "selected" : ""}>Yesterday</option>
          <option value="last7" ${websiteRange === "last7" ? "selected" : ""}>Last 7 days</option>
        </select>
      </div>
      <div class="field" style="margin-bottom: 8px;">
        <input id="siteFilter" placeholder="Search domains" value="${websiteFilter}" />
      </div>
      <div class="list">
        ${filtered
          .map((row) => {
            const pct = total > 0 ? Math.round((row.seconds / total) * 100) : 0;
            return `
              <div class="row">
                <img class="favicon" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(row.domain)}&sz=32" alt="" />
                <div class="row-domain">
                  <strong>${row.domain}</strong>
                  <span class="subtle">${pct}% · ${row.sessions} sessions</span>
                </div>
                <strong>${formatDuration(row.seconds)}</strong>
              </div>
            `;
          })
          .join("")}
      </div>
      ${filtered.length === 0 ? '<p class="subtle">No websites match this filter.</p>' : ""}
    </article>
  `;

  const rangeSelect = document.getElementById("rangeSelect") as HTMLSelectElement;
  rangeSelect.addEventListener("change", () => {
    websiteRange = rangeSelect.value as BreakdownRange;
    void render();
  });

  const siteFilter = document.getElementById("siteFilter") as HTMLInputElement;
  siteFilter.addEventListener("input", () => {
    websiteFilter = siteFilter.value;
    renderWebsites(state);
  });
}

function renderSettings(state: StorageShape) {
  const settings = state.settings;
  const rulesEntries = Object.entries(state.categoryRules).sort((a, b) => a[0].localeCompare(b[0]));
  const categoryRulesText = rulesEntries.map(([domain, category]) => `${domain}=${category}`).join("\n");
  const backfillTimestamp = state.backfillMeta.lastRunAt
    ? new Date(state.backfillMeta.lastRunAt).toLocaleString()
    : "Never";

  settingsRoot.innerHTML = `
    <article class="card">
      <h2>Settings</h2>
      <div class="form-grid">
        <label class="field">
          <span>History sync window (days)</span>
          <input id="historySyncDays" type="number" min="1" max="30" step="1" value="${settings.historySyncDays}" />
        </label>

        <label class="inline">
          <input id="trackFullUrl" type="checkbox" ${settings.trackFullUrl ? "checked" : ""} />
          <span>Track full URL (off by default for privacy)</span>
        </label>

        <label class="field">
          <span>Excluded domains (comma or new line)</span>
          <textarea id="excludedDomains" rows="4">${settings.excludedDomains.join("\n")}</textarea>
        </label>

        <label class="field">
          <span>Category rules (one per line, domain=Category)</span>
          <textarea id="categoryRules" rows="8">${categoryRulesText}</textarea>
        </label>

        <p class="subtle">Available categories: ${CATEGORY_ORDER.join(", ")}</p>

        <div class="inline">
          <button id="saveSettings" class="button" type="button">Save settings</button>
          <button id="resetCategoryRules" class="ghost-button" type="button">Reset categories</button>
          <button id="exportData" class="ghost-button" type="button">Export JSON</button>
          <button id="importData" class="ghost-button" type="button">Import JSON</button>
        </div>

        <div class="inline">
          <select id="historyBackfillDays">
            <option value="3" ${settings.historySyncDays === 3 ? "selected" : ""}>Sync last 3 days</option>
            <option value="7" ${settings.historySyncDays === 7 ? "selected" : ""}>Sync last 7 days</option>
            <option value="14" ${settings.historySyncDays === 14 ? "selected" : ""}>Sync last 14 days</option>
            <option value="30" ${settings.historySyncDays === 30 ? "selected" : ""}>Sync last 30 days</option>
          </select>
          <button id="runHistoryBackfill" class="ghost-button" type="button">Sync with Chrome history</button>
        </div>

        <p class="subtle">
          Historical sync is an estimate based on Chrome history timestamps and may not match exact foreground dwell time.
          Last sync: ${backfillTimestamp}
          ${
            state.backfillMeta.lastRangeDays
              ? `(range: ${state.backfillMeta.lastRangeDays} days)`
              : ""
          }
          ${
            state.backfillMeta.lastImportedSessions > 0
              ? ` | Imported ${state.backfillMeta.lastImportedSessions} sessions (${formatDuration(state.backfillMeta.lastImportedSeconds)})`
              : ""
          }
        </p>
        <input id="importFile" type="file" accept="application/json" style="display:none" />

        <button id="clearData" class="ghost-button warn" type="button">Clear all tracking data</button>

        <p class="subtle">
          Privacy: this extension stores browsing metadata locally on your device using chrome.storage.local.
          It does not collect page content, form data, passwords, or send data to external servers.
        </p>
      </div>
    </article>

    <article class="card">
      <h2>Category families</h2>
      <p class="subtle">These labels are used for summary grouping.</p>
      <div class="list">
        ${CATEGORY_ORDER.map((name) => `<div class="row"><div class="row-domain"><strong>${name}</strong></div></div>`).join("")}
      </div>
    </article>
  `;

  const saveButton = document.getElementById("saveSettings") as HTMLButtonElement;
  const resetCategoryRulesButton = document.getElementById("resetCategoryRules") as HTMLButtonElement;
  const exportButton = document.getElementById("exportData") as HTMLButtonElement;
  const importButton = document.getElementById("importData") as HTMLButtonElement;
  const runHistoryBackfillButton = document.getElementById("runHistoryBackfill") as HTMLButtonElement;
  const historyBackfillDays = document.getElementById("historyBackfillDays") as HTMLSelectElement;
  const importFileInput = document.getElementById("importFile") as HTMLInputElement;
  const clearButton = document.getElementById("clearData") as HTMLButtonElement;

  saveButton.addEventListener("click", async () => {
    const historySyncDays = Number((document.getElementById("historySyncDays") as HTMLInputElement).value) || 14;
    const trackFullUrl = (document.getElementById("trackFullUrl") as HTMLInputElement).checked;
    const excludedInput = (document.getElementById("excludedDomains") as HTMLTextAreaElement).value;
    const categoryRulesInput = (document.getElementById("categoryRules") as HTMLTextAreaElement).value;

    const excludedDomains = excludedInput
      .split(/[\n,]/g)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    const nextSettings: Settings = {
      ...settings,
      historySyncDays: Math.max(1, Math.min(30, Math.floor(historySyncDays))),
      trackFullUrl,
      excludedDomains
    };

    const nextCategoryRules: Record<string, string> = {};
    for (const rawLine of categoryRulesInput.split("\n")) {
      const line = rawLine.trim();
      if (!line || !line.includes("=")) {
        continue;
      }

      const [left, ...right] = line.split("=");
      const domain = left.trim().toLowerCase();
      const category = right.join("=").trim();

      if (!domain || !category) {
        continue;
      }

      nextCategoryRules[domain] = category;
    }

    await chrome.storage.local.set({
      settings: nextSettings,
      categoryRules: nextCategoryRules
    });
    await chrome.runtime.sendMessage({ type: "settings-updated" });
    await render();
  });

  resetCategoryRulesButton.addEventListener("click", async () => {
    await chrome.storage.local.set({ categoryRules: DEFAULT_CATEGORY_RULES });
    await render();
  });

  runHistoryBackfillButton.addEventListener("click", async () => {
    runHistoryBackfillButton.disabled = true;
    const previousLabel = runHistoryBackfillButton.textContent;
    runHistoryBackfillButton.textContent = "Syncing...";

    try {
      const result = await chrome.runtime.sendMessage({
        type: "sync-history",
        days: Number(historyBackfillDays.value)
      });

      if (!result?.ok) {
        window.alert("History sync failed. Please try again.");
        return;
      }

      window.alert(
        `Synced approximately ${formatDuration(result.importedSeconds)} across ${result.importedSessions} estimated sessions.`
      );
      await render();
    } catch {
      window.alert("History sync failed. Please try again.");
    } finally {
      runHistoryBackfillButton.disabled = false;
      runHistoryBackfillButton.textContent = previousLabel || "Sync with Chrome history";
    }
  });

  exportButton.addEventListener("click", async () => {
    const allData = await chrome.storage.local.get(null);
    const payload = JSON.stringify(allData, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `chronopanel-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  importButton.addEventListener("click", () => {
    importFileInput.click();
  });

  importFileInput.addEventListener("change", async () => {
    const file = importFileInput.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;

      const patch: Record<string, unknown> = {};
      for (const key of Object.values(STORAGE_KEYS)) {
        if (key in parsed) {
          patch[key] = parsed[key];
        }
      }

      await chrome.storage.local.set(patch);
      await chrome.runtime.sendMessage({ type: "settings-updated" });
      await render();
    } catch {
      window.alert("Invalid JSON import file.");
    } finally {
      importFileInput.value = "";
    }
  });

  clearButton.addEventListener("click", async () => {
    const confirmed = window.confirm("Clear all usage data and reset settings?");
    if (!confirmed) {
      return;
    }

    await chrome.runtime.sendMessage({ type: "clear-all-data" });
    await render();
  });
}

async function render() {
  const state = await loadState();
  renderSummary(state);
  renderWebsites(state);
  renderSettings(state);
  switchView(activeView);
}

for (const tab of Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"))) {
  tab.addEventListener("click", () => {
    switchView((tab.dataset.view as typeof activeView) || "summary");
  });
}

refreshButton.addEventListener("click", async () => {
  const state = await loadState();
  await chrome.runtime.sendMessage({
    type: "sync-history",
    days: state.settings.historySyncDays
  });
  await render();
});

chrome.storage.onChanged.addListener(() => {
  void render();
});

void render();

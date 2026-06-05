import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

// ============================================================
// SLA Configuration
// ============================================================

export interface BusinessHoursConfig {
  startHour: number;   // 8 = 08:00
  endHour: number;     // 17.5 = 17:30
  workDays: number[];  // 0=Sun, 1=Mon, ..., 6=Sat
}

export interface SLAConfig {
  thresholds: {
    INBOX: number;    // minutes
    COMMENT: number;  // minutes
  };
  afterHoursThresholds: {
    INBOX: number;    // minutes
    COMMENT: number;  // minutes
  };
  businessHours: BusinessHoursConfig;
}

export const DEFAULT_SLA_CONFIG: SLAConfig = {
  thresholds: {
    INBOX: 15,
    COMMENT: 60,
  },
  afterHoursThresholds: {
    INBOX: 30,
    COMMENT: 120,
  },
  businessHours: {
    startHour: 8,
    endHour: 18,
    workDays: [1, 2, 3, 4, 5, 6], // Mon–Sat
  },
};

// ============================================================
// Persistent config (data/sla-config.json)
// ============================================================

const CONFIG_PATH = path.join(process.cwd(), "data", "sla-config.json");

let _cache: SLAConfig | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 30_000;

export async function getSLAConfig(): Promise<SLAConfig> {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL_MS) return _cache;
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    _cache = JSON.parse(raw) as SLAConfig;
    _cacheTime = Date.now();
    return _cache;
  } catch {
    return DEFAULT_SLA_CONFIG;
  }
}

export async function setSLAConfig(config: SLAConfig): Promise<void> {
  await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  _cache = config;
  _cacheTime = Date.now();
}

// ============================================================
// Threshold helpers
// ============================================================

export function getThresholdByType(
  conversationType: string,
  outsideBusinessHours = false,
  config: SLAConfig = DEFAULT_SLA_CONFIG
): number {
  const thresholds = outsideBusinessHours
    ? config.afterHoursThresholds
    : config.thresholds;
  return conversationType === "COMMENT" ? thresholds.COMMENT : thresholds.INBOX;
}

// ----------------------------------------------------------------
// Business hours utilities
// ----------------------------------------------------------------

function getLocalInfo(
  localTs: number
): { dow: number; hour: number; dayStart: number } {
  const d = new Date(localTs);
  const dayStart =
    localTs -
    (d.getUTCHours() * 3_600_000 +
      d.getUTCMinutes() * 60_000 +
      d.getUTCSeconds() * 1_000 +
      d.getUTCMilliseconds());
  return {
    dow: d.getUTCDay(),
    hour: d.getUTCHours() + d.getUTCMinutes() / 60,
    dayStart,
  };
}

function advanceToWorkingTime(
  localTs: number,
  cfg: BusinessHoursConfig
): number {
  let ts = localTs;
  const { startHour, endHour, workDays } = cfg;

  for (let i = 0; i < 14; i++) {
    const { dow, hour, dayStart } = getLocalInfo(ts);
    const dayWorkStart = dayStart + startHour * 3_600_000;
    const dayWorkEnd = dayStart + endHour * 3_600_000;

    if (!workDays.includes(dow) || ts >= dayWorkEnd) {
      ts = dayStart + 86_400_000 + startHour * 3_600_000;
      continue;
    }
    if (ts < dayWorkStart) return dayWorkStart;
    return ts;
  }
  return ts;
}

/**
 * Tính số phút làm việc thực tế giữa start và end,
 * chỉ đếm thời gian trong business hours.
 */
export function calculateWorkingMinutes(
  start: Date,
  end: Date,
  timezone: number,
  cfg: BusinessHoursConfig = DEFAULT_SLA_CONFIG.businessHours
): number {
  if (start >= end) return 0;

  const { startHour, endHour, workDays } = cfg;
  const offsetMs = timezone * 3_600_000;

  let localStart = start.getTime() + offsetMs;
  const localEnd = end.getTime() + offsetMs;

  localStart = advanceToWorkingTime(localStart, cfg);
  if (localStart >= localEnd) return 0;

  let totalMs = 0;
  let current = localStart;

  while (current < localEnd) {
    const { dow, dayStart } = getLocalInfo(current);
    const dayWorkEnd = dayStart + endHour * 3_600_000;

    if (!workDays.includes(dow) || current >= dayWorkEnd) {
      current = dayStart + 86_400_000 + startHour * 3_600_000;
      continue;
    }

    const periodEnd = Math.min(dayWorkEnd, localEnd);
    totalMs += periodEnd - current;
    current = dayStart + 86_400_000 + startHour * 3_600_000;
  }

  return Math.round(totalMs / 60_000);
}

/**
 * Kiểm tra xem một thời điểm có nằm ngoài giờ làm việc không.
 */
export function isOutsideBusinessHours(
  ts: Date,
  timezone: number,
  cfg: BusinessHoursConfig = DEFAULT_SLA_CONFIG.businessHours
): boolean {
  const localTs = ts.getTime() + timezone * 3_600_000;
  const { dow, hour } = getLocalInfo(localTs);
  return (
    !cfg.workDays.includes(dow) ||
    hour < cfg.startHour ||
    hour >= cfg.endHour
  );
}

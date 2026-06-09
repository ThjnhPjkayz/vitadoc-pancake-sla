import { prisma } from "@/lib/prisma";

// ============================================================
// SLA Configuration
// ============================================================

export interface BusinessShift {
  start: number; // 8.5 = 08:30
  end: number;   // 18.0 = 18:00
}

export interface BusinessHoursConfig {
  shifts: BusinessShift[]; // Multiple shifts per day, sorted by start
  workDays: number[];      // 0=Sun, 1=Mon, ..., 6=Sat
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
    shifts: [
      { start: 8.5, end: 18 },   // Ca 1: 08:30 – 18:00
      { start: 19, end: 21 },    // Ca 2: 19:00 – 21:00
    ],
    workDays: [1, 2, 3, 4, 5, 6], // Mon–Sat
  },
};

// ============================================================
// Persistent config (PostgreSQL — Settings table)
// ============================================================

const SETTINGS_KEY = "sla_config";

let _cache: SLAConfig | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 30_000;

export async function getSLAConfig(): Promise<SLAConfig> {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL_MS) return _cache;
  try {
    const row = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
    if (!row) return DEFAULT_SLA_CONFIG;

    const parsed = row.value as unknown as SLAConfig & {
      businessHours?: { startHour?: number; endHour?: number; workDays?: number[] };
    };
    // Migrate old format: businessHours had startHour/endHour instead of shifts
    if (parsed.businessHours && !parsed.businessHours.shifts) {
      parsed.businessHours = {
        shifts: [{ start: parsed.businessHours.startHour ?? 8, end: parsed.businessHours.endHour ?? 18 }],
        workDays: parsed.businessHours.workDays ?? DEFAULT_SLA_CONFIG.businessHours.workDays,
      };
    }
    _cache = parsed as SLAConfig;
    _cacheTime = Date.now();
    return _cache;
  } catch {
    return DEFAULT_SLA_CONFIG;
  }
}

export async function setSLAConfig(config: SLAConfig): Promise<void> {
  await prisma.settings.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: config as object },
    create: { key: SETTINGS_KEY, value: config as object },
  });
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
  const sorted = [...cfg.shifts].sort((a, b) => a.start - b.start);
  let ts = localTs;

  for (let guard = 0; guard < 14; guard++) {
    const { dow, dayStart } = getLocalInfo(ts);

    if (!cfg.workDays.includes(dow)) {
      ts = dayStart + 86_400_000 + sorted[0].start * 3_600_000;
      continue;
    }

    for (const { start, end } of sorted) {
      const shiftStart = dayStart + start * 3_600_000;
      const shiftEnd   = dayStart + end   * 3_600_000;
      if (ts >= shiftEnd) continue;    // past this shift
      if (ts < shiftStart) return shiftStart; // in gap before this shift
      return ts;                       // inside this shift
    }

    // after all shifts today → advance to first shift of next workday
    ts = dayStart + 86_400_000 + sorted[0].start * 3_600_000;
  }
  return ts;
}

/**
 * Tính số phút làm việc thực tế giữa start và end,
 * chỉ đếm thời gian trong business hours (hỗ trợ nhiều ca).
 */
export function calculateWorkingMinutes(
  start: Date,
  end: Date,
  timezone: number,
  cfg: BusinessHoursConfig = DEFAULT_SLA_CONFIG.businessHours
): number {
  if (start >= end) return 0;

  const sorted = [...cfg.shifts].sort((a, b) => a.start - b.start);
  const offsetMs = timezone * 3_600_000;

  let localStart = start.getTime() + offsetMs;
  const localEnd = end.getTime() + offsetMs;

  localStart = advanceToWorkingTime(localStart, cfg);
  if (localStart >= localEnd) return 0;

  let totalMs = 0;
  let current = localStart;

  while (current < localEnd) {
    const { dow, dayStart } = getLocalInfo(current);

    if (!cfg.workDays.includes(dow)) {
      current = dayStart + 86_400_000 + sorted[0].start * 3_600_000;
      continue;
    }

    let done = false;
    for (const { start: s, end: e } of sorted) {
      const shiftStart = dayStart + s * 3_600_000;
      const shiftEnd   = dayStart + e * 3_600_000;

      if (current >= shiftEnd) continue; // past this shift

      // current may be in gap before shift — snap to shift start
      const effectiveStart = Math.max(current, shiftStart);
      if (effectiveStart >= localEnd) { done = true; break; }

      const periodEnd = Math.min(shiftEnd, localEnd);
      totalMs += periodEnd - effectiveStart;
      current = shiftEnd; // advance to end of shift (into next gap or next shift)

      if (current >= localEnd) { done = true; break; }
    }

    if (!done) {
      // exhausted all shifts today → advance to first shift of next workday
      current = dayStart + 86_400_000 + sorted[0].start * 3_600_000;
    }
  }

  return Math.round(totalMs / 60_000);
}

/**
 * Kiểm tra xem một thời điểm có nằm ngoài giờ làm việc không.
 * Gap giữa các ca (vd 18:00–19:00) cũng được coi là ngoài giờ.
 */
export function isOutsideBusinessHours(
  ts: Date,
  timezone: number,
  cfg: BusinessHoursConfig = DEFAULT_SLA_CONFIG.businessHours
): boolean {
  const localTs = ts.getTime() + timezone * 3_600_000;
  const { dow, hour } = getLocalInfo(localTs);
  if (!cfg.workDays.includes(dow)) return true;
  return !cfg.shifts.some((shift) => hour >= shift.start && hour < shift.end);
}

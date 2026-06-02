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
  businessHours: BusinessHoursConfig;
}

export const DEFAULT_SLA_CONFIG: SLAConfig = {
  thresholds: {
    INBOX: 15,
    COMMENT: 60,
  },
  businessHours: {
    startHour: 8,
    endHour: 17.5,     // 17:30
    workDays: [1, 2, 3, 4, 5, 6], // Mon–Sat
  },
};

export function getThresholdByType(conversationType: string): number {
  return conversationType === "COMMENT"
    ? DEFAULT_SLA_CONFIG.thresholds.COMMENT
    : DEFAULT_SLA_CONFIG.thresholds.INBOX;
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
 *
 * - Nếu start nằm ngoài giờ làm → đẩy lên đầu giờ làm tiếp theo
 * - Chỉ đếm phút trong workDays và [startHour, endHour)
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

// Client-facing sends (survey links, reminders) are forbidden during the
// night: from QUIET_START_H (20:00) to QUIET_END_H (09:00) Moscow time.
// Moscow is UTC+3 year-round (Russia abolished DST in 2014), so a fixed
// offset is deliberate — no timezone database needed.
const MSK_OFFSET_H = 3;
export const QUIET_START_H = 20; // 20:00 МСК
export const QUIET_END_H = 9; // 09:00 МСК

export function mskHour(d: Date = new Date()): number {
  return (d.getUTCHours() + MSK_OFFSET_H) % 24;
}

export function isQuietHoursMsk(d: Date = new Date()): boolean {
  const h = mskHour(d);
  return h >= QUIET_START_H || h < QUIET_END_H;
}

/**
 * The next moment client sends are allowed: `d` itself when we're already in
 * the daytime window, otherwise the nearest 09:00 MSK (today for the
 * 00:00-09:00 stretch, tomorrow for the evening one).
 */
export function nextSendTimeMsk(d: Date = new Date()): Date {
  if (!isQuietHoursMsk(d)) return d;
  // 09:00 MSK expressed in UTC is 06:00 UTC of the same UTC calendar day.
  const todayNineMsk = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    QUIET_END_H - MSK_OFFSET_H
  );
  return new Date(todayNineMsk > d.getTime() ? todayNineMsk : todayNineMsk + 86_400_000);
}

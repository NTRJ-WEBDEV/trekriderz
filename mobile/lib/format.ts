// Compact post timestamp — seconds/minutes/hours roll straight into weeks
// then years (no day/month tier), per product spec for the Feed redesign.
export function formatPostTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${Math.max(sec, 0)}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24 * 7) return `${hr}h`;
  const week = Math.floor(hr / (24 * 7));
  if (week < 52) return `${week}w`;
  const year = Math.floor(week / 52);
  return `${year}y`;
}

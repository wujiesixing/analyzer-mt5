const DAY = 86_400_000

export function dayMs(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year || 0, (month || 1) - 1, day || 1)
}

export function formatDay(ms: number): string {
  const date = new Date(ms)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${month}-${day}`
}

/** 把已选日期折成 0–1。空字符串表示贴住该侧边界。 */
export function rangeRatios(
  min: string,
  max: string,
  from: string,
  to: string,
): [number, number] {
  const startMs = dayMs(min)
  const endMs = dayMs(max)
  const span = endMs - startMs
  if (span <= 0) return [0, 1]
  const lo = from ? Math.min(Math.max(dayMs(from), startMs), endMs) : startMs
  const hi = to ? Math.min(Math.max(dayMs(to), startMs), endMs) : endMs
  const left = Math.min(lo, hi)
  const right = Math.max(lo, hi)
  return [(left - startMs) / span, (right - startMs) / span]
}

/**
 * 把滑块比例吸附到日期。整段贴满时返回空字符串，与「不限开始/结束日期」相同。
 */
export function datesFromRatios(
  min: string,
  max: string,
  start: number,
  end: number,
): { from: string; to: string } {
  const startMs = dayMs(min)
  const endMs = dayMs(max)
  const span = endMs - startMs
  if (span <= 0) return { from: '', to: '' }
  const left = Math.min(Math.max(Math.min(start, end), 0), 1)
  const right = Math.min(Math.max(Math.max(start, end), 0), 1)
  const fromMs = startMs + Math.round((left * span) / DAY) * DAY
  const toMs = startMs + Math.round((right * span) / DAY) * DAY
  const from = formatDay(Math.min(Math.max(fromMs, startMs), endMs))
  const to = formatDay(Math.min(Math.max(toMs, startMs), endMs))
  if (from === min && to === max) return { from: '', to: '' }
  return { from, to }
}

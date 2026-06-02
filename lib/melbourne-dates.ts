export const MELBOURNE_TZ = "Australia/Melbourne"

/** Parse Supabase / CSV start time stored as UTC (no offset suffix). */
export function parseUtcStartDatetime(value: string): Date | null {
  if (!value?.trim()) return null

  const raw = value.trim()

  if (raw.includes("T")) {
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6] ?? 0)

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second))
}

export function toMelbourneDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** 0 = Sunday, 6 = Saturday (Melbourne calendar). */
export function getMelbourneWeekday(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: MELBOURNE_TZ,
    weekday: "short",
  }).format(date)

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return map[weekday] ?? 0
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

export function getThisWeekRangeMelbourne(now = new Date()) {
  const todayKey = toMelbourneDateKey(now)
  const weekday = getMelbourneWeekday(now)
  const daysUntilSunday = weekday === 0 ? 0 : 7 - weekday

  return {
    startKey: todayKey,
    endKey: addDaysToDateKey(todayKey, daysUntilSunday),
  }
}

export function getThisWeekendRangeMelbourne(now = new Date()) {
  const todayKey = toMelbourneDateKey(now)
  const weekday = getMelbourneWeekday(now)

  if (weekday === 6) {
    return {
      startKey: todayKey,
      endKey: addDaysToDateKey(todayKey, 1),
    }
  }

  if (weekday === 0) {
    return { startKey: todayKey, endKey: todayKey }
  }

  const daysUntilSaturday = 6 - weekday
  const saturdayKey = addDaysToDateKey(todayKey, daysUntilSaturday)

  return {
    startKey: saturdayKey,
    endKey: addDaysToDateKey(saturdayKey, 1),
  }
}

export function isDateKeyInRange(
  dateKey: string,
  startKey: string,
  endKey: string
): boolean {
  return dateKey >= startKey && dateKey <= endKey
}

export function eventMatchesTimeFilter(
  startDatetime: string,
  filter: "week" | "weekend" | "month",
  endDatetime?: string
): boolean {
  if (filter === "month") return true

  const start = parseUtcStartDatetime(startDatetime)
  if (!start) return false

  const startKey = toMelbourneDateKey(start)

  const end = endDatetime ? parseUtcStartDatetime(endDatetime) : null
  const endKey = end ? toMelbourneDateKey(end) : startKey

  if (filter === "week") {
    const range = getThisWeekRangeMelbourne()
    return startKey <= range.endKey && endKey >= range.startKey
  }

  const range = getThisWeekendRangeMelbourne()
  return startKey <= range.endKey && endKey >= range.startKey
}

export function formatEventDisplayDate(startDatetime: string): string {
  const start = parseUtcStartDatetime(startDatetime)
  if (!start) return ""

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(start)
}
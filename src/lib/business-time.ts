export const BUSINESS_TIME_ZONE = "Asia/Shanghai"

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function formatPartsToIso(parts: Intl.DateTimeFormatPart[]) {
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

export function formatDateInBusinessTimeZone(input: Date | number | string): string {
  const date = input instanceof Date ? input : new Date(input)
  return formatPartsToIso(ymdFormatter.formatToParts(date))
}

export function getBusinessTodayIso(now: Date = new Date()): string {
  return formatDateInBusinessTimeZone(now)
}

const ymdHmFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

export function formatDateTimeInBusinessTimeZone(input: Date | number | string): string {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return ""
  const parts = ymdHmFormatter.formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`
}


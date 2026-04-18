export function splitMilestoneTitle(raw: string) {
  const i = raw.indexOf("\n")
  if (i === -1) return { headline: raw.trim(), detail: "" }
  return { headline: raw.slice(0, i).trim(), detail: raw.slice(i + 1).trim() }
}

export function joinMilestoneTitle(headline: string, detail: string) {
  const h = headline.replace(/\r?\n/g, " ").trimEnd()
  const d = detail.trimEnd()
  if (!h && !d) return ""
  if (!h) return d
  if (!d) return h
  return `${h}\n${d}`
}

export function splitMilestoneDetailLines(detail: string) {
  return detail
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, ""))
}

export function normalizeMilestoneFields(input: { title: string; detail?: string | null }) {
  const title = (input.title ?? "").trim()
  const detail = (input.detail ?? "").trim()
  if (detail) return { title, detail }

  const split = splitMilestoneTitle(title)
  return {
    title: split.headline,
    detail: split.detail,
  }
}

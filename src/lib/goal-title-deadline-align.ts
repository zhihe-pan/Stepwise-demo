const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * 当标题里的「年月日」与截止日期是同一天但年份不一致时（常见为模型写错年），
 * 将标题中的日期统一为截止日，避免出现「标题写 2025、截止日纠错为 2026」的分裂。
 */
export function alignGoalTitleWithDeadline(title: string, deadlineIso: string): string {
  const m = deadlineIso.match(ISO)
  if (!m || !title.trim()) return title
  const y = m[1]
  const mo = Number(m[2])
  const d = Number(m[3])

  let out = title
  out = out.replace(/(\d{4})年(\d{1,2})月(\d{1,2})日?/g, (full, yy: string, mm: string, dd: string) => {
    if (Number(mm) === mo && Number(dd) === d && yy !== y) {
      return `${y}年${mo}月${d}日`
    }
    return full
  })
  out = out.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (full, yy: string, mm: string, dd: string) => {
    if (Number(mm) === mo && Number(dd) === d && yy !== y) {
      return deadlineIso
    }
    return full
  })
  out = out.replace(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/g, (full, yy: string, mm: string, dd: string) => {
    if (Number(mm) === mo && Number(dd) === d && yy !== y) {
      return `${y}年${mo}月${d}日`
    }
    return full
  })
  return out
}

/**
 * 彻底移除标题中包含的日期信息，保持主目标纯粹
 */
export function stripDatesFromTitle(title: string): string {
  let out = title.trim()
  // 1. 移除 YYYY-MM-DD
  out = out.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
  // 2. 移除 YYYY年M月D日
  out = out.replace(/\d{4}年\d{1,2}月\d{1,2}日?/g, "")
  // 3. 移除 M月D日 (注意不要误删其他数字)
  out = out.replace(/\d{1,2}月\d{1,2}日/g, "")
  // 4. 移除带符号的日期，如 "· 截止 2025-12-31" 或 " (2025-12-31)"
  out = out.replace(/[\s·-]*截止[:：]?\s*\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?/g, "")
  out = out.replace(/\s*[\(（]\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?[\)）]/g, "")
  // 5. 清理末尾残留的连接符和空格（`-` 须转义，否则 `·-：` 会变成码点范围而误删汉字）
  out = out.replace(/[\s·\-：:—]+$/, "")
  return out.trim()
}

/** 与 milestone-sortable-list 中「里程碑 N」标签视觉一致 */
const PRIMARY = "#4F46E5"

export function MilestoneIndexBadge({ order }: { order: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-indigo-100 px-2 py-0.5 text-xs font-bold tabular-nums tracking-tight"
      style={{ color: PRIMARY, backgroundColor: "rgba(79, 70, 229, 0.08)" }}
    >
      里程碑{order}
    </span>
  )
}

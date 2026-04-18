"use client"

import ReactMarkdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { preprocessChatMarkdown } from "@/lib/chat-markdown-preprocess"
import { cn } from "@/lib/utils"

type ChatMarkdownProps = {
  content: string
  variant: "assistant" | "user"
  className?: string
  /** 流式输出最后一帧时开启，可减轻未闭合 ** / ``` 导致的「像没渲染」的现象 */
  balanceIncomplete?: boolean
}

const markdownComponents: Components = {
  a: ({ href, children, ...props }) => {
    if (!href) return <span {...props}>{children}</span>
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    )
  },
}

export function ChatMarkdown({
  content,
  variant,
  className,
  balanceIncomplete = false,
}: ChatMarkdownProps) {
  const trimmed = content.trim()
  if (!trimmed) return null

  const processed = preprocessChatMarkdown(trimmed, { balanceIncomplete })
  const isUser = variant === "user"

  return (
    <div
      className={cn(
        "break-words text-sm leading-relaxed",
        "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:first:mt-0",
        "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:first:mt-0",
        "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic",
        "[&_hr]:my-3 [&_hr]:border-current/20",
        "[&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
        "[&_pre]:my-2 [&_pre]:max-h-[min(50vh,24rem)] [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs",
        "[&_a]:underline [&_a]:underline-offset-2",
        "[&_table]:my-2 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto",
        "[&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:px-2 [&_td]:px-2 [&_th]:py-1 [&_td]:py-1 [&_th]:text-left",
        isUser
          ? "text-primary-foreground [&_code]:bg-primary-foreground/20 [&_pre]:bg-slate-950/80 [&_pre]:text-slate-100 [&_blockquote]:border-primary-foreground/35 [&_a]:text-primary-foreground [&_hr]:border-primary-foreground/25 [&_table]:text-primary-foreground [&_th]:border-primary-foreground/30 [&_td]:border-primary-foreground/25"
          : "text-foreground [&_code]:bg-muted [&_pre]:bg-slate-950 [&_pre]:text-slate-100 [&_blockquote]:border-border [&_a]:text-primary [&_hr]:border-border [&_table]:text-foreground [&_th]:border-border [&_td]:border-border",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
        {processed}
      </ReactMarkdown>
    </div>
  )
}

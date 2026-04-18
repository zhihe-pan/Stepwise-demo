"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const EMOJI_LIST = [
  "🎯", "🚀", "📚", "💪", "💼", "🎨", "🧠", "❤️",
  "💡", "⭐️", "🏆", "🔥", "⚡️", "🏃", "🧘", "🎵",
  "📝", "🌍", "✈️", "💵"
]

interface IconPickerProps {
  icon: string
  onIconChange: (icon: string) => void
  children?: React.ReactNode
}

export function IconPicker({ icon, onIconChange, children }: IconPickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ? children : (
          <Button variant="outline" className="h-10 w-10 p-0 text-xl">
            {icon}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="mb-2 text-sm font-medium text-foreground">选择图标</div>
        <div className="grid grid-cols-5 gap-2">
          {EMOJI_LIST.map((emoji, i) => (
            <button
              key={i}
              type="button"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md text-xl transition-colors hover:bg-muted",
                icon === emoji && "bg-primary/10 ring-1 ring-primary"
              )}
              onClick={(e) => {
                e.stopPropagation()
                onIconChange(emoji)
                setOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

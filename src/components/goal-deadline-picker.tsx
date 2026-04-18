"use client"

import * as React from "react"
import { format, parseISO, startOfDay, isBefore } from "date-fns"
import { zhCN } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { gfDateButton } from "@/components/goal-form-shared"

export interface GoalDeadlinePickerProps {
  id?: string
  value: string
  onChange: (isoDate: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

/** 仅通过日历选择；输出 YYYY-MM-DD；禁用今天之前的日期 */
export function GoalDeadlinePicker({
  id,
  value,
  onChange,
  disabled,
  placeholder = "选择日期",
  className,
}: GoalDeadlinePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(`${value}T12:00:00`) : undefined
  const today = startOfDay(new Date())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            gfDateButton,
            "disabled:opacity-50",
            !value && "text-slate-500",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" aria-hidden />
          {selected ? format(selected, "yyyy年M月d日", { locale: zhCN }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (!d) return
            onChange(format(d, "yyyy-MM-dd"))
            setOpen(false)
          }}
          disabled={(date) => isBefore(startOfDay(date), today)}
          defaultMonth={selected ?? today}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

"use client"

import { useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Goal } from "@/lib/mock-data"

interface DeleteGoalDialogProps {
  goal: Goal | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (goalId: string) => void
}

export function DeleteGoalDialog({
  goal,
  open,
  onOpenChange,
  onConfirm,
}: DeleteGoalDialogProps) {
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  if (!goal) return null

  const canDelete = confirmText === "删除"

  const handleDelete = () => {
    if (!canDelete) return
    setIsDeleting(true)
    // Simulate deletion
    setTimeout(() => {
      onConfirm(goal.id)
      setIsDeleting(false)
      setConfirmText("")
      onOpenChange(false)
    }, 1000)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmText("")
    }
    onOpenChange(open)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">删除目标</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            你确定要删除{" "}
            <span className="font-medium text-foreground">
              {goal.emoji} {goal.name}
            </span>{" "}
            吗？
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Message */}
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm text-foreground">此操作不可撤销，删除后将会：</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-destructive" />
                删除所有相关任务和里程碑
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-destructive" />
                清除该目标的所有历史记录
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-destructive" />
                无法恢复已完成的进度数据
              </li>
            </ul>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              请输入 <span className="font-medium text-foreground">删除</span> 以确认操作：
              <span className="ml-1 text-red-500" aria-hidden="true">
                *
              </span>
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={'输入"删除"以确认'}
              className="text-center"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                删除中...
              </>
            ) : (
              "确认删除"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

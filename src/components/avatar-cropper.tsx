"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ZoomIn, ZoomOut, RotateCcw, Check, X } from "lucide-react"

interface AvatarCropperProps {
  imageSrc: string
  onCropComplete: (croppedImage: string) => void
  onCancel: () => void
}

const CROP_DIAMETER = 200

export function AvatarCropper({ imageSrc, onCropComplete, onCancel }: AvatarCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const [scale, setScale] = useState(1)
  const [scaleMin, setScaleMin] = useState(0.5)
  const [scaleMax, setScaleMax] = useState(3)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)

  const containerSize = 300

  useEffect(() => {
    setImageLoaded(false)
    setPosition({ x: 0, y: 0 })
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      imageRef.current = img
      setImageLoaded(true)
      const minScale = Math.max(CROP_DIAMETER / img.width, CROP_DIAMETER / img.height)
      const sMin = Math.max(minScale * 0.35, 0.08)
      const sMax = Math.max(minScale * 5, 3)
      setScaleMin(sMin)
      setScaleMax(sMax)
      setScale(Math.min(Math.max(minScale * 1.15, sMin), sMax))
    }
    img.onerror = () => {
      imageRef.current = null
      setImageLoaded(false)
    }
    img.src = imageSrc
  }, [imageSrc])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const blockScroll = (e: TouchEvent) => {
      e.preventDefault()
    }
    el.addEventListener("touchmove", blockScroll, { passive: false })
    return () => el.removeEventListener("touchmove", blockScroll)
  }, [])

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    const img = imageRef.current

    if (!canvas || !ctx || !img || !imageLoaded) return

    const size = containerSize
    canvas.width = size
    canvas.height = size

    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)"
    ctx.fillRect(0, 0, size, size)

    const scaledWidth = img.width * scale
    const scaledHeight = img.height * scale
    const centerX = size / 2
    const centerY = size / 2
    const drawX = centerX - scaledWidth / 2 + position.x
    const drawY = centerY - scaledHeight / 2 + position.y

    ctx.save()
    ctx.beginPath()
    ctx.arc(centerX, centerY, CROP_DIAMETER / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight)
    ctx.restore()

    ctx.strokeStyle = "white"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(centerX, centerY, CROP_DIAMETER / 2, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(centerX - CROP_DIAMETER / 2, centerY)
    ctx.lineTo(centerX + CROP_DIAMETER / 2, centerY)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(centerX, centerY - CROP_DIAMETER / 2)
    ctx.lineTo(centerX, centerY + CROP_DIAMETER / 2)
    ctx.stroke()
  }, [scale, position, imageLoaded])

  useEffect(() => {
    drawImage()
  }, [drawImage])

  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true)
    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y,
    })
  }

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDragging) return
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handlePointerDown(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    handlePointerMove(e.clientX, e.clientY)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    handlePointerDown(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    const touch = e.touches[0]
    handlePointerMove(touch.clientX, touch.clientY)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  const handleReset = () => {
    const img = imageRef.current
    if (!img) return
    const minScale = Math.max(CROP_DIAMETER / img.width, CROP_DIAMETER / img.height)
    setScale(Math.min(Math.max(minScale * 1.15, scaleMin), scaleMax))
    setPosition({ x: 0, y: 0 })
  }

  const handleCrop = () => {
    const img = imageRef.current
    if (!img) return

    const outputCanvas = document.createElement("canvas")
    const outputCtx = outputCanvas.getContext("2d")
    if (!outputCtx) return

    const outputSize = 256
    outputCanvas.width = outputSize
    outputCanvas.height = outputSize

    const size = containerSize
    const centerX = size / 2
    const centerY = size / 2

    const scaledWidth = img.width * scale
    const scaledHeight = img.height * scale
    const drawX = centerX - scaledWidth / 2 + position.x
    const drawY = centerY - scaledHeight / 2 + position.y

    const cropStartX = (centerX - CROP_DIAMETER / 2 - drawX) / scale
    const cropStartY = (centerY - CROP_DIAMETER / 2 - drawY) / scale
    const cropWidth = CROP_DIAMETER / scale
    const cropHeight = CROP_DIAMETER / scale

    outputCtx.beginPath()
    outputCtx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2)
    outputCtx.clip()

    outputCtx.drawImage(img, cropStartX, cropStartY, cropWidth, cropHeight, 0, 0, outputSize, outputSize)

    const croppedDataUrl = outputCanvas.toDataURL("image/png", 0.92)
    onCropComplete(croppedDataUrl)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4">
      <div className="max-h-[100dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-xl sm:p-6">
        <h3 className="mb-3 text-center text-lg font-semibold text-foreground sm:mb-4">调整头像</h3>

        <div
          ref={containerRef}
          className="relative mx-auto mb-4 flex aspect-square w-full max-w-[min(100%,300px)] cursor-grab touch-none items-center justify-center overflow-hidden rounded-xl bg-black active:cursor-grabbing"
          style={{ maxHeight: "min(72vw, 300px)" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <canvas ref={canvasRef} className="h-full w-full max-h-[300px] max-w-[300px]" />
        </div>

        <div className="mb-4 flex items-center gap-3 px-0.5">
          <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <Slider
            value={[Math.min(Math.max(scale, scaleMin), scaleMax)]}
            onValueChange={(value) => setScale(value[0])}
            min={scaleMin}
            max={scaleMax}
            step={(scaleMax - scaleMin) / 120}
            className="flex-1 py-2"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>

        <p className="mb-4 text-center text-xs text-muted-foreground">
          拖动图片调整取景范围，使用滑块缩放
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button type="button" variant="outline" onClick={handleReset} className="h-11 w-full gap-2 sm:h-10 sm:flex-1">
            <RotateCcw className="h-4 w-4" />
            重置
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} className="h-11 w-full gap-2 sm:h-10 sm:flex-1">
            <X className="h-4 w-4" />
            取消
          </Button>
          <Button type="button" onClick={handleCrop} className="h-11 w-full gap-2 sm:h-10 sm:flex-1">
            <Check className="h-4 w-4" />
            确定
          </Button>
        </div>

        <div
          className="shrink-0 sm:hidden"
          style={{ height: "env(safe-area-inset-bottom, 0px)" }}
          aria-hidden
        />
      </div>
    </div>
  )
}

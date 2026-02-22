/**
 * Personal Whiteboard — private canvas attached to avatar.
 * Supports auto-share on proximity, view-only/collaborative modes, export.
 * Strokes are local-only until shared; when shared, strokes broadcast via PERSONAL_WB_STROKE.
 */

import {
  useRef,
  useCallback,
  useLayoutEffect,
  useImperativeHandle,
  forwardRef,
} from 'react'
import { realtime, generateStrokeId } from '../lib/realtime'
import type { StrokePoint } from '../types'
import type { PersonalWbStrokeEvent } from '../lib/realtimeStub'

const PW_W = 320
const PW_H = 240
const BATCH_MS = 30
const BATCH_MAX = 12

export type PersonalWbPermissionMode = 'view-only' | 'collaborative'

export interface PersonalWhiteboardHandle {
  getStrokes: () => Map<string, { points: StrokePoint[]; color: string; width: number }>
}

interface PersonalWhiteboardProps {
  roomId: string
  ownerId: string
  ownerName: string
  isOpen: boolean
  onClose: () => void
  autoShare: boolean
  onAutoShareChange: (v: boolean) => void
  permissionMode: PersonalWbPermissionMode
  onPermissionModeChange: (m: PersonalWbPermissionMode) => void
  isSharing: boolean
  onShareStart?: () => void
  onShareStop: () => void
  onAriaAnnounce?: (text: string) => void
}

function smoothPoints(points: StrokePoint[]): StrokePoint[] {
  if (points.length < 3) return points
  const out: StrokePoint[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    out.push({
      x: (points[i - 1].x + points[i].x + points[i + 1].x) / 3,
      y: (points[i - 1].y + points[i].y + points[i + 1].y) / 3,
      pressure: points[i].pressure,
    })
  }
  out.push(points[points.length - 1])
  return out
}

export const PersonalWhiteboard = forwardRef<PersonalWhiteboardHandle, PersonalWhiteboardProps>(
  function PersonalWhiteboard(
    {
      roomId,
      ownerId,
      ownerName: _ownerName,
      isOpen,
      onClose,
      autoShare,
      onAutoShareChange,
      permissionMode,
      onPermissionModeChange,
      isSharing,
      onShareStart: onShareStartProp,
      onShareStop,
      onAriaAnnounce,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const strokesRef = useRef<
      Map<string, { points: StrokePoint[]; color: string; width: number }>
    >(new Map())
    const strokeOrderRef = useRef<string[]>([])
    const bufferRef = useRef<StrokePoint[]>([])
    const currentStrokeRef = useRef<string | null>(null)
    const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isDrawingRef = useRef(false)

    const drawStroke = useCallback(
      (ctx: CanvasRenderingContext2D, points: StrokePoint[], color = '#000', width = 2) => {
        if (points.length < 2) return
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
        ctx.stroke()
      },
      []
    )

    const redrawAll = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      strokeOrderRef.current.forEach((id) => {
        const s = strokesRef.current.get(id)
        if (s && s.points.length >= 2) drawStroke(ctx, s.points, s.color, s.width)
      })
    }, [drawStroke])

    const addStrokePoints = useCallback(
      (strokeId: string, points: StrokePoint[], color = '#000', width = 2) => {
        const existing = strokesRef.current.get(strokeId)
        const merged = existing
          ? { ...existing, points: [...existing.points, ...points] }
          : { points: [...points], color, width }
        strokesRef.current.set(strokeId, merged)
        if (!strokeOrderRef.current.includes(strokeId)) strokeOrderRef.current.push(strokeId)
        redrawAll()
      },
      [redrawAll]
    )

    useImperativeHandle(ref, () => ({
      getStrokes: () => new Map(strokesRef.current),
    }))

    const flushBuffer = useCallback(() => {
      if (bufferRef.current.length === 0 || !currentStrokeRef.current) return
      const points = smoothPoints([...bufferRef.current])
      addStrokePoints(currentStrokeRef.current, points)
      if (isSharing) {
        realtime.send(roomId, {
          type: 'PERSONAL_WB_STROKE',
          roomId,
          ownerId,
          strokeId: currentStrokeRef.current,
          timestamp: Date.now(),
          points,
          color: '#000',
          width: 2,
        } as PersonalWbStrokeEvent)
      }
      bufferRef.current = []
    }, [addStrokePoints, roomId, ownerId, isSharing])

    const getCanvasPoint = useCallback(
      (e: React.PointerEvent | PointerEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return null
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY,
          pressure: e.pressure ?? 0.5,
        }
      },
      []
    )

    const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
        e.preventDefault()
        const pt = getCanvasPoint(e)
        if (!pt) return
        isDrawingRef.current = true
        const strokeId = generateStrokeId()
        currentStrokeRef.current = strokeId
        bufferRef.current = [pt]
      },
      [getCanvasPoint]
    )

    const handlePointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (!isDrawingRef.current) return
        const pt = getCanvasPoint(e)
        if (!pt) return
        bufferRef.current.push(pt)
        if (bufferRef.current.length >= BATCH_MAX) {
          flushBuffer()
        } else if (!batchTimerRef.current) {
          batchTimerRef.current = setTimeout(() => {
            batchTimerRef.current = null
            flushBuffer()
          }, BATCH_MS)
        }
      },
      [getCanvasPoint, flushBuffer]
    )

    const handlePointerUp = useCallback(() => {
      if (!isDrawingRef.current) return
      isDrawingRef.current = false
      flushBuffer()
      currentStrokeRef.current = null
    }, [flushBuffer])

    const exportPng = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const a = document.createElement('a')
      a.download = `personal-whiteboard-${Date.now()}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
      onAriaAnnounce?.('Personal whiteboard exported')
    }, [onAriaAnnounce])

    const undoLastStroke = useCallback(() => {
      const lastId = strokeOrderRef.current[strokeOrderRef.current.length - 1]
      if (!lastId) return
      strokesRef.current.delete(lastId)
      strokeOrderRef.current = strokeOrderRef.current.slice(0, -1)
      redrawAll()
      onAriaAnnounce?.('Stroke undone')
    }, [redrawAll, onAriaAnnounce])

    const clearBoard = useCallback(() => {
      strokesRef.current.clear()
      strokeOrderRef.current = []
      redrawAll()
      onAriaAnnounce?.('Personal whiteboard cleared')
    }, [redrawAll, onAriaAnnounce])

    useLayoutEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = PW_W
      canvas.height = PW_H
      redrawAll()
    }, [redrawAll])

    if (!isOpen) return null

    return (
      <div
        className="personal-whiteboard"
        ref={containerRef}
        role="dialog"
        aria-label="Personal whiteboard"
      >
        <div className="personal-wb-header">
          <span className="personal-wb-title">Personal Whiteboard</span>
          <button
            type="button"
            className="personal-wb-close"
            onClick={onClose}
            aria-label="Close personal whiteboard"
          >
            ×
          </button>
        </div>
        <div className="personal-wb-controls">
          <label className="personal-wb-toggle">
            <input
              type="checkbox"
              checked={autoShare}
              onChange={(e) => onAutoShareChange(e.target.checked)}
            />
            Auto-Share
          </label>
          <select
            value={permissionMode}
            onChange={(e) => onPermissionModeChange(e.target.value as PersonalWbPermissionMode)}
            className="personal-wb-mode"
            aria-label="Permission mode"
          >
            <option value="view-only">View-Only</option>
            <option value="collaborative">Collaborative</option>
          </select>
          <button type="button" className="personal-wb-btn" onClick={exportPng} aria-label="Export PNG">
            Export PNG
          </button>
          <button type="button" className="personal-wb-btn" onClick={undoLastStroke} aria-label="Undo">
            Undo
          </button>
          <button type="button" className="personal-wb-btn" onClick={clearBoard} aria-label="Clear">
            Clear
          </button>
          {!isSharing && onShareStartProp && (
            <button
              type="button"
              className="personal-wb-btn personal-wb-share-now"
              onClick={onShareStartProp}
              aria-label="Share now with nearby"
            >
              Share Now
            </button>
          )}
          {isSharing ? (
            <button
              type="button"
              className="personal-wb-btn personal-wb-stop"
              onClick={onShareStop}
              aria-label="Stop sharing"
            >
              Stop Sharing
            </button>
          ) : null}
        </div>
        <canvas
          ref={canvasRef}
          className="personal-wb-canvas"
          width={PW_W}
          height={PW_H}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: 'none' }}
          aria-label="Personal whiteboard drawing area"
        />
      </div>
    )
  }
)

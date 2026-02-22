import { useRef, useEffect, useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  subscribe,
  broadcast,
  realtime,
  generateClientId,
  generateStrokeId,
  type StrokeMessage,
} from '../lib/realtime'
import type { StrokePoint } from '../types'

const COLORS = ['#000', '#e74c3c', '#3498db', '#2ecc71', '#f39c12']
const WIDTHS = [2, 4, 6, 8]

export function IpadPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const roomId = searchParams.get('room') ?? 'demo-room'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [clientId] = useState(() => generateClientId())
  const [color, setColor] = useState(COLORS[0])

  useEffect(() => {
    realtime.join(roomId)
    return () => realtime.leave()
  }, [roomId])
  const [width, setWidth] = useState(WIDTHS[1])
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<string | null>(null)
  const bufferRef = useRef<StrokePoint[]>([])
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const drawStrokeSegment = useCallback(
    (ctx: CanvasRenderingContext2D, points: StrokePoint[], strokeColor: string, strokeWidth: number) => {
      if (points.length < 2) return
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth * 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.stroke()
    },
    []
  )

  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0 || !currentStrokeRef.current) return
    const points = [...bufferRef.current]
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) drawStrokeSegment(ctx, points, color, width)
    }
    broadcast(roomId, {
      type: 'STROKE_POINTS',
      roomId,
      clientId,
      strokeId: currentStrokeRef.current,
      timestamp: Date.now(),
      points,
      color,
      width,
    })
    bufferRef.current = []
  }, [roomId, clientId, color, width, drawStrokeSegment])

  const getPoint = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      const canvas = canvasRef.current
      if (!canvas || canvas.width === 0 || canvas.height === 0) return null
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
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

  useEffect(() => {
    return subscribe(roomId, (msg: StrokeMessage) => {
      const canvas = canvasRef.current
      if (!canvas || msg.clientId === clientId) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      if (msg.type === 'STROKE_POINTS' && msg.points?.length) {
        ctx.strokeStyle = msg.color ?? '#000'
        ctx.lineWidth = (msg.width ?? 2) * 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(msg.points[0].x, msg.points[0].y)
        for (let i = 1; i < msg.points.length; i++) {
          ctx.lineTo(msg.points[i].x, msg.points[i].y)
        }
        ctx.stroke()
      }
      if (msg.type === 'WHITEBOARD_CLEAR') {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    })
  }, [roomId, clientId])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      const pt = getPoint(e)
      if (!pt) return
      isDrawingRef.current = true
      const strokeId = generateStrokeId()
      currentStrokeRef.current = strokeId
      broadcast(roomId, {
        type: 'STROKE_START',
        roomId,
        clientId,
        strokeId,
        timestamp: Date.now(),
        color,
        width,
      })
      bufferRef.current = [pt]
    },
    [roomId, clientId, color, width, getPoint]
  )

  const drawToCanvas = useCallback(
    (points: StrokePoint[], strokeColor: string, strokeWidth: number) => {
      const canvas = canvasRef.current
      if (!canvas || points.length < 2) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      drawStrokeSegment(ctx, points, strokeColor, strokeWidth)
    },
    [drawStrokeSegment]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return
      const pt = getPoint(e)
      if (!pt) return
      const buf = bufferRef.current
      buf.push(pt)
      if (buf.length >= 2) {
        drawToCanvas([buf[buf.length - 2], buf[buf.length - 1]], color, width)
      }
      if (buf.length >= 12) {
        flushBuffer()
      } else if (!batchTimerRef.current) {
        batchTimerRef.current = setTimeout(() => {
          batchTimerRef.current = null
          flushBuffer()
        }, 30)
      }
    },
    [getPoint, flushBuffer, drawToCanvas, color, width]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {}
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    flushBuffer()
    if (currentStrokeRef.current) {
      broadcast(roomId, {
        type: 'STROKE_END',
        roomId,
        clientId,
        strokeId: currentStrokeRef.current,
        timestamp: Date.now(),
      })
      currentStrokeRef.current = null
    }
  }, [roomId, clientId, flushBuffer])

  const handlePointerUpOrLeave = useCallback(
    (e: React.PointerEvent) => {
      handlePointerUp(e)
    },
    [handlePointerUp]
  )

  const handleShare = useCallback(() => {
    broadcast(roomId, {
      type: 'STROKE_START',
      roomId,
      clientId,
      strokeId: generateStrokeId(),
      timestamp: Date.now(),
    })
  }, [roomId, clientId])

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
    broadcast(roomId, {
      type: 'WHITEBOARD_CLEAR',
      roomId,
      clientId,
      timestamp: Date.now(),
    })
  }, [roomId, clientId])

  return (
    <div className="ipad-page">
      <div className="ipad-header">
        <span className="ipad-title">Campfire Whiteboard</span>
        <span className="ipad-token">Token: {token || '—'}</span>
      </div>
      <div className="ipad-controls">
        <div className="color-picker">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-btn ${color === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>
        <div className="width-picker">
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              className={`width-btn ${width === w ? 'active' : ''}`}
              onClick={() => setWidth(w)}
              aria-label={`Line width ${w}`}
            >
              <span style={{ width: w * 4, height: w * 4 }} className="width-dot" />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-share"
          onClick={handleShare}
          aria-label="Share to whiteboard"
        >
          Share
        </button>
        <button
          type="button"
          className="btn-clear"
          onClick={handleClear}
          aria-label="Clear whiteboard"
        >
          Clear
        </button>
      </div>
      <div className="ipad-canvas-wrapper" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="ipad-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrLeave}
        onPointerLeave={handlePointerUpOrLeave}
        style={{ touchAction: 'none' }}
        aria-label="Drawing area"
        />
      </div>
    </div>
  )
}

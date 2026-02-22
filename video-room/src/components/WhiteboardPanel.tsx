import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useLayoutEffect,
  useImperativeHandle,
  forwardRef,
} from 'react'

function ScreenShareVideo({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream
  }, [stream])
  return <video ref={videoRef} autoPlay playsInline aria-label="Screen share" />
}
import {
  subscribe,
  broadcast,
  generateClientId,
  generateStrokeId,
  realtime,
  type StrokeMessage,
  type PersonalWbStrokeEvent,
  type PersonalWbShareStopEvent,
} from '../lib/realtime'
import type { StrokePoint } from '../types'

export interface WhiteboardPanelHandle {
  exportPng: () => void
  toggleDrawMode: () => void
}

export interface SharedPersonalWb {
  ownerId: string
  ownerName: string
  mode: 'view-only' | 'collaborative'
}

interface WhiteboardPanelProps {
  roomId: string
  mode: 'screen-share' | 'draw'
  screenStream: MediaStream | null
  onModeChange: (mode: 'screen-share' | 'draw') => void
  onAriaAnnounce?: (text: string) => void
  sharedPersonalWb?: SharedPersonalWb | null
  onStopViewingShared?: () => void
  localUserId?: string
  onRequestControl?: (ownerId: string) => void
}

// Simple smoothing: moving average over last 2 points
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

const BATCH_MS = 30
const BATCH_MAX_POINTS = 12

export const WhiteboardPanel = forwardRef<WhiteboardPanelHandle, WhiteboardPanelProps>(function WhiteboardPanel({
  roomId,
  mode,
  screenStream,
  onModeChange,
  onAriaAnnounce,
  sharedPersonalWb,
  onStopViewingShared,
  localUserId,
  onRequestControl,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [clientId] = useState(() => generateClientId())
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<string | null>(null)
  const bufferRef = useRef<StrokePoint[]>([])
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const drawStroke = useCallback(
    (ctx: CanvasRenderingContext2D, points: StrokePoint[], color = '#000', width = 2) => {
      if (points.length < 2) return
      ctx.strokeStyle = color
      ctx.lineWidth = width
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

  const strokesRef = useRef<Map<string, { clientId: string; points: StrokePoint[]; color: string; width: number }>>(new Map())
  const strokeOrderRef = useRef<string[]>([])

  const sharedStrokesRef = useRef<Map<string, { points: StrokePoint[]; color: string; width: number }>>(new Map())
  const sharedStrokeOrderRef = useRef<string[]>([])

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

  const sharedOverlayRef = useRef<HTMLCanvasElement>(null)
  const redrawSharedOverlay = useCallback(() => {
    const canvas = sharedOverlayRef.current
    if (!canvas || !sharedPersonalWb) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const scaleX = canvas.width / 320
    const scaleY = canvas.height / 240
    sharedStrokeOrderRef.current.forEach((id) => {
      const s = sharedStrokesRef.current.get(id)
      if (!s || s.points.length < 2) return
      const scaled = s.points.map((p) => ({ ...p, x: p.x * scaleX, y: p.y * scaleY }))
      drawStroke(ctx, scaled, s.color, s.width * Math.max(scaleX, scaleY))
    })
  }, [drawStroke, sharedPersonalWb])

  useEffect(() => {
    if (!sharedPersonalWb) {
      sharedStrokesRef.current.clear()
      sharedStrokeOrderRef.current = []
      return
    }
    sharedStrokesRef.current.clear()
    sharedStrokeOrderRef.current = []
    const unsub = realtime.on(roomId, (ev) => {
      if (ev.type === 'PERSONAL_WB_STROKE') {
        const e = ev as PersonalWbStrokeEvent
        if (e.ownerId !== sharedPersonalWb.ownerId) return
        if (e.points?.length && e.strokeId) {
          const existing = sharedStrokesRef.current.get(e.strokeId)
          const merged = existing
            ? { ...existing, points: [...existing.points, ...e.points] }
            : { points: [...e.points], color: e.color ?? '#000', width: (e.width ?? 2) * 2 }
          sharedStrokesRef.current.set(e.strokeId, merged)
          if (!sharedStrokeOrderRef.current.includes(e.strokeId)) {
            sharedStrokeOrderRef.current.push(e.strokeId)
          }
          redrawSharedOverlay()
        }
      }
      if (ev.type === 'PERSONAL_WB_SHARE_STOP') {
        const e = ev as PersonalWbShareStopEvent
        if (e.ownerId === sharedPersonalWb.ownerId) {
          sharedStrokesRef.current.clear()
          sharedStrokeOrderRef.current = []
          redrawSharedOverlay()
          onStopViewingShared?.()
        }
      }
    })
    return unsub
  }, [roomId, sharedPersonalWb, redrawSharedOverlay, onStopViewingShared])

  const addStrokePoints = useCallback(
    (strokeId: string, clientIdVal: string, points: StrokePoint[], color = '#000', width = 2) => {
      const existing = strokesRef.current.get(strokeId)
      const merged = existing
        ? { ...existing, points: [...existing.points, ...points] }
        : { clientId: clientIdVal, points: [...points], color, width }
      strokesRef.current.set(strokeId, merged)
      if (!strokeOrderRef.current.includes(strokeId)) strokeOrderRef.current.push(strokeId)
      redrawAll()
    },
    [redrawAll]
  )

  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0 || !currentStrokeRef.current) return
    const points = smoothPoints([...bufferRef.current])
    addStrokePoints(currentStrokeRef.current, clientId, points)
    broadcast(roomId, {
      type: 'STROKE_POINTS',
      roomId,
      clientId,
      strokeId: currentStrokeRef.current,
      timestamp: Date.now(),
      points,
    })
    bufferRef.current = []
  }, [roomId, clientId, addStrokePoints])

  const getCanvasPoint = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return null
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

  // Handle incoming strokes from realtime stub
  useEffect(() => {
    return subscribe(roomId, (msg: StrokeMessage) => {
      const canvas = canvasRef.current
      if (!canvas || msg.clientId === clientId) return

      if (msg.type === 'STROKE_START') {
        onAriaAnnounce?.('Whiteboard connected from iPad')
      }
      if (msg.type === 'STROKE_POINTS' && msg.points?.length && msg.strokeId) {
        addStrokePoints(msg.strokeId, msg.clientId, msg.points, msg.color ?? '#000', (msg.width ?? 2) * 2)
      }
      if (msg.type === 'STROKE_UNDO' && msg.strokeId) {
        strokesRef.current.delete(msg.strokeId)
        strokeOrderRef.current = strokeOrderRef.current.filter((id) => id !== msg.strokeId)
        redrawAll()
      }
      if (msg.type === 'WHITEBOARD_CLEAR') {
        strokesRef.current.clear()
        strokeOrderRef.current = []
        redrawAll()
        onAriaAnnounce?.('Whiteboard cleared')
      }
    })
  }, [roomId, clientId, addStrokePoints, redrawAll, onAriaAnnounce])

  // Resize canvas
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        redrawAll()
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [redrawAll])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== 'draw') return
      e.preventDefault()
      const pt = getCanvasPoint(e)
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
      })
      bufferRef.current = [pt]
    },
    [mode, roomId, clientId, getCanvasPoint]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current || mode !== 'draw') return
      const pt = getCanvasPoint(e)
      if (!pt) return
      bufferRef.current.push(pt)
      if (bufferRef.current.length >= BATCH_MAX_POINTS) {
        flushBuffer()
      } else if (!batchTimerRef.current) {
        batchTimerRef.current = setTimeout(() => {
          batchTimerRef.current = null
          flushBuffer()
        }, BATCH_MS)
      }
    },
    [mode, getCanvasPoint, flushBuffer]
  )

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
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
    },
    [roomId, clientId, flushBuffer]
  )

  const handlePointerCancel = useCallback((_e: React.PointerEvent) => {
    isDrawingRef.current = false
    bufferRef.current = []
    currentStrokeRef.current = null
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current)
      batchTimerRef.current = null
    }
  }, [])

  const exportPng = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.download = `whiteboard-${Date.now()}.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
    onAriaAnnounce?.('Whiteboard exported as PNG')
  }, [onAriaAnnounce])

  useImperativeHandle(ref, () => ({
    exportPng,
    toggleDrawMode: () => onModeChange(mode === 'draw' ? 'screen-share' : 'draw'),
  }), [mode, onModeChange, exportPng])

  const undoLastStroke = useCallback(() => {
    const mine = strokeOrderRef.current.filter((id) => strokesRef.current.get(id)?.clientId === clientId)
    const lastId = mine[mine.length - 1]
    if (!lastId) return
    strokesRef.current.delete(lastId)
    strokeOrderRef.current = strokeOrderRef.current.filter((id) => id !== lastId)
    broadcast(roomId, { type: 'STROKE_UNDO', roomId, clientId, strokeId: lastId, timestamp: Date.now() })
    redrawAll()
    onAriaAnnounce?.('Stroke undone')
  }, [roomId, clientId, redrawAll, onAriaAnnounce])

  useEffect(() => {
    strokesRef.current.clear()
    strokeOrderRef.current = []
  }, [roomId])

  const clearBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    strokesRef.current.clear()
    strokeOrderRef.current = []
    redrawAll()
    broadcast(roomId, {
      type: 'WHITEBOARD_CLEAR',
      roomId,
      clientId,
      timestamp: Date.now(),
    })
    onAriaAnnounce?.('Whiteboard cleared')
  }, [roomId, clientId, redrawAll, onAriaAnnounce])

  const toggleMode = useCallback(() => {
    const next = mode === 'draw' ? 'screen-share' : 'draw'
    onModeChange(next)
    onAriaAnnounce?.(next === 'draw' ? 'Drawing mode' : 'Screen share mode')
  }, [mode, onModeChange, onAriaAnnounce])

  return (
    <div className="whiteboard-panel" ref={containerRef}>
      {sharedPersonalWb && (
        <div className="whiteboard-shared-personal-banner">
          <span>
            Personal board shared by {sharedPersonalWb.ownerName} — {sharedPersonalWb.mode === 'view-only' ? 'View-only' : 'Collaborative'}
          </span>
          <div className="whiteboard-shared-banner-actions">
            {sharedPersonalWb.mode === 'collaborative' && onRequestControl && localUserId && (
              <button
                type="button"
                className="whiteboard-request-control-btn"
                onClick={() => onRequestControl(sharedPersonalWb.ownerId)}
                aria-label="Request control to draw"
              >
                Request Control
              </button>
            )}
            <button
              type="button"
              className="whiteboard-stop-viewing-btn"
              onClick={onStopViewingShared}
              aria-label="Stop viewing shared whiteboard"
            >
              Stop Viewing
            </button>
          </div>
        </div>
      )}
      {sharedPersonalWb && (
        <div className="whiteboard-shared-overlay">
          <canvas
            ref={sharedOverlayRef}
            className="whiteboard-shared-canvas"
            width={320}
            height={240}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      )}
      {screenStream && mode === 'screen-share' && (
        <div className="whiteboard-share-view">
          <ScreenShareVideo stream={screenStream} />
          <span className="share-owner-chip">Shared by You</span>
        </div>
      )}
      {mode === 'draw' && (
        <canvas
          ref={canvasRef}
          className="whiteboard-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{ touchAction: 'none' }}
          aria-label="Whiteboard drawing area"
        />
      )}
      <div className="whiteboard-toolbar" role="toolbar" aria-label="Whiteboard tools">
        <button
          type="button"
          onClick={toggleMode}
          className="toolbar-btn"
          aria-label="Toggle draw mode"
          title="Toggle draw mode (D)"
        >
          {mode === 'draw' ? '📺 Screen Share' : '✏️ Draw'}
        </button>
        <button
          type="button"
          onClick={exportPng}
          className="toolbar-btn"
          aria-label="Export whiteboard as PNG"
          title="Export PNG (E)"
        >
          Export PNG
        </button>
        <button
          type="button"
          onClick={undoLastStroke}
          className="toolbar-btn"
          aria-label="Undo last stroke"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={clearBoard}
          className="toolbar-btn"
          aria-label="Clear whiteboard"
        >
          Clear
        </button>
      </div>
    </div>
  )
})

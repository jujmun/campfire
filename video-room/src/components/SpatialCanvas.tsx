import { useCallback, useEffect, useRef, useState } from 'react'
import { realtime } from '../lib/realtime'
import { setPeerPosition } from '../lib/audioSpatializer'
import { Avatar } from './Avatar'
import type { SpatialParticipant } from '../types'
import type { MoveEvent } from '../lib/realtimeStub'

const CANVAS_W = 700
const CANVAS_H = 1600
const AVATAR_R = 96
const MOVE_RATE = 4
const SEND_INTERVAL_MS = 1000 / 15 // 15Hz
const ENTER_RADIUS = 120
const EXIT_RADIUS = 140

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, t)
}

export interface SpatialCanvasProps {
  roomId: string
  localUserId: string
  localName?: string
  participants: Map<string, SpatialParticipant>
  onParticipantsChange: (p: Map<string, SpatialParticipant>) => void
  onProximityEnter?: (clusterId: string, members: string[]) => void
  onProximityExit?: () => void
  /** Called whenever the set of nearby members changes (including transitions between people) */
  onProximityChange?: (nearbyIds: string[]) => void
  onAriaAnnounce?: (text: string) => void
  personalWbOpen?: boolean
  personalWbAutoShare?: boolean
  personalWbSharing?: boolean
  onOpenPersonalWb?: () => void
}

export function SpatialCanvas({
  roomId,
  localUserId,
  participants,
  onParticipantsChange,
  onProximityEnter,
  onProximityExit,
  onProximityChange,
  onAriaAnnounce,
  personalWbOpen,
  personalWbAutoShare,
  personalWbSharing,
  onOpenPersonalWb,
}: SpatialCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [clickRipples, setClickRipples] = useState<Array<{ id: number; x: number; y: number }>>([])
  const rippleIdRef = useRef(0)
  const remoteTargets = useRef<Map<string, { x: number; y: number; ts: number }>>(new Map())
  const lastSendRef = useRef(0)
  const keysRef = useRef<Set<string>>(new Set())
  const proximityClustersRef = useRef<Map<string, Set<string>>>(new Map())

  const getLocalParticipant = useCallback((): SpatialParticipant | undefined => {
    return participants.get(localUserId)
  }, [participants, localUserId])

  const setLocalPosition = useCallback(
    (x: number, y: number) => {
      const local = getLocalParticipant()
      if (!local) return
      const nx = Math.max(AVATAR_R, Math.min(CANVAS_W - AVATAR_R, x))
      const ny = Math.max(AVATAR_R, Math.min(CANVAS_H - AVATAR_R, y))
      const updated = new Map(participants)
      updated.set(localUserId, { ...local, x: nx, y: ny })
      onParticipantsChange(updated)
      const now = Date.now()
      if (now - lastSendRef.current >= SEND_INTERVAL_MS) {
        lastSendRef.current = now
        realtime.send(roomId, {
          type: 'MOVE',
          roomId,
          userId: localUserId,
          x: nx,
          y: ny,
          timestamp: now,
        })
      }
    },
    [participants, localUserId, getLocalParticipant, roomId, onParticipantsChange]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (['arrowup', 'w', 'arrowdown', 's', 'arrowleft', 'a', 'arrowright', 'd'].includes(key)) {
        e.preventDefault()
        keysRef.current.add(key)
      }
    },
    []
  )

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase())
    },
    []
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  useEffect(() => {
    const interval = setInterval(() => {
      const local = getLocalParticipant()
      if (!local) return
      const keys = keysRef.current
      let dx = 0,
        dy = 0
      if (keys.has('arrowup') || keys.has('w')) dy -= MOVE_RATE
      if (keys.has('arrowdown') || keys.has('s')) dy += MOVE_RATE
      if (keys.has('arrowleft') || keys.has('a')) dx -= MOVE_RATE
      if (keys.has('arrowright') || keys.has('d')) dx += MOVE_RATE
      if (dx !== 0 || dy !== 0) {
        setLocalPosition(local.x + dx, local.y + dy)
      }
    }, 16)
    return () => clearInterval(interval)
  }, [getLocalParticipant, setLocalPosition])

  const screenToCanvas = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * CANVAS_W
    const y = ((clientY - rect.top) / rect.height) * CANVAS_H
    return { x, y }
  }, [])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const local = getLocalParticipant()
      if (!local) return
      const { x, y } = screenToCanvas(e.clientX, e.clientY, rect)
      const id = ++rippleIdRef.current
      setClickRipples((prev) => [...prev.slice(-4), { id, x, y }])
      setTimeout(() => setClickRipples((prev) => prev.filter((r) => r.id !== id)), 600)
      setLocalPosition(x, y)
    },
    [getLocalParticipant, setLocalPosition, screenToCanvas]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const local = getLocalParticipant()
      if (!local || !local.isLocal) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      e.preventDefault()
      const { x, y } = screenToCanvas(e.clientX, e.clientY, rect)
      const id = ++rippleIdRef.current
      setClickRipples((prev) => [...prev.slice(-4), { id, x, y }])
      setTimeout(() => setClickRipples((prev) => prev.filter((r) => r.id !== id)), 600)
      const avatarCenterScreenX = rect.left + (local.x / CANVAS_W) * rect.width
      const avatarCenterScreenY = rect.top + (local.y / CANVAS_H) * rect.height
      const offsetX = e.clientX - avatarCenterScreenX
      const offsetY = e.clientY - avatarCenterScreenY
      const onMove = (ev: PointerEvent) => {
        const r = containerRef.current?.getBoundingClientRect()
        if (!r) return
        const cx = ((ev.clientX - offsetX - r.left) / r.width) * CANVAS_W
        const cy = ((ev.clientY - offsetY - r.top) / r.height) * CANVAS_H
        setLocalPosition(cx, cy)
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [getLocalParticipant, setLocalPosition, screenToCanvas]
  )

  useEffect(() => {
    const unsub = realtime.on(roomId, (event) => {
      if (event.type === 'MOVE') {
        const ev = event as MoveEvent
        if (ev.userId === localUserId) return
        remoteTargets.current.set(ev.userId, { x: ev.x, y: ev.y, ts: ev.timestamp })
        const updated = new Map(participants)
        const existing = updated.get(ev.userId)
        updated.set(ev.userId, {
          ...(existing ?? { id: ev.userId, name: ev.userId.slice(0, 8), x: ev.x, y: ev.y }),
          x: ev.x,
          y: ev.y,
          vx: ev.vx,
          vy: ev.vy,
        })
        onParticipantsChange(updated)
      }
    })
    return unsub
  }, [roomId, localUserId, participants, onParticipantsChange])

  useEffect(() => {
    let raf = 0
    const interpolate = () => {
      const updated = new Map(participants)
      let changed = false
      const local = participants.get(localUserId)
      remoteTargets.current.forEach((target, userId) => {
        if (userId === localUserId) return
        const p = updated.get(userId)
        if (!p) return
        const t = 0.15
        const nx = lerp(p.x, target.x, t)
        const ny = lerp(p.y, target.y, t)
        if (Math.abs(nx - p.x) > 0.5 || Math.abs(ny - p.y) > 0.5) {
          updated.set(userId, { ...p, x: nx, y: ny })
          changed = true
        }
      })
      if (changed) onParticipantsChange(updated)
      if (local) {
        participants.forEach((p, userId) => {
          if (userId !== localUserId) setPeerPosition(userId, local.x, local.y, p.x, p.y)
        })
      }
      raf = requestAnimationFrame(interpolate)
    }
    raf = requestAnimationFrame(interpolate)
    return () => cancelAnimationFrame(raf)
  }, [participants, localUserId, onParticipantsChange])

  const proximityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastProximityEnterRef = useRef(0)
  const lastNearbyRef = useRef<string[]>([])

  useEffect(() => {
    const members = Array.from(participants.keys()).filter((id) => id !== localUserId)
    const local = getLocalParticipant()
    if (!local) return

    const nearbyIds = members.filter((id) => {
      const p = participants.get(id)
      if (!p) return false
      const d = Math.hypot(local.x - p.x, local.y - p.y)
      return d <= ENTER_RADIUS
    })

    onProximityChange?.(nearbyIds)

    const prevNearby = lastNearbyRef.current
    const prevSet = new Set(prevNearby)
    const currSet = new Set(nearbyIds)
    lastNearbyRef.current = nearbyIds

    if (members.length === 0) return

    const pairs: Array<{ a: string; b: string; d: number }> = []
    members.forEach((id) => {
      const p = participants.get(id)
      if (!p) return
      const d = Math.hypot(local.x - p.x, local.y - p.y)
      if (d <= EXIT_RADIUS) pairs.push({ a: localUserId, b: id, d })
    })
    const inRadius = new Set(pairs.filter((p) => p.d <= ENTER_RADIUS).flatMap((p) => [p.a, p.b]))

    if (inRadius.size > 0) {
      proximityDebounceRef.current = setTimeout(() => {
        proximityDebounceRef.current = null
        if (Date.now() - lastProximityEnterRef.current < 250) return
        lastProximityEnterRef.current = Date.now()
        const clusterId = [localUserId, ...members.filter((m) => inRadius.has(m))].sort().join('-')
        const prev = proximityClustersRef.current.get(clusterId)
        if (!prev || prev.size === 0) {
          proximityClustersRef.current.set(clusterId, new Set([...members.filter((m) => inRadius.has(m)), localUserId]))
          onProximityEnter?.(clusterId, [localUserId, ...members.filter((m) => inRadius.has(m))])
          const names = members.filter((m) => inRadius.has(m)).map((m) => participants.get(m)?.name ?? m)
          if (names.length) onAriaAnnounce?.(`Private audio connected with ${names.join(', ')}`)
        }
      }, 250)
    }

    const leftEveryone = prevSet.size > 0 && currSet.size === 0
    if (leftEveryone) {
      if (proximityDebounceRef.current) {
        clearTimeout(proximityDebounceRef.current)
        proximityDebounceRef.current = null
      }
      proximityClustersRef.current.clear()
      onProximityExit?.()
    }
    return () => {
      if (proximityDebounceRef.current) clearTimeout(proximityDebounceRef.current)
    }
  }, [participants, localUserId, getLocalParticipant, onProximityEnter, onProximityExit, onProximityChange, onAriaAnnounce])

  const proximitySet = new Set<string>()
  participants.forEach((_, id) => {
    if (id !== localUserId) {
      const p = participants.get(id)!
      const local = getLocalParticipant()
      if (local) {
        const d = Math.hypot(local.x - p.x, local.y - p.y)
        if (d <= ENTER_RADIUS) proximitySet.add(id)
      }
    }
  })

  return (
    <div
      ref={containerRef}
      className="spatial-canvas"
      style={{ width: CANVAS_W, height: CANVAS_H }}
      onClick={handleCanvasClick}
      onPointerDown={handlePointerDown}
      role="application"
      aria-label="Spatial room - use arrow keys or WASD to move, click to move avatar"
      tabIndex={0}
    >
      <div className="spatial-floor" />
      {participants.get(localUserId) && (
        <div
          className="spatial-proximity-ring"
          style={{
            left: participants.get(localUserId)!.x - ENTER_RADIUS,
            top: participants.get(localUserId)!.y - ENTER_RADIUS,
            width: ENTER_RADIUS * 2,
            height: ENTER_RADIUS * 2,
          }}
          aria-hidden
        />
      )}
      {clickRipples.map((r) => (
        <div
          key={r.id}
          className="spatial-click-ripple"
          style={{ left: r.x, top: r.y }}
          aria-hidden
        />
      ))}
      {Array.from(participants.values()).map((p) => (
        <Avatar
          key={p.id}
          participant={p}
          isInProximity={proximitySet.has(p.id)}
          isConnecting={false}
          size={AVATAR_R * 2}
          hasPersonalWbOpen={p.isLocal ? personalWbOpen : undefined}
          autoShareOn={p.isLocal ? personalWbAutoShare : undefined}
          isSharingWb={p.isLocal ? personalWbSharing : undefined}
          onOpenPersonalWb={p.isLocal ? onOpenPersonalWb : undefined}
        />
      ))}
    </div>
  )
}

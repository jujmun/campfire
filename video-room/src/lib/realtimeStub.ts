/**
 * Realtime stub for movement, proximity, strokes, and control events.
 *
 * Uses BroadcastChannel for same-origin tab sync (single-machine demo).
 * Fallback: postMessage to same-origin windows if BroadcastChannel unavailable.
 *
 * TODO: Replace with WebSocket or WebRTC DataChannel for production.
 * Example: ws.send(JSON.stringify(event)); ws.onmessage = (e) => handlers.forEach(h => h(JSON.parse(e.data)));
 */

// ─── Event types ─────────────────────────────────────────────────────────────

export type RealtimeEvent =
  | JoinRoomEvent
  | MoveEvent
  | ProximityEnterEvent
  | ProximityExitEvent
  | StrokeEvent
  | StrokeUndoEvent
  | WhiteboardClearEvent
  | ScreenShareEvent
  | PersonalWbEvent

export interface JoinRoomEvent {
  type: 'JOIN_ROOM'
  roomId: string
  userId: string
  name: string
  avatarUrl?: string
  timestamp: number
}

export interface MoveEvent {
  type: 'MOVE'
  roomId: string
  userId: string
  x: number
  y: number
  vx?: number
  vy?: number
  timestamp: number
}

export interface ProximityEnterEvent {
  type: 'PROXIMITY_ENTER'
  roomId: string
  clusterId: string
  members: string[]
  timestamp: number
}

export interface ProximityExitEvent {
  type: 'PROXIMITY_EXIT'
  roomId: string
  clusterId: string
  members: string[]
  timestamp: number
}

export interface StrokeEvent {
  type: 'STROKE_START' | 'STROKE_POINTS' | 'STROKE_END'
  roomId: string
  clientId: string
  strokeId?: string
  seqId?: number
  timestamp: number
  color?: string
  width?: number
  points?: Array<{ x: number; y: number; pressure?: number }>
}

export interface WhiteboardClearEvent {
  type: 'WHITEBOARD_CLEAR'
  roomId: string
  clientId: string
  timestamp: number
}

export interface StrokeUndoEvent {
  type: 'STROKE_UNDO'
  roomId: string
  clientId: string
  strokeId: string
  timestamp: number
}

export interface ScreenShareEvent {
  type: 'SCREEN_SHARE_START' | 'SCREEN_SHARE_STOP'
  roomId: string
  userId: string
  timestamp: number
}

// Personal whiteboard events (demo: BroadcastChannel; TODO: WebSocket/DataChannel for production)
export type PersonalWbEvent =
  | PersonalWbOpenEvent
  | PersonalWbCloseEvent
  | PersonalWbStrokeEvent
  | PersonalWbShareStartEvent
  | PersonalWbShareStopEvent
  | PersonalWbSharedEvent
  | PersonalWbPermissionRequestEvent
  | PersonalWbPermissionGrantEvent
  | PersonalWbPermissionDenyEvent
  | PersonalWbViewRequestEvent

export interface PersonalWbOpenEvent {
  type: 'PERSONAL_WB_OPEN'
  roomId: string
  ownerId: string
  ownerName?: string
  timestamp: number
}

export interface PersonalWbCloseEvent {
  type: 'PERSONAL_WB_CLOSE'
  roomId: string
  ownerId: string
  timestamp: number
}

export interface PersonalWbStrokeEvent {
  type: 'PERSONAL_WB_STROKE'
  roomId: string
  ownerId: string
  strokeId?: string
  seqId?: number
  timestamp: number
  color?: string
  width?: number
  points?: Array<{ x: number; y: number; pressure?: number }>
}

export interface PersonalWbShareStartEvent {
  type: 'PERSONAL_WB_SHARE_START'
  roomId: string
  ownerId: string
  ownerName?: string
  targetIds: string[]
  clusterId?: string
  mode: 'view-only' | 'collaborative'
  token?: string
  timestamp: number
}

export interface PersonalWbShareStopEvent {
  type: 'PERSONAL_WB_SHARE_STOP'
  roomId: string
  ownerId: string
  targetIds?: string[]
  timestamp: number
}

export interface PersonalWbSharedEvent {
  type: 'PERSONAL_WB_SHARED'
  roomId: string
  ownerId: string
  ownerName?: string
  targetIds: string[]
  mode: 'view-only' | 'collaborative'
  timestamp: number
}

export interface PersonalWbPermissionRequestEvent {
  type: 'PERSONAL_WB_PERMISSION_REQUEST'
  roomId: string
  ownerId: string
  requesterId: string
  requesterName?: string
  timestamp: number
}

export interface PersonalWbPermissionGrantEvent {
  type: 'PERSONAL_WB_PERMISSION_GRANT'
  roomId: string
  ownerId: string
  requesterId: string
  timestamp: number
}

export interface PersonalWbPermissionDenyEvent {
  type: 'PERSONAL_WB_PERMISSION_DENY'
  roomId: string
  ownerId: string
  requesterId: string
  timestamp: number
}

export interface PersonalWbViewRequestEvent {
  type: 'PERSONAL_WB_VIEW_REQUEST'
  roomId: string
  requesterId: string
  requesterName?: string
  ownerId: string
  timestamp: number
}

// ─── Stroke helpers (backwards compat) ───────────────────────────────────────

export type StrokeMessage = StrokeEvent | StrokeUndoEvent | WhiteboardClearEvent

export function subscribe(roomId: string, handler: (msg: StrokeMessage) => void): () => void {
  return realtimeStub.on(roomId, (e) => {
    if (e.type?.startsWith('STROKE_') || e.type === 'WHITEBOARD_CLEAR') handler(e as StrokeMessage)
  })
}

export function broadcast(
  roomId: string,
  msg:
    | Omit<StrokeEvent, 'seqId'>
    | Omit<StrokeUndoEvent, 'seqId'>
    | Omit<WhiteboardClearEvent, 'seqId'>
): void {
  const withSeq = 'seqId' in msg ? msg : { ...msg, seqId: ++seqCounter }
  realtimeStub.send(roomId, withSeq as RealtimeEvent)
}

let seqCounter = 0

// ─── Main stub API ───────────────────────────────────────────────────────────

type EventHandler = (event: RealtimeEvent) => void

const CHANNEL_PREFIX = 'gather-room-'

function getChannelName(roomId: string): string {
  return `${CHANNEL_PREFIX}${roomId}`
}

class RealtimeStubImpl {
  private bc: BroadcastChannel | null = null
  private handlers = new Set<EventHandler>()

  join(room: string): void {
    this.leave()
    try {
      this.bc = new BroadcastChannel(getChannelName(room))
      this.bc.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data) as RealtimeEvent
          this.handlers.forEach((h) => h(ev))
        } catch {}
      }
    } catch {
      // Fallback: BroadcastChannel not supported (e.g. old Safari)
      // TODO: Use postMessage to parent/opener or localStorage events
      console.warn('BroadcastChannel not available; realtime sync disabled')
    }
  }

  leave(): void {
    this.bc?.close()
    this.bc = null
  }

  send(roomId: string, event: RealtimeEvent | Omit<RealtimeEvent, 'roomId'>): void {
    const ev = { ...event, roomId: (event as RealtimeEvent).roomId ?? roomId } as RealtimeEvent
    try {
      const bc = new BroadcastChannel(getChannelName(roomId))
      bc.postMessage(JSON.stringify(ev))
      bc.close()
    } catch {}
  }

  on(_roomId: string, handler: EventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
}

export const realtimeStub = new RealtimeStubImpl()

// ─── Id generation ───────────────────────────────────────────────────────────

export function generateClientId(): string {
  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function generateStrokeId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

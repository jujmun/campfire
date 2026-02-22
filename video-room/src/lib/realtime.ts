/**
 * Realtime transport for Campfire.
 * Uses WebSocket when VITE_WS_URL is set, otherwise BroadcastChannel (same-tab demo).
 */

import {
  realtimeStub,
  generateClientId as _generateClientId,
  generateStrokeId as _generateStrokeId,
} from './realtimeStub'
import type {
  RealtimeEvent,
  StrokeMessage,
  StrokeEvent,
  StrokeUndoEvent,
  WhiteboardClearEvent,
} from './realtimeStub'
import { createRealtimeWs } from './realtimeWs'

const wsUrl = import.meta.env.VITE_WS_URL as string | undefined
export const realtime = wsUrl ? createRealtimeWs(wsUrl) : realtimeStub

// Re-export id generators
export const generateClientId = _generateClientId
export const generateStrokeId = _generateStrokeId

// Re-export types
export type {
  RealtimeEvent,
  StrokeMessage,
  JoinRoomEvent,
  MoveEvent,
  ProximityEnterEvent,
  ProximityExitEvent,
  StrokeEvent,
  WhiteboardClearEvent,
  StrokeUndoEvent,
  ScreenShareEvent,
  PersonalWbEvent,
  PersonalWbStrokeEvent,
  PersonalWbShareStartEvent,
  PersonalWbShareStopEvent,
  PersonalWbSharedEvent,
  PersonalWbViewRequestEvent,
} from './realtimeStub'

let seqCounter = 0

export function subscribe(roomId: string, handler: (msg: StrokeMessage) => void): () => void {
  return realtime.on(roomId, (e) => {
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
  realtime.send(roomId, withSeq as RealtimeEvent)
}

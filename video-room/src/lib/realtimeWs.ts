/**
 * WebSocket-backed realtime transport for Campfire.
 * Implements the same API as realtimeStub for network sync across devices.
 */

import type { RealtimeEvent } from './realtimeStub'

type EventHandler = (event: RealtimeEvent) => void

export class RealtimeWsImpl {
  private ws: WebSocket | null = null
  private wsUrl: string
  private currentRoom: string | null = null
  private handlers = new Set<EventHandler>()
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl.replace(/^http/, 'ws')
  }

  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return
    try {
      this.ws = new WebSocket(this.wsUrl)
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string)
          if (msg.type === 'event' && msg.event) {
            const ev = msg.event as RealtimeEvent
            this.handlers.forEach((h) => h(ev))
          }
        } catch {
          /* ignore */
        }
      }
      this.ws.onopen = () => {
        if (this.currentRoom) {
          this.ws?.send(JSON.stringify({ type: 'subscribe', roomId: this.currentRoom }))
        }
      }
      this.ws.onclose = () => {
        if (this.currentRoom && !this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null
            this.connect()
          }, 2000)
        }
      }
      this.ws.onerror = () => {
        /* handled by onclose */
      }
    } catch {
      console.warn('WebSocket connection failed; realtime sync disabled')
    }
  }

  join(room: string): void {
    this.leave()
    this.currentRoom = room
    this.connect()
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', roomId: room }))
    }
  }

  leave(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    this.currentRoom = null
    this.ws?.close()
    this.ws = null
  }

  send(roomId: string, event: RealtimeEvent | Omit<RealtimeEvent, 'roomId'>): void {
    const ev = { ...event, roomId: (event as RealtimeEvent).roomId ?? roomId } as RealtimeEvent
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'event', event: ev }))
    }
  }

  on(_roomId: string, handler: EventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
}

export function createRealtimeWs(wsUrl: string): RealtimeWsImpl {
  return new RealtimeWsImpl(wsUrl)
}

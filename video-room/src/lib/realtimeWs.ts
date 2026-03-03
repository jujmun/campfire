/**
 * WebSocket-backed realtime transport for Campfire.
 * Implements the same API as realtimeStub for network sync across devices.
 */

import type { RealtimeEvent } from './realtimeStub'

type EventHandler = (event: RealtimeEvent) => void

export type RealtimeWsConnectionState = 'connecting' | 'open' | 'closed'

export class RealtimeWsImpl {
  private ws: WebSocket | null = null
  private wsUrl: string
  private currentRoom: string | null = null
  private handlers = new Set<EventHandler>()
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private _connectionState: RealtimeWsConnectionState = 'closed'
  private connectionStateListeners = new Set<(state: RealtimeWsConnectionState) => void>()
  private pendingMessages: string[] = []
  private hasSubscribed: boolean = false

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl.replace(/^http/, 'ws')
  }

  private setConnectionState(state: RealtimeWsConnectionState): void {
    if (this._connectionState === state) return
    this._connectionState = state
    this.connectionStateListeners.forEach((fn) => fn(state))
  }

  getConnectionState(): RealtimeWsConnectionState {
    if (this.ws == null) return this._connectionState
    if (this.ws.readyState === WebSocket.OPEN) return 'open'
    if (this.ws.readyState === WebSocket.CONNECTING) return 'connecting'
    return 'closed'
  }

  onConnectionStateChange(fn: (state: RealtimeWsConnectionState) => void): () => void {
    this.connectionStateListeners.add(fn)
    fn(this.getConnectionState())
    return () => this.connectionStateListeners.delete(fn)
  }

  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.setConnectionState('connecting')
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
        this.setConnectionState('open')
        if (this.currentRoom) {
          this.ws?.send(JSON.stringify({ type: 'subscribe', roomId: this.currentRoom }))
          this.hasSubscribed = true
          // Flush any queued events that were sent before the socket opened.
          const queued = this.pendingMessages
          this.pendingMessages = []
          queued.forEach((m) => {
            if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(m)
          })
        }
      }
      this.ws.onclose = () => {
        this.setConnectionState('closed')
        this.hasSubscribed = false
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
      this.setConnectionState('closed')
      console.warn('WebSocket connection failed; realtime sync disabled')
    }
  }

  join(room: string): void {
    this.leave()
    this.currentRoom = room
    this.hasSubscribed = false
    this.connect()
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', roomId: room }))
      this.hasSubscribed = true
    }
  }

  leave(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    this.currentRoom = null
    this.hasSubscribed = false
    this.pendingMessages = []
    this.ws?.close()
    this.ws = null
    this.setConnectionState('closed')
  }

  send(roomId: string, event: RealtimeEvent | Omit<RealtimeEvent, 'roomId'>): void {
    const ev = { ...event, roomId: (event as RealtimeEvent).roomId ?? roomId } as RealtimeEvent
    const payload = JSON.stringify({ type: 'event', event: ev })

    // Important: on initial page load, JOIN_ROOM is often fired before the WebSocket is open
    // or before we've subscribed to the room. Queue until connected + subscribed.
    if (this.ws?.readyState === WebSocket.OPEN && this.hasSubscribed) {
      this.ws.send(payload)
      return
    }

    // Keep queue bounded to avoid unbounded growth if offline.
    if (this.pendingMessages.length > 200) this.pendingMessages.shift()
    this.pendingMessages.push(payload)
  }

  on(_roomId: string, handler: EventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
}

export function createRealtimeWs(wsUrl: string): RealtimeWsImpl {
  return new RealtimeWsImpl(wsUrl)
}

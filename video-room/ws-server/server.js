/**
 * Campfire WebSocket server.
 * Accepts connections, routes events by roomId, broadcasts to all clients in room.
 *
 * Protocol:
 * - Client sends { type: 'subscribe', roomId } to join a room
 * - Client sends { type: 'event', event } to broadcast an event to room
 * - Server sends { type: 'event', event } to all clients subscribed to that room
 *
 * HTTP GET / or /health returns 200 for platform health checks (Railway, Render).
 */

import { createServer } from 'http'
import { WebSocketServer } from 'ws'

const PORT = process.env.PORT || 8787
const httpServer = createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'campfire-ws' }))
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server: httpServer })

/** Map roomId -> Set of WebSocket clients */
const rooms = new Map()

function getRoom(roomId) {
  let set = rooms.get(roomId)
  if (!set) {
    set = new Set()
    rooms.set(roomId, set)
  }
  return set
}

function subscribe(client, roomId) {
  if (!client.rooms) client.rooms = new Set()
  client.rooms.add(roomId)
  getRoom(roomId).add(client)
}

function unsubscribe(client) {
  if (!client.rooms) return
  for (const roomId of client.rooms) {
    const room = rooms.get(roomId)
    if (room) {
      room.delete(client)
      if (room.size === 0) rooms.delete(roomId)
    }
  }
  client.rooms.clear()
}

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'subscribe' && msg.roomId) {
        subscribe(ws, msg.roomId)
      } else if (msg.type === 'event' && msg.event) {
        const ev = msg.event
        const roomId = ev.roomId
        if (!roomId) return
        const room = rooms.get(roomId)
        if (!room) return
        const payload = JSON.stringify({ type: 'event', event: ev })
        for (const client of room) {
          if (client.readyState === 1) client.send(payload)
        }
      }
    } catch {
      // ignore parse errors
    }
  })

  ws.on('close', () => unsubscribe(ws))
  ws.on('error', () => unsubscribe(ws))
})

httpServer.listen(PORT, () => {
  console.log(`Campfire WebSocket server on ws://localhost:${PORT}`)
})

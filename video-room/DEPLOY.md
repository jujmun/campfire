# Deploy Campfire for Multi-User Access

This guide walks through deploying Campfire so others can join rooms over the internet.

## Prerequisites

- Both frontend and WebSocket server must be reachable from the internet
- Frontend must be **HTTPS** (required for camera/microphone access)
- WebSocket must use **WSS** (browsers block `ws://` on HTTPS pages)
- `VITE_WS_URL` is read at **build time** — set it before `npm run build`

## What Syncs Across Users

- Avatars, movement, JOIN_ROOM, MOVE events
- Whiteboard strokes (shared + personal)
- Proximity events, personal whiteboard sharing

## What Does Not Sync (No WebRTC Yet)

- Video/audio streams — each user sees only their own camera. Remote participants appear as avatars without video/audio.

---

## Option A: Vercel + Railway

### 1. Deploy WebSocket Server (Railway)

1. Create an account at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub (or upload `ws-server` folder)
3. Set root directory to `video-room/ws-server` (or deploy from a repo that has it)
4. Railway sets `PORT` automatically; the server uses it
5. Deploy and note the URL (e.g. `https://your-app.up.railway.app`)
6. WebSocket URL: change `https` → `wss`, e.g. `wss://your-app.up.railway.app`

### 2. Deploy Frontend (Vercel)

1. Create an account at [vercel.com](https://vercel.com)
2. Import project → set root to `video-room`
3. Add environment variable:
   - **Name:** `VITE_WS_URL`
   - **Value:** `wss://your-app.up.railway.app` (your Railway URL with wss)
4. Deploy

### 3. Share the Room URL

- `https://your-vercel-app.vercel.app/room/demo` (or any room ID)
- Others open this link to join the same room

---

## Option B: Netlify + Render

### 1. Deploy WebSocket Server (Render)

1. Create an account at [render.com](https://render.com)
2. New → Web Service
3. Connect repo, set root to `video-room/ws-server`
4. Build: `npm install` (or leave blank if no build step)
5. Start: `npm start`
6. Under "Advanced" → enable WebSockets
7. Deploy and note the URL (e.g. `https://campfire-ws.onrender.com`)
8. WebSocket URL: `wss://campfire-ws.onrender.com`

### 2. Deploy Frontend (Netlify)

1. Create an account at [netlify.com](https://netlify.com)
2. Add new site → Import from Git
3. Set base directory to `video-room`
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Add environment variable:
   - **Key:** `VITE_WS_URL`
   - **Value:** `wss://your-render-app.onrender.com`
7. Deploy

---

## Option C: Single VPS (DigitalOcean, Fly.io, etc.)

1. **Build frontend** locally:
   ```bash
   VITE_WS_URL=wss://your-domain.com npm run build
   ```
2. **Serve static files** from `dist/` via nginx or Caddy
3. **Run WebSocket server** (e.g. `cd ws-server && node server.js`) via systemd or PM2
4. **Reverse proxy** with SSL (e.g. Let's Encrypt) — use same domain or a subdomain for the WebSocket server

---

## Local Build (Production)

For a manual deploy or to test the production build:

```bash
# Set your WebSocket URL (must use wss:// for HTTPS frontends)
VITE_WS_URL=wss://your-ws-host.example.com npm run build
```

Output is in `dist/`.

---

## Post-Deploy Checklist

| Check | Notes |
|-------|-------|
| Open room URL in two different browsers/devices | Both should see each other's avatars |
| Move avatar in one tab | Other tab sees movement |
| Draw on whiteboard | Strokes sync to other tab |
| Camera/mic permission | Works over HTTPS; each user sees only their own video |
| Copy room link | Share `https://your-app.com/room/demo` (or custom room ID) |

---

## Caveats

- **No auth** — Anyone with the room URL can join. Consider adding auth/tokens for production.
- **Ephemeral rooms** — Rooms exist only in memory; restarting the ws-server clears them.
- **Video/audio** — Not shared between users yet; would require WebRTC/SFU integration.

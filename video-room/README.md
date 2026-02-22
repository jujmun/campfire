# Gather-like Spatial Room — Base44 Layout

Frontend-only demo: 2D spatial room, proximity audio, personal whiteboard (auto-share on proximity), split-screen whiteboard, iPad connect.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — Room loads at `/`.

### Multi-user (different devices)

To sync across devices and networks, run the WebSocket server and point the client at it:

```bash
# Terminal 1: WebSocket server
cd ws-server && npm install && npm start

# Terminal 2: Frontend with WebSocket
VITE_WS_URL=ws://localhost:8787 npm run dev
```

Or add `VITE_WS_URL=ws://localhost:8787` to `.env` (copy from `.env.example`).

Then share the room URL (e.g. `http://localhost:5173/room/demo` or your deployed URL) with others. On same LAN, use your machine's IP (e.g. `http://192.168.1.x:5173/room/demo`) so others can connect.

### Production deployment

See [DEPLOY.md](DEPLOY.md) for deploying to Vercel + Railway, Netlify + Render, or a VPS.

## Demo Steps

### Two tabs — proximity & movement
1. **Tab A**: Open `http://localhost:5173/room/demo`
2. **Tab B**: Open `http://localhost:5173/room/demo`
3. Use **arrow keys** or **WASD** in Tab A to move your avatar.
4. Move avatars within **120px** → proximity visuals (blue glow) and ARIA: "Private audio connected with…"
5. Move away (>140px) → "Private audio disconnected…"

### Personal whiteboard — auto-share on proximity
1. **Tab A** (owner): Click the ✏️ button on your avatar to open **Personal Whiteboard**.
2. Draw locally; strokes stay on your client until you share.
3. Toggle **Auto-Share** ON.
4. Move Tab A avatar into proximity of Tab B avatar (within 120px).
5. After ~250ms debounce, Tab B automatically receives the owner's personal whiteboard in their WhiteboardPanel as a live overlay labelled "Shared by Sarah Chen".
6. Move away → Tab B unmounts the shared board.
7. **Manual share**: With Auto-Share OFF, when in proximity you get "Share whiteboard with [Name]?" → tap **Share** to share.
8. **Share Now** / **Stop Sharing**: Use buttons in Personal Whiteboard panel.
9. **Permission mode**: View-Only or Collaborative. When Collaborative, targets can request control (CONTROL_REQUEST flow).
10. **Host override**: Host can disable personal auto-shares globally via the ✏️/⛔ toggle in the header.

### Split-screen whiteboard
1. Click **Split** (or **Whiteboard** for full whiteboard).
2. **Screen share**: Click "Share Screen" → pick window → shared content appears in panel.
3. **Draw**: Switch to Draw mode, draw with mouse/pen. Strokes sync to other tabs via BroadcastChannel.
4. **Undo** (per stroke), **Clear**, **Export PNG**.

### iPad connect
1. Click **Connect iPad**.
2. Copy URL (e.g. `http://localhost:5173/ipad?token=ABC123&room=demo`).
3. Open in another tab or mobile device on same network.
4. Draw on iPad page → strokes appear in room whiteboard.

### Keyboard shortcuts
| Key | Action |
|-----|--------|
| Arrow / WASD | Move avatar |
| Space | Toggle mute |
| S | Toggle screen share |
| D | Toggle draw mode |
| E | Export PNG |
| I | Open iPad connect modal |

## Project Structure

```
src/
├── App.tsx
├── Layout.tsx          # Base44 layout wrapper
├── index.css           # Tailwind + tokens
├── pages/
│   ├── Room.tsx
│   ├── IpadPage.tsx
│   └── ipad.tsx        # Re-export
├── components/
│   ├── SpatialCanvas.tsx
│   ├── Avatar.tsx
│   ├── WhiteboardPanel.tsx
│   ├── PersonalWhiteboard.tsx   # Personal whiteboard (auto-share)
│   ├── IncomingSharePrompt.tsx  # Share / control-request prompts
│   ├── ScreenShareControls.tsx
│   └── IpadConnectModal.tsx
└── lib/
    ├── realtimeStub.ts
    ├── audioSpatializer.ts
    └── useLocalMedia.ts
```

## Developer Notes — Production Integration

1. **Realtime transport** — Replace `BroadcastChannel` in `src/lib/realtimeStub.ts` with WebSocket or WebRTC DataChannel. Add SFU control messages for media routing. See TODO comments in realtimeStub.

2. **Personal whiteboard persistence** — By default strokes are ephemeral and client-local. For production: persist strokes server-side (e.g. JSON stroke archive or DB), add tokenization for share tokens, sync initial state on PERSONAL_WB_SHARE_START.

3. **Personal whiteboard networking** — `PERSONAL_WB_*` events flow via BroadcastChannel in demo. Swap to WebSocket/DataChannel; server should route PERSONAL_WB_STROKE only to targetIds for efficiency.

4. **Audio/SFU** — `audioSpatializer.ts` uses local gain/pan. For production: wire WebRTC receive streams per peer, apply spatial gain/pan based on avatar positions.

5. **TURN/STUN** — Add TURN/STUN for NAT traversal when deploying. Configure in WebRTC peer connection setup.

6. **Signaling** — Use a signaling server (WebSocket) for SDP/ICE exchange instead of BroadcastChannel.

7. **Auth** — Add auth and room tokens. Validate tokens before join.

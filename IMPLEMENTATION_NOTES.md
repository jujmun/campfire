# Implementation Notes — Personal Whiteboard & Production

## Personal Whiteboard Feature

- **Proximity thresholds**: Enter = 120px, Exit = 140px (hysteresis). Defined in `SpatialCanvas.tsx`.
- **Auto-share debounce**: 200–300ms (250ms) before emitting `PERSONAL_WB_SHARE_START`.
- **Stroke sync**: When shared, owner's strokes are sent via `PERSONAL_WB_STROKE`; targets render in overlay canvas.
- **Control request flow**: Target clicks "Request Control" → `PERSONAL_WB_PERMISSION_REQUEST` → Owner sees prompt → Grant/Deny → `PERSONAL_WB_PERMISSION_GRANT` / `PERSONAL_WB_PERMISSION_DENY`.

## Where to Plug In Backend / Production

1. **Realtime transport** (`src/lib/realtimeStub.ts`): Replace `BroadcastChannel` with WebSocket or WebRTC DataChannel. Server routes events by `roomId`; for `PERSONAL_WB_STROKE` route only to `targetIds` to reduce bandwidth.

2. **SFU / media routing**: Add SFU control messages to `realtimeStub` for video/audio routing. Wire `audioSpatializer.ts` to WebRTC receive streams per peer.

3. **TURN/STUN**: Configure in WebRTC peer connection setup for NAT traversal. Required for production deployment across networks.

4. **Personal whiteboard persistence**: Strokes are currently ephemeral and client-local. For production:
   - Persist strokes server-side (e.g. JSON stroke archive or DB).
   - Add tokenization for share tokens.
   - On `PERSONAL_WB_SHARE_START`, server sends initial stroke sync (`PERSONAL_WB_STROKES_SYNC` or similar) to targets.

5. **Auth**: Add auth and room tokens. Validate before join; include in `JOIN_ROOM`.

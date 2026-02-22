/**
 * Spatial audio helper: gain and pan based on distance and X offset.
 * Uses Web Audio API: GainNode, StereoPannerNode.
 *
 * TODO: For production, integrate with SFU audio tracks and WebRTC receive streams.
 */

const ENTER_RADIUS = 120
const EXIT_RADIUS = 140
const FADE_MS = 200

let audioCtx: AudioContext | null = null

const peers = new Map<
  string,
  { gainNode: GainNode; pannerNode: StereoPannerNode; source?: MediaStreamAudioSourceNode | undefined }
>()

export function initAudio(): AudioContext | null {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    } catch {
      return null
    }
  }
  return audioCtx
}

function distanceToGain(distance: number): number {
  if (distance <= ENTER_RADIUS) return 1
  if (distance >= EXIT_RADIUS) return 0
  return 1 - (distance - ENTER_RADIUS) / (EXIT_RADIUS - ENTER_RADIUS)
}

function xOffsetToPan(dx: number): number {
  return Math.max(-1, Math.min(1, dx / ENTER_RADIUS))
}

function rampGain(node: GainNode, target: number, ctx: AudioContext, durationMs = FADE_MS): void {
  const now = ctx.currentTime
  node.gain.cancelScheduledValues(now)
  node.gain.setValueAtTime(node.gain.value, now)
  node.gain.linearRampToValueAtTime(target, now + durationMs / 1000)
}

/**
 * Connect local mic stream to the spatializer output.
 */
export function connectLocalStream(stream: MediaStream): void {
  const ctx = initAudio()
  if (!ctx) return
  const source = ctx.createMediaStreamSource(stream)
  const gainNode = ctx.createGain()
  const pannerNode = ctx.createStereoPanner()
  source.connect(gainNode)
  gainNode.connect(pannerNode)
  pannerNode.connect(ctx.destination)
  peers.set('local', { gainNode, pannerNode, source })
}

/**
 * Connect remote peer stream (demo).
 * TODO: Replace with SFU/WebRTC receive stream.
 */
export function connectRemoteStream(peerId: string, stream: MediaStream): void {
  const ctx = initAudio()
  if (!ctx) return
  const source = ctx.createMediaStreamSource(stream)
  const gainNode = ctx.createGain()
  gainNode.gain.value = 0
  const pannerNode = ctx.createStereoPanner()
  source.connect(gainNode)
  gainNode.connect(pannerNode)
  pannerNode.connect(ctx.destination)
  peers.set(peerId, { gainNode, pannerNode, source })
}

/**
 * Update peer position for spatialization.
 * myX, myY = local avatar; peerX, peerY = remote avatar.
 */
export function setPeerPosition(
  peerId: string,
  myX: number,
  myY: number,
  peerX: number,
  peerY: number
): void {
  const p = peers.get(peerId)
  if (!p || !audioCtx) return
  const dx = peerX - myX
  const dy = peerY - myY
  const distance = Math.hypot(dx, dy)
  const gain = distanceToGain(distance)
  const pan = xOffsetToPan(dx)
  rampGain(p.gainNode, gain, audioCtx)
  p.pannerNode.pan.value = pan
}

/**
 * Disconnect all peers (e.g. on proximity exit).
 */
export function disconnectAll(): void {
  peers.forEach((_, id) => {
    if (id !== 'local') disconnectPeer(id)
  })
}

/**
 * Disconnect a peer.
 */
export function disconnectPeer(peerId: string): void {
  const p = peers.get(peerId)
  if (!p || !audioCtx) return
  rampGain(p.gainNode, 0, audioCtx)
  setTimeout(() => peers.delete(peerId), FADE_MS + 50)
}

/**
 * Simulate incoming audio for demo when no real stream.
 * Uses an oscillator as placeholder.
 */
export function simulateIncomingAudio(peerId: string): void {
  const ctx = initAudio()
  if (!ctx) return
  const osc = ctx.createOscillator()
  osc.frequency.value = 440
  osc.type = 'sine'
  const gainNode = ctx.createGain()
  gainNode.gain.value = 0.08
  const pannerNode = ctx.createStereoPanner()
  osc.connect(gainNode)
  gainNode.connect(pannerNode)
  pannerNode.connect(ctx.destination)
  osc.start()
  peers.set(peerId, { gainNode, pannerNode })
}

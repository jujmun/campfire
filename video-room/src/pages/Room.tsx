import { useState, useCallback, useEffect, useRef } from 'react'

const SPATIAL_CONTENT_W = 700
const SPATIAL_CONTENT_H = 1600

function SpatialScaler({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      const s = Math.min(w / SPATIAL_CONTENT_W, h / SPATIAL_CONTENT_H, 1)
      setScale(s)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={wrapperRef} className="spatial-scaler">
      <div className="spatial-scaler-inner" style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        {children}
      </div>
    </div>
  )
}
import { useParams, useNavigate } from 'react-router-dom'
import { SpatialCanvas } from '../components/SpatialCanvas'
import { VideoGrid } from '../components/VideoGrid'
import { WhiteboardPanel, type WhiteboardPanelHandle, type SharedPersonalWb } from '../components/WhiteboardPanel'
import { PersonalWhiteboard, type PersonalWbPermissionMode } from '../components/PersonalWhiteboard'
import { IncomingSharePrompt } from '../components/IncomingSharePrompt'
import { CampfireLogo } from '../components/CampfireLogo'
import { IpadConnectModal } from '../components/IpadConnectModal'
import { realtime, generateClientId } from '../lib/realtime'
import type {
  PersonalWbShareStartEvent,
  PersonalWbShareStopEvent,
  PersonalWbSharedEvent,
  PersonalWbViewRequestEvent,
} from '../lib/realtimeStub'
import { useLocalMedia } from '../lib/useLocalMedia'
import { connectLocalStream, simulateIncomingAudio, disconnectPeer, connectRemoteStream } from '../lib/audioSpatializer'
import { createWebRTCManager } from '../lib/webrtcManager'
import type { SpatialParticipant } from '../types'

const CANVAS_W = 1200
const CANVAS_H = 700

const AVATAR_COLORS = ['#8b5cf6', '#22c55e', '#3b82f6', '#ec4899', '#f97316']

const MOCK_SPATIAL_AVATARS: Omit<SpatialParticipant, 'isLocal'>[] = [
  { id: 's1', name: 'Sarah Chen', x: 150, y: 150, isMuted: false, avatarColor: AVATAR_COLORS[0] },
  { id: 's2', name: 'Priya S.', x: 550, y: 200, isMuted: true, avatarColor: AVATAR_COLORS[1] },
  { id: 's3', name: 'Marcus J.', x: 350, y: 350, isMuted: false, avatarColor: AVATAR_COLORS[2] },
  { id: 's4', name: 'Yuki T.', x: 150, y: 550, isMuted: false, avatarColor: AVATAR_COLORS[3] },
  { id: 's5', name: "Tom O'B", x: 550, y: 650, isMuted: true, avatarColor: AVATAR_COLORS[4] },
  { id: 's6', name: 'Morgan', x: 350, y: 850, isMuted: false, avatarColor: AVATAR_COLORS[2] },
  { id: 's7', name: 'Drew', x: 200, y: 1000, isMuted: false, avatarColor: AVATAR_COLORS[1] },
  { id: 's8', name: 'Kai', x: 500, y: 950, isMuted: true, avatarColor: AVATAR_COLORS[4] },
]

const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false'

function createInitialParticipants(localId: string): Map<string, SpatialParticipant> {
  const m = new Map<string, SpatialParticipant>()
  m.set(localId, {
    id: localId,
    name: 'Sarah Chen',
    x: CANVAS_W / 2 - 24,
    y: CANVAS_H / 2 - 24,
    isMuted: false,
    isLocal: true,
    avatarColor: AVATAR_COLORS[0],
  })
  if (isDemoMode) {
    MOCK_SPATIAL_AVATARS.forEach((a) => m.set(a.id, { ...a, isLocal: false }))
  }
  return m
}

export function Room() {
  const { roomId } = useParams<{ roomId?: string }>()
  const navigate = useNavigate()

  const effectiveRoomId = roomId?.trim() || ''

  useEffect(() => {
    if (!effectiveRoomId) {
      navigate('/', { replace: true })
    }
  }, [effectiveRoomId, navigate])

  if (!effectiveRoomId) {
    return null
  }
  const [layoutMode, setLayoutMode] = useState<'video' | 'screen-share'>('video')
  const [whiteboardMode, setWhiteboardMode] = useState<'screen-share' | 'draw'>('draw')
  const [screenStream] = useState<MediaStream | null>(null)
  const [localUserId] = useState(() => generateClientId())
  const [participants, setParticipants] = useState<Map<string, SpatialParticipant>>(() =>
    createInitialParticipants(localUserId)
  )
  const [showIpadModal, setShowIpadModal] = useState(false)
  const [roomLinkCopied, setRoomLinkCopied] = useState(false)
  const [hostLockProximity, setHostLockProximity] = useState(false)
  const [hostDisablePersonalAutoShare, setHostDisablePersonalAutoShare] = useState(false)
  const [personalWbOpen, setPersonalWbOpen] = useState(false)
  const [personalWbAutoShare, setPersonalWbAutoShare] = useState(false)
  const [personalWbPermissionMode, setPersonalWbPermissionMode] = useState<PersonalWbPermissionMode>('view-only')
  const [personalWbSharing, setPersonalWbSharing] = useState(false)
  const [personalWbShareTargets, setPersonalWbShareTargets] = useState<string[]>([])
  const [proximityPeers, setProximityPeers] = useState<string[]>([])
  const [pendingSharePrompt, setPendingSharePrompt] = useState<{ names: string[]; ids: string[] } | null>(null)
  const [sharedPersonalWb, setSharedPersonalWb] = useState<SharedPersonalWb | null>(null)
  const [controlRequest, setControlRequest] = useState<{ fromId: string; fromName: string } | null>(null)
  const [viewRequest, setViewRequest] = useState<{ requesterId: string; requesterName: string } | null>(null)
  const personalWbShareDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { stream: localStream, isMuted, toggleMute } = useLocalMedia()
  const ariaAnnounceRef = useRef<HTMLDivElement>(null)
  const whiteboardRef = useRef<WhiteboardPanelHandle>(null)
  const webrtcManagerRef = useRef<ReturnType<typeof createWebRTCManager> | null>(null)

  useEffect(() => {
    realtime.join(effectiveRoomId)
    realtime.send(effectiveRoomId, {
      type: 'JOIN_ROOM',
      roomId: effectiveRoomId,
      userId: localUserId,
      name: 'Sarah Chen',
      timestamp: Date.now(),
    })
    return () => realtime.leave()
  }, [effectiveRoomId, localUserId])

  useEffect(() => {
    const manager = createWebRTCManager({
      roomId: effectiveRoomId,
      localUserId,
      localStream,
      realtime: realtime as { send: (roomId: string, ev: unknown) => void; on: (roomId: string, handler: (ev: unknown) => void) => () => void },
      onRemoteStream: (peerId, stream) => {
        setParticipants((prev) => {
          const next = new Map(prev)
          const p = next.get(peerId)
          if (p) next.set(peerId, { ...p, stream })
          return next
        })
        connectRemoteStream(peerId, stream)
      },
      onPeerDisconnected: (peerId) => {
        disconnectPeer(peerId)
        setParticipants((prev) => {
          const next = new Map(prev)
          next.delete(peerId)
          return next
        })
      },
    })
    webrtcManagerRef.current = manager
    manager.start()
    return () => {
      manager.destroy()
      webrtcManagerRef.current = null
    }
  }, [effectiveRoomId, localUserId, localStream])

  useEffect(() => {
    webrtcManagerRef.current?.setLocalStream(localStream)
  }, [localStream])

  useEffect(() => {
    const unsub = realtime.on(effectiveRoomId, (event) => {
      if (event.type === 'JOIN_ROOM' && event.userId !== localUserId) {
        setParticipants((prev) => {
          const next = new Map(prev)
          const existing = next.get(event.userId)
          if (existing) return prev
          const colors = AVATAR_COLORS
          next.set(event.userId, {
            id: event.userId,
            name: event.name ?? event.userId.slice(0, 8),
            x: Math.random() * (CANVAS_W - 100) + 50,
            y: Math.random() * (CANVAS_H - 100) + 50,
            isLocal: false,
            avatarColor: colors[Math.floor(Math.random() * colors.length)],
          })
          return next
        })
        webrtcManagerRef.current?.addPeer(event.userId)
      }
      if (event.type === 'USER_LEFT' && event.userId) {
        webrtcManagerRef.current?.removePeer(event.userId)
        setParticipants((prev) => {
          const next = new Map(prev)
          next.delete(event.userId)
          return next
        })
        setProximityPeers((prev) => prev.filter((id) => id !== event.userId))
        setPendingSharePrompt((p) =>
          p && p.ids.includes(event.userId)
            ? null
            : p
        )
      }
    })
    return unsub
  }, [effectiveRoomId, localUserId])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const key = e.key.toLowerCase()
      if (key === 's') { /* Share Screen removed */ }
      else if (key === 'd') whiteboardRef.current?.toggleDrawMode()
      else if (key === 'e') whiteboardRef.current?.exportPng()
      else if (key === 'i') setShowIpadModal((v) => !v)
      else if (key === ' ') {
        e.preventDefault()
        toggleMute()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const announce = useCallback((text: string) => {
    const el = ariaAnnounceRef.current
    if (el) el.textContent = text
  }, [])

  useEffect(() => {
    if (localStream) {
      setParticipants((prev) => {
        const next = new Map(prev)
        const local = next.get(localUserId)
        if (local) next.set(localUserId, { ...local, stream: localStream })
        return next
      })
      connectLocalStream(localStream)
    }
  }, [localStream, isMuted, localUserId])

  const targetsFromProximity = useCallback(
    (members: string[]) => members.filter((id) => id !== localUserId),
    [localUserId]
  )

  const doPersonalWbShareStart = useCallback(
    (targetIds: string[]) => {
      if (targetIds.length === 0) return
      setPersonalWbSharing(true)
      setPersonalWbShareTargets(targetIds)
      realtime.send(effectiveRoomId, {
        type: 'PERSONAL_WB_SHARE_START',
        roomId: effectiveRoomId,
        ownerId: localUserId,
        ownerName: 'Sarah Chen',
        targetIds,
        mode: personalWbPermissionMode,
        timestamp: Date.now(),
      } as PersonalWbShareStartEvent)
      const names = targetIds.map((id) => participants.get(id)?.name ?? id).join(', ')
      announce(`Your whiteboard is shared with ${names}`)
    },
    [effectiveRoomId, localUserId, personalWbPermissionMode, participants, announce]
  )

  const doPersonalWbShareStop = useCallback(() => {
    setPersonalWbSharing(false)
    const prev = [...personalWbShareTargets]
    setPersonalWbShareTargets([])
    realtime.send(effectiveRoomId, {
      type: 'PERSONAL_WB_SHARE_STOP',
      roomId: effectiveRoomId,
      ownerId: localUserId,
      targetIds: prev,
      timestamp: Date.now(),
    } as PersonalWbShareStopEvent)
    announce('Personal whiteboard sharing stopped')
  }, [effectiveRoomId, localUserId, personalWbShareTargets, announce])

  const handleProximityEnter = useCallback(
    (_clusterId: string, members: string[]) => {
      if (hostLockProximity) return
      const targets = targetsFromProximity(members)
      targets.forEach((peerId) => {
        const p = participants.get(peerId)
        if (!p?.stream) simulateIncomingAudio(peerId)
      })
      announce(`Private audio connected with ${targets.map((id) => participants.get(id)?.name ?? id).join(', ')}`)

      setProximityPeers(targets)

      if (targets.length > 0) {
        setPendingSharePrompt({
          names: targets.map((id) => participants.get(id)?.name ?? id),
          ids: targets,
        })
      }
    },
    [hostLockProximity, participants, announce, targetsFromProximity]
  )

  const handleProximityChange = useCallback(
    (nearbyIds: string[]) => {
      if (hostLockProximity) return
      const prev = proximityPeers
      setProximityPeers(nearbyIds)
      if (nearbyIds.length === 0) {
        prev.forEach((peerId) => {
          if (!participants.get(peerId)?.stream) disconnectPeer(peerId)
        })
        announce('Private audio disconnected from participants')
        setPendingSharePrompt(null)
        if (personalWbShareDebounceRef.current) {
          clearTimeout(personalWbShareDebounceRef.current)
          personalWbShareDebounceRef.current = null
        }
        if (personalWbSharing) doPersonalWbShareStop()
      } else {
        nearbyIds.forEach((peerId) => {
          const p = participants.get(peerId)
          if (!p?.stream) simulateIncomingAudio(peerId)
        })
      }
    },
    [hostLockProximity, personalWbSharing, participants, proximityPeers, announce, doPersonalWbShareStop]
  )

  const handleProximityExit = useCallback(() => {
    proximityPeers.forEach((peerId) => {
      if (!participants.get(peerId)?.stream) disconnectPeer(peerId)
    })
    announce('Private audio disconnected from participants')
    setProximityPeers([])
    setPendingSharePrompt(null)
    if (personalWbShareDebounceRef.current) {
      clearTimeout(personalWbShareDebounceRef.current)
      personalWbShareDebounceRef.current = null
    }
    if (personalWbSharing) doPersonalWbShareStop()
  }, [announce, personalWbSharing, doPersonalWbShareStop, proximityPeers, participants])

  useEffect(() => {
    return realtime.on(effectiveRoomId, (ev) => {
      if (ev.type === 'PERSONAL_WB_SHARED' || ev.type === 'PERSONAL_WB_SHARE_START') {
        const e = ev as PersonalWbSharedEvent & { targetIds: string[] }
        if (e.targetIds?.includes(localUserId) && e.ownerId !== localUserId) {
          setSharedPersonalWb({
            ownerId: e.ownerId,
            ownerName: e.ownerName ?? e.ownerId.slice(0, 8),
            mode: e.mode,
          })
          announce(`${e.ownerName ?? e.ownerId} is sharing their whiteboard with you`)
        }
      }
      if (ev.type === 'PERSONAL_WB_SHARE_STOP') {
        const e = ev as PersonalWbShareStopEvent
        const isTarget = e.targetIds?.includes(localUserId)
        if (isTarget && e.ownerId !== localUserId) {
          setSharedPersonalWb(null)
          announce('Shared whiteboard stopped')
        }
      }
      if (ev.type === 'PERSONAL_WB_PERMISSION_REQUEST') {
        if (ev.ownerId === localUserId) {
          setControlRequest({
            fromId: (ev as { requesterId: string; requesterName?: string }).requesterId,
            fromName: (ev as { requesterName?: string }).requesterName ?? 'peer',
          })
        }
      }
      if (ev.type === 'PERSONAL_WB_PERMISSION_GRANT' || ev.type === 'PERSONAL_WB_PERMISSION_DENY') {
        setControlRequest(null)
      }
      if (ev.type === 'PERSONAL_WB_VIEW_REQUEST') {
        const e = ev as PersonalWbViewRequestEvent
        if (e.ownerId === localUserId) {
          setViewRequest({
            requesterId: e.requesterId,
            requesterName: e.requesterName ?? e.requesterId.slice(0, 8),
          })
        }
      }
    })
  }, [effectiveRoomId, localUserId, announce])

  const handleShareMine = useCallback(() => {
    if (proximityPeers.length > 0) {
      doPersonalWbShareStart(proximityPeers)
      setPersonalWbOpen(true)
      setPendingSharePrompt(null)
    }
  }, [proximityPeers, doPersonalWbShareStart])

  const handleViewTheirs = useCallback(() => {
    if (!pendingSharePrompt || pendingSharePrompt.ids.length === 0) return
    const ownerId = pendingSharePrompt.ids[0]
    const ownerName = participants.get(ownerId)?.name ?? pendingSharePrompt.names?.[0] ?? ownerId.slice(0, 8)
    realtime.send(effectiveRoomId, {
      type: 'PERSONAL_WB_VIEW_REQUEST',
      roomId: effectiveRoomId,
      requesterId: localUserId,
      requesterName: 'Sarah Chen',
      ownerId,
      timestamp: Date.now(),
    } as PersonalWbViewRequestEvent)
    setSharedPersonalWb({ ownerId, ownerName, mode: 'view-only' })
    setPersonalWbOpen(false)
    setPendingSharePrompt(null)
    announce(`Viewing ${ownerName}'s whiteboard`)
  }, [pendingSharePrompt, effectiveRoomId, localUserId, participants, announce])

  const handleNeither = useCallback(() => {
    setPendingSharePrompt(null)
  }, [])

  const copyRoomLink = useCallback(async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/room/${effectiveRoomId}`
        : ''
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
        setRoomLinkCopied(true)
        announce('Room link copied')
        setTimeout(() => setRoomLinkCopied(false), 2000)
      } else {
        const input = document.createElement('input')
        input.value = url
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
        setRoomLinkCopied(true)
        announce('Room link copied')
        setTimeout(() => setRoomLinkCopied(false), 2000)
      }
    } catch {
      /* fallback failed */
    }
  }, [effectiveRoomId, announce])

  const handleViewRequestAccept = useCallback(() => {
    if (!viewRequest) return
    doPersonalWbShareStart([viewRequest.requesterId])
    setViewRequest(null)
    announce(`Sharing whiteboard with ${viewRequest.requesterName}`)
  }, [viewRequest, doPersonalWbShareStart, announce])

  const handleViewRequestDecline = useCallback(() => {
    setViewRequest(null)
  }, [])

  const handleStopViewingShared = useCallback(() => {
    setSharedPersonalWb(null)
  }, [])

  const handleControlRequestAccept = useCallback(() => {
    if (!controlRequest) return
    realtime.send(effectiveRoomId, {
      type: 'PERSONAL_WB_PERMISSION_GRANT',
      roomId: effectiveRoomId,
      ownerId: localUserId,
      requesterId: controlRequest.fromId,
      timestamp: Date.now(),
    })
    setControlRequest(null)
    announce(`Granted control to ${controlRequest.fromName}`)
  }, [effectiveRoomId, localUserId, controlRequest, announce])

  const handleControlRequestDeny = useCallback(() => {
    if (!controlRequest) return
    realtime.send(effectiveRoomId, {
      type: 'PERSONAL_WB_PERMISSION_DENY',
      roomId: effectiveRoomId,
      ownerId: localUserId,
      requesterId: controlRequest.fromId,
      timestamp: Date.now(),
    })
    setControlRequest(null)
  }, [effectiveRoomId, localUserId, controlRequest])

  return (
    <div className="room-page" data-layout={layoutMode}>
      <div
        ref={ariaAnnounceRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <header className="room-header room-header-spatial">
        <div className="room-header-left">
          <CampfireLogo size={24} className="room-logo" />
          <h1 className="room-title">
            <span className="room-status-dot" aria-hidden />
            Campfire — Floor 1
          </h1>
          <span className="room-dimensions">700×1600</span>
        </div>
        <div className="room-actions">
          <span className="room-status-item" title="Connection">Good</span>
          <span className="room-status-item" title="Participants">{participants.size}</span>
          <span className="room-status-item" title="Secure">SRTP</span>
          <button
            type="button"
            className={`btn-host-lock ${hostLockProximity ? 'active' : ''}`}
            onClick={() => setHostLockProximity((v) => !v)}
            aria-pressed={hostLockProximity}
            aria-label="Lock proximity audio"
            title="Host can lock proximity audio"
          >
            {hostLockProximity ? '🔒' : '🔓'}
          </button>
          <button
            type="button"
            className={`btn-host-lock ${hostDisablePersonalAutoShare ? 'active' : ''}`}
            onClick={() => setHostDisablePersonalAutoShare((v) => !v)}
            aria-pressed={hostDisablePersonalAutoShare}
            aria-label="Disable personal whiteboard auto-share"
            title="Host can disable personal whiteboard auto-share"
          >
            {hostDisablePersonalAutoShare ? '⛔' : '✏️'}
          </button>
          <button
            type="button"
            className={`btn-layout-toggle ${layoutMode === 'video' ? 'active' : ''}`}
            onClick={() => setLayoutMode('video')}
            aria-pressed={layoutMode === 'video'}
            aria-label="Video call layout"
            title="Video call layout (participants prominent, Zoom-like)"
          >
            Video
          </button>
          <button
            type="button"
            className={`btn-layout-toggle ${layoutMode === 'screen-share' ? 'active' : ''}`}
            onClick={() => setLayoutMode('screen-share')}
            aria-pressed={layoutMode === 'screen-share'}
            aria-label="Campfire layout"
            title="Campfire layout (spatial room, shared content prominent)"
          >
            Campfire
          </button>
          <button
            type="button"
            className="btn-ipad"
            onClick={copyRoomLink}
            aria-label="Copy room link"
            title="Copy room link to share with others"
          >
            {roomLinkCopied ? 'Copied!' : 'Copy room link'}
          </button>
          <button
            type="button"
            className="btn-ipad"
            onClick={() => setShowIpadModal(true)}
            aria-label="Connect iPad (I)"
          >
            Connect iPad
          </button>
        </div>
      </header>

      <main className="room-main">
        <div className="room-left-column room-left-frosted">
              {layoutMode === 'video' ? (
                <section className="room-video-zoom" aria-label="Video call">
                  <div className="room-video-zoom-grid">
                    <VideoGrid
                      participants={Array.from(participants.values()).map((p) => ({
                        id: p.id,
                        name: p.name,
                        stream: p.stream,
                        isMuted: p.isMuted,
                        isLocal: p.isLocal,
                      }))}
                    />
                  </div>
                  <div className="room-media-controls room-media-controls-bottom">
                    <button
                      type="button"
                      className={`room-media-btn ${!isMuted ? 'on' : ''}`}
                      onClick={() => toggleMute()}
                      aria-pressed={!isMuted}
                      aria-label="Microphone"
                    >
                      {isMuted ? '🔇' : '🎤'}
                    </button>
                    <button type="button" className="room-media-btn on" aria-label="Camera" aria-pressed="true">
                      📹
                    </button>
                  </div>
                </section>
              ) : (
                <section className="room-spatial-office" aria-label="Spatial office">
                  <div className="room-spatial-office-header">
                    <h2 className="room-spatial-office-title">Campfire</h2>
                    <button type="button" className="room-spatial-office-menu" aria-label="Menu">⋯</button>
                  </div>
                  <div className="room-connected-status-slot">
                    {proximityPeers.length > 0 && (
                      <div className="room-connected-status">
                        <span className="room-connected-icon" aria-hidden>🔊</span>
                        <span>Connected to {proximityPeers.map((id) => participants.get(id)?.name ?? id).join(', ')}</span>
                      </div>
                    )}
                  </div>
                  <div className="room-spatial-content">
                    <SpatialScaler>
                    <SpatialCanvas
                      roomId={effectiveRoomId}
                      localUserId={localUserId}
                      localName="Sarah Chen"
                      participants={participants}
                      onParticipantsChange={setParticipants}
                      onProximityEnter={handleProximityEnter}
                      onProximityExit={handleProximityExit}
                      onProximityChange={handleProximityChange}
                      onAriaAnnounce={announce}
                      personalWbOpen={personalWbOpen}
                      personalWbAutoShare={personalWbAutoShare}
                      personalWbSharing={personalWbSharing}
                      onOpenPersonalWb={() => setPersonalWbOpen(true)}
                    />
                    </SpatialScaler>
                  </div>
                  <div className="room-tools-panel">
                    <div className="room-tools-label">Tools</div>
                    <div className="room-tools-buttons">
                      <button
                        type="button"
                        className={`room-tool-btn ${whiteboardMode === 'screen-share' || !!screenStream ? 'active' : ''}`}
                        onClick={() => {
                          if (!screenStream) { /* Share Screen removed */ }
                          else setWhiteboardMode('screen-share')
                        }}
                        aria-pressed={!!screenStream}
                        aria-label="My ScreenShare"
                      >
                        <span className="room-tool-icon">🖥️</span>
                        My ScreenShare
                      </button>
                      <button
                        type="button"
                        className={`room-tool-btn room-tool-whiteboard ${personalWbOpen ? 'active' : ''}`}
                        onClick={() => setPersonalWbOpen((v) => !v)}
                        aria-pressed={personalWbOpen}
                        aria-label="My Whiteboard"
                      >
                        <span className="room-tool-icon">✏️</span>
                        My Whiteboard
                      </button>
                    </div>
                  </div>
                  <div className="room-media-controls">
                    <button
                      type="button"
                      className={`room-media-btn ${!isMuted ? 'on' : ''}`}
                      onClick={() => toggleMute()}
                      aria-pressed={!isMuted}
                      aria-label="Microphone"
                    >
                      {isMuted ? '🔇' : '🎤'}
                    </button>
                    <button type="button" className="room-media-btn on" aria-label="Camera" aria-pressed="true">
                      📹
                    </button>
                  </div>
                </section>
              )}
            </div>
            <section className="room-whiteboard-section room-right-frosted" aria-label="Whiteboard">
              <div className="room-screen-share-header">
                <h2 className="room-screen-share-title">
                  {personalWbOpen
                    ? "You are viewing Sarah Chen's Whiteboard"
                    : sharedPersonalWb
                      ? `You are viewing ${sharedPersonalWb.ownerName}'s Whiteboard`
                      : screenStream
                        ? 'Screen Share'
                        : 'Whiteboard'}
                </h2>
              </div>
              {screenStream && !personalWbOpen && (
                <div className="room-sharing-indicator">
                  <span className="room-sharing-avatar">SC</span>
                  <span className="room-sharing-icon">🖥️</span>
                  <span>Sharing: Sarah Chen's Screen</span>
                </div>
              )}
              {personalWbOpen ? (
                <div className="whiteboard-panel personal-wb-panel">
                  <PersonalWhiteboard
                    roomId={effectiveRoomId}
                    ownerId={localUserId}
                    ownerName="Sarah Chen"
                    isOpen
                    onClose={() => setPersonalWbOpen(false)}
                    autoShare={personalWbAutoShare}
                    onAutoShareChange={setPersonalWbAutoShare}
                    permissionMode={personalWbPermissionMode}
                    onPermissionModeChange={setPersonalWbPermissionMode}
                    isSharing={personalWbSharing}
                    onShareStart={proximityPeers.length > 0 ? () => doPersonalWbShareStart(proximityPeers) : undefined}
                    onShareStop={doPersonalWbShareStop}
                    onAriaAnnounce={announce}
                  />
                </div>
              ) : (
              <WhiteboardPanel
                ref={whiteboardRef}
                roomId={effectiveRoomId}
                mode={whiteboardMode}
                screenStream={screenStream}
                onModeChange={setWhiteboardMode}
                onAriaAnnounce={announce}
                sharedPersonalWb={sharedPersonalWb}
                onStopViewingShared={handleStopViewingShared}
                localUserId={localUserId}
                onRequestControl={(ownerId) => {
                  realtime.send(effectiveRoomId, {
                    type: 'PERSONAL_WB_PERMISSION_REQUEST',
                    roomId: effectiveRoomId,
                    ownerId,
                    requesterId: localUserId,
                    requesterName: 'Sarah Chen',
                    timestamp: Date.now(),
                  })
                  announce('Control requested')
                }}
              />
              )}
            </section>
      </main>

      {pendingSharePrompt && (
        <div className="incoming-share-floating">
          <IncomingSharePrompt
            message="You're near"
            peerName={pendingSharePrompt.names.join(', ')}
            showProximityWhiteboardChoice
            onShareMine={handleShareMine}
            onViewTheirs={handleViewTheirs}
            onNeither={handleNeither}
          />
        </div>
      )}

      {viewRequest && (
        <div className="incoming-share-floating">
          <IncomingSharePrompt
            message={`${viewRequest.requesterName} wants to view your whiteboard`}
            showRequestControl
            onAccept={handleViewRequestAccept}
            onDecline={handleViewRequestDecline}
          />
        </div>
      )}

      {controlRequest && (
        <div className="incoming-share-floating">
          <IncomingSharePrompt
            message={`${controlRequest.fromName} requests control`}
            showRequestControl
            onAccept={handleControlRequestAccept}
            onDecline={handleControlRequestDeny}
          />
        </div>
      )}

      {showIpadModal && (
        <IpadConnectModal
          roomId={effectiveRoomId}
          onClose={() => setShowIpadModal(false)}
        />
      )}

    </div>
  )
}

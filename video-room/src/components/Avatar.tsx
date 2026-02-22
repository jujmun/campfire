import { useRef, useEffect } from 'react'
import type { SpatialParticipant } from '../types'

interface AvatarProps {
  participant: SpatialParticipant
  isInProximity?: boolean
  isConnecting?: boolean
  size?: number
  hasPersonalWbOpen?: boolean
  autoShareOn?: boolean
  isSharingWb?: boolean
  onOpenPersonalWb?: () => void
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name.slice(0, 2) || name[0] || '?').toUpperCase()
}

export function Avatar({
  participant,
  isInProximity = false,
  isConnecting = false,
  size = 48,
  hasPersonalWbOpen = false,
  autoShareOn = false,
  isSharingWb = false,
  onOpenPersonalWb,
}: AvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const initials = getInitials(participant.name)
  const color = participant.avatarColor ?? '#8b5cf6'
  const showVideo = !!participant.stream?.getVideoTracks().length

  useEffect(() => {
    const el = videoRef.current
    if (!el || !participant.stream) return
    el.srcObject = participant.stream
  }, [participant.stream])

  return (
    <div
      className={`avatar-container ${participant.isLocal ? 'avatar-local-glow' : ''} ${isInProximity ? 'avatar-proximity' : ''} ${isConnecting ? 'avatar-connecting' : ''} ${isSharingWb ? 'avatar-sharing-wb' : ''}`}
      style={{
        left: participant.x - size / 2,
        top: participant.y - size / 2,
        width: size,
        height: size,
      }}
    >
      <div className="avatar-ring" style={{ width: size, height: size, backgroundColor: showVideo ? '#333' : color }}>
        {participant.avatarUrl ? (
          <img src={participant.avatarUrl} alt="" className="avatar-img" />
        ) : showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={participant.isLocal}
            className="avatar-video"
            style={{ width: size, height: size }}
            aria-label={`Video of ${participant.name}`}
          />
        ) : (
          <span className="avatar-initial">{initials}</span>
        )}
      </div>
      <span className="avatar-name">{participant.name}{participant.isLocal ? ' (You)' : ''}</span>
      {participant.isMuted && (
        <span className="avatar-mic" aria-label="Muted">🔇</span>
      )}
      {participant.isLocal && (
        <div className="avatar-wb-controls">
          <button
            type="button"
            className="avatar-wb-btn"
            onClick={(e) => { e.stopPropagation(); onOpenPersonalWb?.() }}
            aria-label={hasPersonalWbOpen ? 'Personal whiteboard open' : 'Open personal whiteboard'}
            title="Personal Whiteboard"
          >
            ✏️
          </button>
          {hasPersonalWbOpen && autoShareOn && (
            <span className="avatar-autoshare-badge" aria-label="Auto-share on">🔥</span>
          )}
          {isSharingWb && (
            <span className="avatar-sharing-pill">Sharing</span>
          )}
        </div>
      )}
    </div>
  )
}

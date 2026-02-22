import { useRef, useEffect } from 'react'
import type { Participant } from '../types'

interface ParticipantTileProps {
  participant: Participant
  onTalkPrivately?: (id: string) => void
}

export function ParticipantTile({ participant, onTalkPrivately }: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el || !participant.stream) return
    el.srcObject = participant.stream
  }, [participant.stream])

  return (
    <div className="participant-tile">
      <div className="participant-video-wrap">
        {participant.stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={participant.isLocal}
            aria-label={`Video of ${participant.name}`}
          />
        ) : (
          <div className="participant-placeholder" aria-hidden="true">
            {participant.name.charAt(0)}
          </div>
        )}
        <button
          className="tile-menu-btn"
          aria-label={`More options for ${participant.name}`}
          type="button"
        >
          ⋯
        </button>
      </div>
      <div className="participant-footer">
        <span className="participant-name">{participant.name}</span>
        {participant.isMuted && (
          <span className="mic-muted" aria-label="Muted" title="Muted">
            🔇
          </span>
        )}
        {onTalkPrivately && !participant.isLocal && (
          <button
            className="btn-talk-private"
            onClick={() => onTalkPrivately(participant.id)}
            aria-label={`Talk privately with ${participant.name}`}
            type="button"
          >
            Talk Privately
          </button>
        )}
      </div>
    </div>
  )
}

import { ParticipantTile } from './ParticipantTile'
import type { Participant } from '../types'

interface VideoGridProps {
  participants: Participant[]
  onTalkPrivately?: (id: string) => void
}

export function VideoGrid({ participants, onTalkPrivately }: VideoGridProps) {
  return (
    <div className="video-grid" role="region" aria-label="Video participants">
      {participants.map((p) => (
        <ParticipantTile
          key={p.id}
          participant={p}
          onTalkPrivately={onTalkPrivately}
        />
      ))}
    </div>
  )
}

/**
 * Floating prompt shown to owner when a target requests control (collaborative mode).
 * Or when in proximity: "Share your whiteboard or view theirs?"
 */

interface IncomingSharePromptProps {
  message: string
  peerName?: string
  onAccept?: () => void
  onDecline?: () => void
  showRequestControl?: boolean
  /** Proximity mode: Share mine | View theirs | Neither */
  showProximityWhiteboardChoice?: boolean
  onShareMine?: () => void
  onViewTheirs?: () => void
  onNeither?: () => void
}

export function IncomingSharePrompt({
  message,
  peerName,
  onAccept,
  onDecline,
  showRequestControl = false,
  showProximityWhiteboardChoice = false,
  onShareMine,
  onViewTheirs,
  onNeither,
}: IncomingSharePromptProps) {
  return (
    <div className="incoming-share-prompt" role="dialog" aria-label="Share prompt">
      <p className="incoming-share-message">{message}</p>
      {peerName && <span className="incoming-share-peer">{peerName}</span>}
      {showProximityWhiteboardChoice && (
        <div className="incoming-share-actions incoming-share-actions-three">
          {onShareMine && (
            <button type="button" className="incoming-share-btn accept" onClick={onShareMine}>
              Share mine
            </button>
          )}
          {onViewTheirs && (
            <button type="button" className="incoming-share-btn secondary" onClick={onViewTheirs}>
              View theirs
            </button>
          )}
          {onNeither && (
            <button type="button" className="incoming-share-btn decline" onClick={onNeither}>
              Neither
            </button>
          )}
        </div>
      )}
      {!showProximityWhiteboardChoice && showRequestControl && (
        <div className="incoming-share-actions">
          {onAccept && (
            <button type="button" className="incoming-share-btn accept" onClick={onAccept}>
              Allow
            </button>
          )}
          {onDecline && (
            <button type="button" className="incoming-share-btn decline" onClick={onDecline}>
              Decline
            </button>
          )}
        </div>
      )}
      {!showProximityWhiteboardChoice && !showRequestControl && (
        <div className="incoming-share-actions">
          {onAccept && (
            <button type="button" className="incoming-share-btn accept" onClick={onAccept}>
              Share
            </button>
          )}
          {onDecline && (
            <button type="button" className="incoming-share-btn decline" onClick={onDecline}>
              Later
            </button>
          )}
        </div>
      )}
    </div>
  )
}

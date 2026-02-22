/**
 * Modal shown when another participant wants to talk privately.
 */

interface IncomingPrivateRequestModalProps {
  fromName: string
  onAccept: () => void
  onDecline: () => void
}

export function IncomingPrivateRequestModal({
  fromName,
  onAccept,
  onDecline,
}: IncomingPrivateRequestModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]"
      role="alertdialog"
      aria-labelledby="private-request-title"
      aria-describedby="private-request-desc"
    >
      <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl p-6 max-w-sm w-[90%] shadow-xl">
        <h2 id="private-request-title" className="text-lg font-semibold mb-2">
          {fromName} wants to talk privately
        </h2>
        <p id="private-request-desc" className="text-[var(--color-text-secondary)] text-sm mb-6">
          Accept to start a one-to-one audio conversation.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 py-2.5 px-4 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            aria-label={`Accept private conversation with ${fromName}`}
          >
            Accept
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 py-2.5 px-4 rounded-lg bg-[var(--color-border)] text-[var(--color-text-primary)] font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            aria-label="Decline private conversation"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  )
}

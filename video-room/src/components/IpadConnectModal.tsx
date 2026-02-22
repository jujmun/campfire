import { useState, useCallback, useEffect } from 'react'
import QRCode from 'qrcode'

interface IpadConnectModalProps {
  roomId: string
  onClose: () => void
}

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export function IpadConnectModal({ roomId, onClose }: IpadConnectModalProps) {
  const [token] = useState(() => generateToken())
  const [copied, setCopied] = useState(false)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const ipadUrl = `${baseUrl}/ipad?token=${token}&room=${roomId}`

  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  useEffect(() => {
    QRCode.toDataURL(ipadUrl, { width: 200, margin: 2 }).then(setQrDataUrl).catch(() => {})
  }, [ipadUrl])

  const copyUrl = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(ipadUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        const input = document.createElement('input')
        input.value = ipadUrl
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* fallback failed */
    }
  }, [ipadUrl])

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ipad-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-card ipad-modal">
        <h2 id="ipad-modal-title">Connect iPad</h2>
        <p className="modal-desc">
          Scan the QR code or open this URL on your iPad to draw on the whiteboard.
        </p>
        <div className="ipad-token-row">
          <span className="token-label">Token:</span>
          <code className="token-value">{token}</code>
        </div>
        <div className="ipad-url-row">
          <input
            type="text"
            readOnly
            value={ipadUrl}
            className="ipad-url-input"
            aria-label="iPad connection URL"
          />
          <button
            type="button"
            onClick={copyUrl}
            className="btn-copy"
            aria-label="Copy URL"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="ipad-qr-wrap" aria-hidden="true">
          {qrDataUrl ? <img src={qrDataUrl} alt="" className="ipad-qr-code" /> : null}
        </div>
        <p className="ipad-hint">
          For demo: open this URL in another tab or on a device on the same network.
          Strokes sync via BroadcastChannel when same-origin.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="btn-close-modal"
          aria-label="Close"
        >
          Close
        </button>
      </div>
    </div>
  )
}

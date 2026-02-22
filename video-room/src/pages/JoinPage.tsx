import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CampfireLogo } from '../components/CampfireLogo'

const ROOM_CODE_LENGTH = 8
const ALPHANUMERIC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ALPHANUMERIC[bytes[i] % ALPHANUMERIC.length]
  }
  return code
}

export function JoinPage() {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleJoin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const normalized = roomCode.trim()
      if (!normalized) {
        setError('Please enter a room code')
        return
      }
      setError(null)
      navigate(`/room/${encodeURIComponent(normalized)}`)
    },
    [roomCode, navigate]
  )

  const handleCreateRoom = useCallback(() => {
    const code = generateRoomCode()
    navigate(`/room/${code}`)
  }, [navigate])

  return (
    <div className="join-page">
      <div className="join-page-content">
        <CampfireLogo size={64} className="join-page-logo" />
        <h1 className="join-page-title">Campfire</h1>

        <button
          type="button"
          onClick={handleCreateRoom}
          className="join-page-btn join-page-btn-primary join-page-btn-create"
        >
          Create new room
        </button>

        <div className="join-page-divider">
          <span>or join with code</span>
        </div>

        <form onSubmit={handleJoin} className="join-page-form">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => {
              setRoomCode(e.target.value)
              setError(null)
            }}
            placeholder="Enter room code"
            className="join-page-input"
            aria-label="Room code"
            aria-invalid={!!error}
            aria-describedby={error ? 'join-error' : undefined}
            autoComplete="off"
          />
          {error && (
            <p id="join-error" className="join-page-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="join-page-btn join-page-btn-secondary">
            Join
          </button>
        </form>
      </div>
    </div>
  )
}

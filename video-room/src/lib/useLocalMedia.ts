/**
 * Hook for local media (camera + microphone).
 * Returns stream, muted state, and toggle.
 */

import { useState, useEffect, useCallback } from 'react'

export interface UseLocalMediaResult {
  stream: MediaStream | null
  isMuted: boolean
  toggleMute: () => void
  error: string | null
}

export function useLocalMedia(): UseLocalMediaResult {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let s: MediaStream | null = null
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        s = mediaStream
        setStream(mediaStream)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not access media')
      })
    return () => {
      s?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (!stream) return
    const audioTracks = stream.getAudioTracks()
    const next = !isMuted
    audioTracks.forEach((t) => {
      t.enabled = !next
    })
    setIsMuted(next)
  }, [stream, isMuted])

  return { stream, isMuted, toggleMute, error }
}

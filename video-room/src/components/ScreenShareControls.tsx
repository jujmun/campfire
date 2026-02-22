import { useCallback, useImperativeHandle, forwardRef } from 'react'

export interface ScreenShareControlsHandle {
  toggle: () => void
}

interface ScreenShareControlsProps {
  onShareStart: (stream: MediaStream) => void
  onShareStop: () => void
  isActive: boolean
  onAriaAnnounce?: (text: string) => void
}

export const ScreenShareControls = forwardRef<ScreenShareControlsHandle, ScreenShareControlsProps>(function ScreenShareControls({
  onShareStart,
  onShareStop,
  isActive,
  onAriaAnnounce,
}, ref) {
  const handleTrackEnded = useCallback(() => {
    onShareStop()
    onAriaAnnounce?.('Screen sharing stopped')
  }, [onShareStop, onAriaAnnounce])

  const startShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      })
      const track = stream.getVideoTracks()[0]
      if (track) {
        track.onended = handleTrackEnded
      }
      onShareStart(stream)
      onAriaAnnounce?.('Screen sharing started')
    } catch (err) {
      onAriaAnnounce?.(
        err instanceof Error && err.message?.includes('Permission')
          ? 'Screen share denied'
          : 'Screen share failed'
      )
    }
  }, [onShareStart, onAriaAnnounce, handleTrackEnded])

  const stopShare = useCallback(() => {
    onShareStop()
    onAriaAnnounce?.('Screen sharing stopped')
  }, [onShareStop, onAriaAnnounce])

  const handleToggle = useCallback(() => {
    if (isActive) stopShare()
    else startShare()
  }, [isActive, startShare, stopShare])

  useImperativeHandle(ref, () => ({ toggle: handleToggle }), [handleToggle])

  return (
    <div className="screen-share-controls">
      <button
        type="button"
        onClick={handleToggle}
        className={`btn-screen-share ${isActive ? 'active' : ''}`}
        aria-pressed={isActive}
        aria-label={isActive ? 'Stop screen sharing' : 'Start screen sharing'}
      >
        {isActive ? 'Stop Share' : 'Share Screen'}
      </button>
    </div>
  )
})

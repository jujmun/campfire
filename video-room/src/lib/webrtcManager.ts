/**
 * WebRTC P2P manager for Campfire video/audio.
 * Uses existing WebSocket for signaling (offer/answer/ICE).
 * STUN: stun.l.google.com. TURN can be added via config.
 */

const DEFAULT_STUN = [{ urls: 'stun:stun.l.google.com:19302' }]

export interface WebrtcManagerConfig {
  roomId: string
  localUserId: string
  localStream: MediaStream | null
  realtime: { send: (roomId: string, ev: unknown) => void; on: (roomId: string, handler: (ev: unknown) => void) => () => void }
  onRemoteStream: (peerId: string, stream: MediaStream) => void
  onPeerDisconnected: (peerId: string) => void
  iceServers?: RTCConfiguration['iceServers']
}

export function createWebRTCManager(config: WebrtcManagerConfig) {
  const {
    roomId,
    localUserId,
    localStream,
    realtime,
    onRemoteStream,
    onPeerDisconnected,
    iceServers = DEFAULT_STUN,
  } = config

  const connections = new Map<string, RTCPeerConnection>()
  let unsubscribe: (() => void) | null = null

  function sendOffer(toId: string, sdp: RTCSessionDescriptionInit) {
    realtime.send(roomId, {
      type: 'WEBRTC_OFFER',
      roomId,
      fromId: localUserId,
      toId,
      sdp,
      timestamp: Date.now(),
    })
  }

  function sendAnswer(toId: string, sdp: RTCSessionDescriptionInit) {
    realtime.send(roomId, {
      type: 'WEBRTC_ANSWER',
      roomId,
      fromId: localUserId,
      toId,
      sdp,
      timestamp: Date.now(),
    })
  }

  function sendIceCandidate(toId: string, candidate: RTCIceCandidateInit) {
    realtime.send(roomId, {
      type: 'WEBRTC_ICE_CANDIDATE',
      roomId,
      fromId: localUserId,
      toId,
      candidate,
      timestamp: Date.now(),
    })
  }

  function closeConnection(peerId: string) {
    const pc = connections.get(peerId)
    if (pc) {
      pc.close()
      connections.delete(peerId)
      onPeerDisconnected(peerId)
    }
  }

  function createConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers })

    pc.ontrack = (e) => {
      const stream = e.streams[0]
      if (stream) onRemoteStream(peerId, stream)
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) sendIceCandidate(peerId, e.candidate)
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closeConnection(peerId)
      }
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))
    }

    connections.set(peerId, pc)
    return pc
  }

  async function addPeer(peerId: string) {
    if (peerId === localUserId) return
    if (connections.has(peerId)) return

    const pc = createConnection(peerId)

    // Lexicographic order: smaller userId creates offer
    const isOfferer = localUserId < peerId

    if (isOfferer) {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendOffer(peerId, offer)
      } catch (err) {
        console.warn('WebRTC createOffer failed:', err)
        closeConnection(peerId)
      }
    }
  }

  function removePeer(peerId: string) {
    closeConnection(peerId)
  }

  function handleEvent(ev: unknown) {
    const e = ev as { type?: string; fromId?: string; toId?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
    if (e.toId !== localUserId) return
    const fromId = e.fromId
    if (!fromId) return

    let pc = connections.get(fromId)
    if (!pc) {
      if (e.type === 'WEBRTC_OFFER') {
        pc = createConnection(fromId)
      } else {
        return
      }
    }

    if (e.type === 'WEBRTC_OFFER' && e.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(e.sdp))
        .then(() => pc!.createAnswer())
        .then((answer) => pc!.setLocalDescription(answer))
        .then(() => sendAnswer(fromId, pc!.localDescription!))
        .catch((err) => {
          console.warn('WebRTC answer failed:', err)
          closeConnection(fromId)
        })
    } else if (e.type === 'WEBRTC_ANSWER' && e.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(e.sdp)).catch((err) => {
        console.warn('WebRTC setRemoteDescription (answer) failed:', err)
        closeConnection(fromId)
      })
    } else if (e.type === 'WEBRTC_ICE_CANDIDATE' && e.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(e.candidate)).catch((err) => {
        console.warn('WebRTC addIceCandidate failed:', err)
      })
    }
  }

  function setLocalStream(stream: MediaStream | null) {
    connections.forEach((pc) => {
      pc.getSenders().forEach((s) => pc.removeTrack(s))
      stream?.getTracks().forEach((track) => pc.addTrack(track, stream))
    })
  }

  function start() {
    unsubscribe = realtime.on(roomId, (ev: unknown) => {
      const evt = ev as { type?: string }
      if (evt.type === 'WEBRTC_OFFER' || evt.type === 'WEBRTC_ANSWER' || evt.type === 'WEBRTC_ICE_CANDIDATE') {
        handleEvent(ev)
      }
    })
  }

  function destroy() {
    unsubscribe?.()
    unsubscribe = null
    connections.forEach((pc) => pc.close())
    connections.clear()
  }

  return { addPeer, removePeer, setLocalStream, start, destroy }
}

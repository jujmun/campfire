export interface Participant {
  id: string
  name: string
  stream?: MediaStream
  isMuted?: boolean
  isLocal?: boolean
}

export interface SpatialParticipant {
  id: string
  name: string
  x: number
  y: number
  vx?: number
  vy?: number
  isMuted?: boolean
  isLocal?: boolean
  avatarUrl?: string
  avatarColor?: string
  stream?: MediaStream
}

export interface StrokePoint {
  x: number
  y: number
  pressure?: number
}

export type LayoutMode = 'split' | 'full-whiteboard'

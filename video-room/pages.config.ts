/**
 * Base44-style pages config.
 * Room is the main page at /.
 */

export interface PageConfig {
  path: string
  component: string
  title?: string
}

export const pages: PageConfig[] = [
  { path: '/', component: 'Room', title: 'Room' },
  { path: '/room/:roomId', component: 'Room', title: 'Room' },
  { path: '/ipad', component: 'IpadPage', title: 'iPad Whiteboard' },
]

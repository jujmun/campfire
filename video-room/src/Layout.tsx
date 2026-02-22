/**
 * Base44 layout wrapper.
 * Wraps page content with consistent structure.
 */

import { Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--collab-bg)]">
      <Outlet />
    </div>
  )
}

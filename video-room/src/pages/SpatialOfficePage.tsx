/**
 * Spatial Office — shared whiteboard view.
 * Left: presence (overlapping avatars), sharing controls, media. Right: Alex's Whiteboard.
 */

import { Link } from 'react-router-dom'
import { CampfireLogo } from '../components/CampfireLogo'
import './SpatialOfficePage.css'

export function SpatialOfficePage() {
  return (
    <div className="spatial-office-page">
      {/* Left Panel */}
      <aside className="so-left-panel">
        <header className="so-left-header">
          <div className="so-logo-row">
            <CampfireLogo size={28} className="so-logo-icon" />
            <h1 className="so-title">Campfire</h1>
          </div>
        </header>

        <div className="so-search-placeholder" />

        <section className="so-presence">
          <div className="so-presence-ring">
            <div className="so-avatars-overlap">
              <div className="so-avatar so-avatar-alex">A</div>
              <div className="so-avatar so-avatar-emily">E</div>
            </div>
          </div>
          <div className="so-avatar-names">
            <span className="so-avatar-name so-name-active">Alex</span>
            <span className="so-avatar-name so-name-faded">Emily</span>
          </div>
          <div className="so-connected-pill">
            <span className="so-connected-icon">🔊</span>
            Connected to Emily
          </div>
        </section>

        <section className="so-sharing-cards">
          <div className="so-sharing-card">
            <div className="so-sharing-label">My Screenshare</div>
            <div className="so-sharing-preview so-preview-screenshare" />
          </div>
          <div className="so-sharing-card">
            <div className="so-sharing-label">My Whiteboard</div>
            <div className="so-sharing-preview so-preview-whiteboard" />
          </div>
        </section>

        <section className="so-media-controls">
          <button type="button" className="so-media-btn so-media-muted" aria-label="Microphone muted">
            🎤
          </button>
          <button type="button" className="so-media-btn" aria-label="Video">
            📹
          </button>
          <button type="button" className="so-media-btn" aria-label="Screen share">
            🖥️
          </button>
        </section>
      </aside>

      {/* Right Panel — Alex's Whiteboard */}
      <main className="so-right-panel">
        <header className="so-wb-header">
          <h2 className="so-wb-header-title">Alex&apos;s Whiteboard • Live</h2>
          <span className="so-wb-shared-badge">Shared by Alex</span>
        </header>

        <div className="so-wb-main">
          <div className="so-wb-canvas-wrap">
            <div className="so-wb-canvas-badge">Alex&apos;s Whiteboard</div>
            <div className="so-wb-participants-icon" aria-label="Participants">👥</div>
            <div className="so-wb-canvas">
              <div className="so-wb-drawing">
                <div className="so-wb-sun" />
                <div className="so-wb-cloud" />
                <div className="so-wb-text">Hello Emily!</div>
                <svg className="so-wb-stick-figure" viewBox="0 0 40 80" width="40" height="80">
                  <circle cx="20" cy="10" r="8" fill="#3b82f6" />
                  <line x1="20" y1="18" x2="20" y2="40" stroke="#3b82f6" strokeWidth="2" />
                  <line x1="20" y1="28" x2="8" y2="24" stroke="#3b82f6" strokeWidth="2" />
                  <line x1="20" y1="28" x2="32" y2="24" stroke="#3b82f6" strokeWidth="2" />
                  <line x1="20" y1="40" x2="12" y2="62" stroke="#3b82f6" strokeWidth="2" />
                  <line x1="20" y1="40" x2="28" y2="62" stroke="#3b82f6" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="so-wb-toolbar">
            <div className="so-wb-toolbar-left">
              <button type="button" className="so-wb-tool-btn active" title="Pen">✏️</button>
              <button type="button" className="so-wb-tool-btn" title="Eraser">🧹</button>
            </div>
            <div className="so-wb-toolbar-mid">
              <button type="button" className="so-wb-color-swatch" style={{ background: '#3b82f6' }} />
              <div className="so-wb-brush-slider">
                <span className="so-wb-slider-dot" />
                <span className="so-wb-slider-dot" />
              </div>
            </div>
            <div className="so-wb-toolbar-right">
              <button type="button" className="so-wb-tool-btn" aria-label="More">⋯</button>
              <button type="button" className="so-wb-tool-btn" aria-label="Undo">↶</button>
              <button type="button" className="so-wb-tool-btn" aria-label="Redo">↷</button>
              <button type="button" className="so-wb-tool-btn" aria-label="Share">↑</button>
              <button type="button" className="so-wb-tool-btn" aria-label="Pages">📄</button>
            </div>
          </div>
        </div>
      </main>

      <Link to="/" className="so-back-link">← Back to Room</Link>
    </div>
  )
}

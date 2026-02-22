/**
 * Base44 layout + router.
 * Room is the main page at /.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './Layout'
import { Room } from './pages/Room'
import { IpadPage } from './pages/IpadPage'
import { SpatialOfficePage } from './pages/SpatialOfficePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Room />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/ipad" element={<IpadPage />} />
          <Route path="/spatial-office" element={<SpatialOfficePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

/**
 * Base44 layout + router.
 * JoinPage at /; Room at /room/:roomId.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './Layout'
import { JoinPage } from './pages/JoinPage'
import { Room } from './pages/Room'
import { IpadPage } from './pages/IpadPage'
import { SpatialOfficePage } from './pages/SpatialOfficePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<JoinPage />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/ipad" element={<IpadPage />} />
          <Route path="/spatial-office" element={<SpatialOfficePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

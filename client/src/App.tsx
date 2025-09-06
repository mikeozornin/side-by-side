import { Routes, Route } from 'react-router-dom'
import { VotingList } from './pages/VotingList'
import { CreateVoting } from './pages/CreateVoting'
import { VotingPage } from './pages/VotingPage'
import { Settings } from './pages/Settings'
import { ThemeProvider } from './components/ThemeProvider'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Toaster } from './components/ui/toaster'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<VotingList />} />
            <Route path="/new" element={
              <ProtectedRoute returnTo="/#/new">
                <CreateVoting />
              </ProtectedRoute>
            } />
            <Route path="/v/:id" element={<VotingPage />} />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
          </Routes>
          <Toaster position="top-center" />
        </div>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App

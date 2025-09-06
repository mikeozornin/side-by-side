import { Routes, Route } from 'react-router-dom'
import { VotingList } from './pages/VotingList'
import { CreateVoting } from './pages/CreateVoting'
import { VotingPage } from './pages/VotingPage'
import { ThemeProvider } from './components/ThemeProvider'
import { Toaster } from './components/ui/toaster'

function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<VotingList />} />
          <Route path="/new" element={<CreateVoting />} />
          <Route path="/v/:id" element={<VotingPage />} />
        </Routes>
        <Toaster position="top-center" />
      </div>
    </ThemeProvider>
  )
}

export default App

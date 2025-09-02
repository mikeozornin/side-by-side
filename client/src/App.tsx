import { Routes, Route } from 'react-router-dom'
import { VotingList } from './pages/VotingList'
import { CreateVoting } from './pages/CreateVoting'
import { VotingPage } from './pages/VotingPage'
import { ThemeProvider } from './components/ThemeProvider'

function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<VotingList />} />
          <Route path="/new" element={<CreateVoting />} />
          <Route path="/v/:id" element={<VotingPage />} />
        </Routes>
      </div>
    </ThemeProvider>
  )
}

export default App

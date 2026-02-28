import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import PlanReview from './pages/PlanReview'
import LearnSession from './pages/LearnSession'
import Profile from './pages/Profile'
import Trajectory from './pages/Trajectory'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/plan/:planId" element={<PlanReview />} />
        <Route path="/learn/:planId/:sessionId" element={<LearnSession />} />
        <Route path="/profile/:learnerId" element={<Profile />} />
        <Route path="/trajectory/:learnerId" element={<Trajectory />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App


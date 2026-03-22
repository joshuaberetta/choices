import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import ChoiceListsPage from './pages/ChoiceListsPage'
import ChoiceListDetailPage from './pages/ChoiceListDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gradient-to-r from-indigo-600 to-purple-700 shadow">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <Link to="/" className="inline-flex flex-col">
              <span className="text-xl font-bold text-white tracking-tight">Choices Manager</span>
              <span className="text-indigo-200 text-sm">KoboToolbox external choice lists</span>
            </Link>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<ChoiceListsPage />} />
            <Route path="/choice-lists/:id" element={<ChoiceListDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

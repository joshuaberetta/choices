import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import ChoiceListsPage from './pages/ChoiceListsPage'
import ChoiceListDetailPage from './pages/ChoiceListDetailPage'
import LoginPage from './pages/LoginPage'
import ChangePasswordModal from './components/ChangePasswordModal'
import HelpPage from './pages/HelpPage'
import PublicProjectDetailPage from './pages/PublicProjectDetailPage'
import { useAuthStore } from './store/authStore'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { user, checkAuth, logout } = useAuthStore()
  const [showChangePassword, setShowChangePassword] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gradient-to-r from-indigo-600 to-purple-700 shadow">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-3">
              <img src="/icon.png" alt="Choices" className="h-9 w-9" />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-white tracking-tight">Choices</span>
                <span className="text-indigo-200 text-sm">External choice lists for KoboToolbox</span>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                to="/help"
                className="text-indigo-200 hover:text-white text-sm transition-colors"
              >
                Help
              </Link>
              {user && (
                <>
                  <span className="text-indigo-200 text-sm">{user.username}</span>
                  {/* <button
                    onClick={() => setShowChangePassword(true)}
                    className="text-indigo-200 hover:text-white text-sm transition-colors"
                  >
                    Change password
                  </button> */}
                  <button
                    onClick={() => logout()}
                    className="bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded transition-colors"
                  >
                    Log out
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/public/projects/:id" element={<PublicProjectDetailPage />} />
            <Route path="/" element={<ProtectedRoute><ChoiceListsPage /></ProtectedRoute>} />
            <Route path="/:projectSlug/:choiceListSlug" element={<ProtectedRoute><ChoiceListDetailPage /></ProtectedRoute>} />
            <Route path="/help" element={<HelpPage />} />
          </Routes>
        </main>
        {showChangePassword && (
          <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
        )}
      </div>
    </BrowserRouter>
  )
}

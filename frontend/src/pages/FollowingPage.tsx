import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFollowedLists } from '../hooks/useFollowedLists'
import apiClient from '../services/api'

export default function FollowingPage() {
  const { configs, loading, error, refetch } = useFollowedLists()
  const [copied, setCopied] = useState<number | null>(null)
  const [unfollowing, setUnfollowing] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleUnfollow = async (id: number) => {
    if (!confirm('Unfollow this list? Your column customisations will be lost.')) return
    setUnfollowing(id)
    try {
      await apiClient.unfollowList(id)
      refetch()
      showToast('Unfollowed list.')
    } catch {
      showToast('Failed to unfollow.')
    } finally {
      setUnfollowing(null)
    }
  }

  const copyUrl = (config: (typeof configs)[0]) => {
    const url = `${window.location.origin}${config.export_url}`
    navigator.clipboard.writeText(url)
    setCopied(config.id)
    setTimeout(() => setCopied(c => (c === config.id ? null : c)), 1500)
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Following</h1>
        <p className="text-sm text-gray-500 mt-1">
          Choice lists you follow, with your personal column customisations.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && configs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">You are not following any lists yet.</p>
          <p className="text-sm mt-2">
            Browse <Link to="/collections/public" className="text-indigo-600 hover:underline">public collections</Link> or{' '}
            <Link to="/public/projects" className="text-indigo-600 hover:underline">public projects</Link> and click "Follow" on a choice list.
          </p>
        </div>
      )}

      {!loading && !error && configs.length > 0 && (
        <div className="space-y-3">
          {configs.map(cfg => (
            <div key={cfg.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/following/${cfg.id}`}
                      className="text-base font-semibold text-indigo-700 hover:underline truncate"
                    >
                      {cfg.choice_list_name}
                    </Link>
                    <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded">
                      Following
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {cfg.project_name}{' '}
                    <span className="text-gray-400">by {cfg.owner_username}</span>
                  </p>
                  {cfg.label_column_name && (
                    <p className="text-xs text-gray-400 mt-1">
                      Custom label column: <span className="font-mono">{cfg.label_column_name}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyUrl(cfg)}
                    className="text-xs bg-gray-50 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-600 hover:text-indigo-700 px-3 py-1.5 rounded transition-colors"
                    title="Copy public CSV export URL"
                  >
                    {copied === cfg.id ? '✓ Copied' : 'Copy CSV URL'}
                  </button>
                  <Link
                    to={`/following/${cfg.id}`}
                    className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => handleUnfollow(cfg.id)}
                    disabled={unfollowing === cfg.id}
                    className="text-xs bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                  >
                    {unfollowing === cfg.id ? 'Removing…' : 'Unfollow'}
                  </button>
                </div>
              </div>

              {cfg.columns.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {cfg.columns.map(col => (
                    <span
                      key={col.id}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono"
                    >
                      {col.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import apiClient, { type PublicProject } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function PublicProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [project, setProject] = useState<PublicProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [expandedLists, setExpandedLists] = useState<Set<number>>(new Set())

  // Follow state: map from choice_list id → config id (or null if not followed)
  const [followedMap, setFollowedMap] = useState<Record<number, number>>({})
  const [followingId, setFollowingId] = useState<number | null>(null)
  const [followingAll, setFollowingAll] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    if (!id) return
    apiClient.getPublicProject(id)
      .then(res => {
        const p = res.data as unknown as PublicProject
        setProject(p)
        // Expand all lists by default
        if (p.choice_lists) setExpandedLists(new Set(p.choice_lists.map(l => l.id)))
      })
      .catch(() => setError('Project not found or not public.'))
      .finally(() => setLoading(false))
  }, [id])

  // Load follow states when user is logged in
  useEffect(() => {
    if (!user) return
    apiClient.getFollowedLists().then(res => {
      const map: Record<number, number> = {}
      res.data.results.forEach(cfg => { map[cfg.choice_list] = cfg.id })
      setFollowedMap(map)
    }).catch(() => {/* non-critical */})
  }, [user])

  const toggleList = (listId: number) =>
    setExpandedLists(prev => {
      const next = new Set(prev)
      next.has(listId) ? next.delete(listId) : next.add(listId)
      return next
    })

  const copyUrl = (url: string, slug: string) => {
    navigator.clipboard.writeText(url)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(s => s === slug ? null : s), 1500)
  }

  const handleFollow = async (listId: number) => {
    setFollowingId(listId)
    try {
      const res = await apiClient.followList(listId)
      setFollowedMap(prev => ({ ...prev, [listId]: res.data.id }))
      showToast('Added to your Following list.')
    } catch {
      showToast('Failed to follow list.')
    } finally {
      setFollowingId(null)
    }
  }

  const handleUnfollow = async (listId: number) => {
    const configId = followedMap[listId]
    if (!configId) return
    setFollowingId(listId)
    try {
      await apiClient.unfollowList(configId)
      setFollowedMap(prev => { const n = { ...prev }; delete n[listId]; return n })
      showToast('Unfollowed.')
    } catch {
      showToast('Failed to unfollow.')
    } finally {
      setFollowingId(null)
    }
  }

  const handleFollowAll = async () => {
    if (!project) return
    setFollowingAll(true)
    let followed = 0
    for (const list of project.choice_lists ?? []) {
      if (followedMap[list.id]) continue
      try {
        const res = await apiClient.followList(list.id)
        setFollowedMap(prev => ({ ...prev, [list.id]: res.data.id }))
        followed++
      } catch {
        // skip already-followed or permission errors
      }
    }
    setFollowingAll(false)
    showToast(followed > 0
      ? `Followed ${followed} list${followed !== 1 ? 's' : ''}.`
      : 'All lists already followed.')
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
  if (error || !project) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
      {error ?? 'Project not found.'}
      <div className="mt-3"><Link to="/" className="text-indigo-600 hover:underline">← Back to Projects</Link></div>
    </div>
  )

  return (
    <div>
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
      <div className="mb-6">
        <Link to="/" className="text-sm text-indigo-600 hover:underline">← Back to Projects</Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">by {project.owner_username}</p>
            {project.description && <p className="text-gray-600 mt-2 text-sm">{project.description}</p>}
          </div>
          <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded shrink-0">Public</span>
        </div>
        {user && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {project.choice_lists && project.choice_lists.length > 0 && (
              <button
                onClick={handleFollowAll}
                disabled={followingAll}
                className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {followingAll ? 'Following…' : 'Follow project'}
              </button>
            )}
            <p className="text-xs text-indigo-600">
              Logged in as <strong>{user.username}</strong>.{' '}
              {project.owner_username === user.username
                ? <Link to="/" className="underline">Manage this project →</Link>
                : 'You can manage shared projects from your Projects page.'}
            </p>
          </div>
        )}
      </div>

      {!project.choice_lists || project.choice_lists.length === 0 ? (
        <div className="text-center py-12 text-gray-400">This project has no public choice lists yet.</div>
      ) : (
        <div className="space-y-3">
          {project.choice_lists.map(list => {
            const csvUrl = `${window.location.origin}/${project.owner_username}/${project.slug}/${list.slug}/export/${list.slug}.csv`
            const isExpanded = expandedLists.has(list.id)
            return (
              <div key={list.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4">
                  <button
                    onClick={() => toggleList(list.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <span className="font-semibold text-gray-900">{list.name}</span>
                    <span className="text-xs font-mono text-gray-400">{list.slug}</span>
                    <span className="text-xs text-gray-400">{list.choices.length} choice{list.choices.length !== 1 ? 's' : ''}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {user && (
                      followedMap[list.id] ? (
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/following/${followedMap[list.id]}`}
                            className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors"
                          >
                            Following ✓
                          </Link>
                          <button
                            onClick={() => handleUnfollow(list.id)}
                            disabled={followingId === list.id}
                            className="text-xs text-gray-400 hover:text-red-500 px-2 py-1.5 rounded transition-colors disabled:opacity-50"
                            title="Unfollow"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleFollow(list.id)}
                          disabled={followingId === list.id}
                          className="text-xs bg-gray-50 border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                        >
                          {followingId === list.id ? 'Following…' : 'Follow'}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => copyUrl(csvUrl, list.slug)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
                    >
                      {copiedSlug === list.slug ? '✓ Copied!' : 'Copy CSV URL'}
                    </button>
                  </div>
                </div>

                {/* Choices table */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {list.description && (
                      <p className="px-5 pt-3 text-sm text-gray-500">{list.description}</p>
                    )}
                    {list.choices.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-gray-400">No choices yet.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                            <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Label</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.choices.map((choice, i) => (
                            <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-2.5 font-mono text-xs text-gray-500">{choice.value}</td>
                              <td className="px-5 py-2.5 text-gray-800">{choice.label}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

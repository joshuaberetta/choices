import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import apiClient, { type PublicCollection, type PublicChoiceList, type CollectionProjectSummary } from '../services/api'
import { useAuthStore } from '../store/authStore'

const PAGE_SIZE = 10

function buildCsvUrl(ownerUsername: string, projectSlug: string, listSlug: string): string {
  return `${window.location.origin}/${ownerUsername}/${projectSlug}/${listSlug}/export/${listSlug}.csv`
}

export default function PublicCollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [collection, setCollection] = useState<PublicCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Paginated projects
  const [projects, setProjects] = useState<CollectionProjectSummary[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [numPages, setNumPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set())
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  // Follow state: map from choice_list id → config id
  const [followedMap, setFollowedMap] = useState<Record<number, number>>({})
  const [followingId, setFollowingId] = useState<number | null>(null)
  const [followingProjectId, setFollowingProjectId] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // Fetch collection metadata
  useEffect(() => {
    if (!id) return
    apiClient.getPublicCollection(Number(id))
      .then(res => setCollection(res.data))
      .catch(() => setError('Collection not found or not public.'))
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

  // Fetch a page of projects
  const fetchProjects = useCallback(async (collId: number, p: number, q: string) => {
    setProjectsLoading(true)
    try {
      const res = await apiClient.getPublicCollectionProjects(collId, p, PAGE_SIZE, q)
      setProjects(res.data.results)
      setNumPages(res.data.num_pages)
      setTotalCount(res.data.count)
      setPage(res.data.page)
      setExpandedProjects(new Set(res.data.results.map(proj => proj.id)))
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!id) return
    fetchProjects(Number(id), 1, search)
  }, [id, fetchProjects, search])

  const goToPage = (p: number) => {
    if (!id || p < 1 || p > numPages) return
    fetchProjects(Number(id), p, search)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const toggleProject = (pid: number) => setExpandedProjects(prev => {
    const next = new Set(prev)
    next.has(pid) ? next.delete(pid) : next.add(pid)
    return next
  })

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(c => c === url ? null : c), 1500)
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
    const allLists = projects.flatMap(p => (p.choice_lists ?? []).filter(l => !followedMap[l.id]))
    if (allLists.length === 0) { showToast('All visible lists are already followed.'); return }
    let followed = 0
    for (const list of allLists) {
      try {
        const res = await apiClient.followList(list.id)
        setFollowedMap(prev => ({ ...prev, [list.id]: res.data.id }))
        followed++
      } catch {
        // skip already-followed or permission errors
      }
    }
    showToast(`Followed ${followed} list${followed !== 1 ? 's' : ''}.`)
  }

  const handleFollowProject = async (projectId: number, lists: PublicChoiceList[]) => {
    setFollowingProjectId(projectId)
    let followed = 0
    for (const list of lists) {
      if (followedMap[list.id]) continue
      try {
        const res = await apiClient.followList(list.id)
        setFollowedMap(prev => ({ ...prev, [list.id]: res.data.id }))
        followed++
      } catch {
        // skip already-followed or permission errors
      }
    }
    setFollowingProjectId(null)
    showToast(followed > 0
      ? `Followed ${followed} list${followed !== 1 ? 's' : ''}.`
      : 'All lists in this project already followed.')
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
  if (error || !collection) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
      {error ?? 'Collection not found.'}
      <div className="mt-3"><Link to="/collections/public" className="text-indigo-600 hover:underline">← Public Collections</Link></div>
    </div>
  )

  return (
    <div>
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
      <div className="mb-4 text-sm text-gray-500">
        <Link to="/collections/public" className="hover:text-indigo-600">Public Collections</Link>
        <span className="mx-1.5">›</span>
        <span className="text-gray-700 font-medium">{collection.name}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{collection.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">by {collection.owner_username}</p>
            {collection.description && (
              <p className="text-gray-500 mt-2 text-sm">{collection.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {collection.project_count} project{collection.project_count !== 1 ? 's' : ''} · Updated {new Date(collection.updated_at).toLocaleDateString()}
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleFollowAll}
                className="text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-300 transition-colors"
              >
                Follow collection
              </button>
              <Link
                to="/collections"
                className="text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-300 transition-colors"
              >
                My Collections →
              </Link>
            </div>
          )}
          {!user && (
            <Link
              to="/collections"
              className="text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-300 transition-colors shrink-0"
            >
              My Collections →
            </Link>
          )}
        </div>
      </div>

      {projectsLoading && !projects.length ? (
        <div className="flex items-center justify-center py-16 text-gray-400">Loading projects…</div>
      ) : (
        <>
          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Search projects…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setSearchInput('') }}
                className="px-3 py-2 border border-gray-200 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
          </form>

          {projectsLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">Loading…</div>
          ) : totalCount === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400 text-sm">
              {search ? `No projects matching "${search}".` : 'This collection has no projects yet.'}
            </div>
      ) : (
        <>
          {/* Page info */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} project{totalCount !== 1 ? 's' : ''}
            </p>
            {numPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                {Array.from({ length: numPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`px-2.5 py-1 text-xs border rounded-lg transition-colors ${
                      p === page
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= numPages}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {projects.map(project => {
              const expanded = expandedProjects.has(project.id)
              const lists: PublicChoiceList[] = project.choice_lists ?? []
              return (
                <div key={project.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4">
                    <button
                      onClick={() => toggleProject(project.id)}
                      className="flex-1 flex items-center gap-3 text-left hover:opacity-80 transition-opacity min-w-0"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-900">{project.name}</span>
                        {project.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{project.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          by {project.owner_username} · {project.list_count} list{project.list_count !== 1 ? 's' : ''} · Updated {new Date(project.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`text-gray-400 transition-transform ml-2 shrink-0 ${expanded ? 'rotate-90' : ''}`}>›</span>
                    </button>
                    {user && lists.length > 0 && (
                      <button
                        onClick={() => handleFollowProject(project.id, lists)}
                        disabled={followingProjectId === project.id}
                        className="ml-3 shrink-0 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {followingProjectId === project.id ? 'Following…' : 'Follow project'}
                      </button>
                    )}
                  </div>

                  {expanded && (
                    <div className="border-t border-gray-100">
                      {lists.length === 0 ? (
                        <p className="px-5 py-4 text-sm text-gray-400">No choice lists.</p>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {lists.map(list => {
                            const csvUrl = buildCsvUrl(project.owner_username, project.slug, list.slug)
                            const choices = list.choices ?? []
                            return (
                              <div key={list.id} className="px-5 py-4">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <div>
                                    <span className="font-medium text-gray-800 text-sm">{list.name}</span>
                                    {list.description && <p className="text-xs text-gray-400">{list.description}</p>}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {user && (
                                      followedMap[list.id] ? (
                                        <div className="flex items-center gap-1">
                                          <Link
                                            to={`/following/${followedMap[list.id]}`}
                                            className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-2.5 py-1 rounded transition-colors"
                                          >
                                            Following ✓
                                          </Link>
                                          <button
                                            onClick={() => handleUnfollow(list.id)}
                                            disabled={followingId === list.id}
                                            className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded transition-colors disabled:opacity-50"
                                            title="Unfollow"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => handleFollow(list.id)}
                                          disabled={followingId === list.id}
                                          className="text-xs bg-gray-50 border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                                        >
                                          {followingId === list.id ? 'Following…' : 'Follow'}
                                        </button>
                                      )
                                    )}
                                    <button
                                      onClick={() => copyUrl(csvUrl)}
                                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                                        copiedUrl === csvUrl
                                          ? 'bg-green-100 border-green-300 text-green-700'
                                          : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                                      }`}
                                    >
                                      {copiedUrl === csvUrl ? '✓ Copied' : 'Copy CSV URL'}
                                    </button>
                                  </div>
                                </div>
                                {choices.length > 0 && (
                                  <div className="mt-1 max-h-40 overflow-y-auto">
                                    <table className="w-full text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-gray-50">
                                          <th className="text-left px-2 py-1 text-gray-500 font-medium border border-gray-200">Name</th>
                                          <th className="text-left px-2 py-1 text-gray-500 font-medium border border-gray-200">Label</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {choices.map((choice, i) => (
                                          <tr key={i} className="hover:bg-gray-50">
                                            <td className="px-2 py-1 border border-gray-200 font-mono text-gray-600">{choice.value}</td>
                                            <td className="px-2 py-1 border border-gray-200 text-gray-800">{choice.label}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bottom pagination */}
          {numPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-6">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              {Array.from({ length: numPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                    p === page
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= numPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </>
  )}
    </div>
  )
}


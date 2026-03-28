import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import apiClient, { type PublicProject, type PublicChoiceList } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function PublicChoiceListDetailPage() {
  const { projectId, listSlug } = useParams<{ projectId: string; listSlug: string }>()
  const { user } = useAuthStore()

  const [project, setProject] = useState<PublicProject | null>(null)
  const [list, setList] = useState<PublicChoiceList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [choiceSearch, setChoiceSearch] = useState('')
  const [choicePage, setChoicePage] = useState(1)
  const [choicePageSize, setChoicePageSize] = useState<25 | 50 | 100>(50)

  const [followedMap, setFollowedMap] = useState<Record<number, number>>({})
  const [followingId, setFollowingId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    if (!projectId) return
    apiClient.getPublicProject(projectId)
      .then(res => {
        const p = res.data as unknown as PublicProject
        setProject(p)
        const found = (p.choice_lists ?? []).find(l => l.slug === listSlug)
        if (found) setList(found)
        else setError('Choice list not found.')
      })
      .catch(() => setError('Project not found or not public.'))
      .finally(() => setLoading(false))
  }, [projectId, listSlug])

  useEffect(() => {
    if (!user) return
    apiClient.getFollowedLists().then(res => {
      const map: Record<number, number> = {}
      res.data.results.forEach(cfg => { map[cfg.choice_list] = cfg.id })
      setFollowedMap(map)
    }).catch(() => {})
  }, [user])

  const handleFollow = async () => {
    if (!list) return
    setFollowingId(list.id)
    try {
      const res = await apiClient.followList(list.id)
      setFollowedMap(prev => ({ ...prev, [list.id]: res.data.id }))
      showToast('Added to your Following list.')
    } catch {
      showToast('Failed to follow list.')
    } finally {
      setFollowingId(null)
    }
  }

  const handleUnfollow = async () => {
    if (!list) return
    const configId = followedMap[list.id]
    if (!configId) return
    setFollowingId(list.id)
    try {
      await apiClient.unfollowList(configId)
      setFollowedMap(prev => { const n = { ...prev }; delete n[list.id]; return n })
      showToast('Unfollowed.')
    } catch {
      showToast('Failed to unfollow.')
    } finally {
      setFollowingId(null)
    }
  }

  const csvUrl = project && list
    ? `${window.location.origin}/${project.owner_username}/${project.slug}/${list.slug}/export/${list.slug}.csv`
    : ''

  const copyUrl = () => {
    navigator.clipboard.writeText(csvUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const choices = list?.choices ?? []

  const filteredChoices = useMemo(() => {
    if (!choiceSearch) return choices
    const q = choiceSearch.toLowerCase()
    return choices.filter(c =>
      c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
    )
  }, [choices, choiceSearch])

  const choiceTotalPages = Math.max(1, Math.ceil(filteredChoices.length / choicePageSize))
  const clampedPage = Math.min(choicePage, choiceTotalPages)
  const pagedChoices = filteredChoices.slice((clampedPage - 1) * choicePageSize, clampedPage * choicePageSize)

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
  if (error || !project || !list) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
      {error ?? 'Not found.'}
      <div className="mt-3">
        <Link to={`/public/projects/${projectId}`} className="text-indigo-600 hover:underline">← Back to project</Link>
      </div>
    </div>
  )

  const configId = followedMap[list.id]

  return (
    <div>
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-500">
        <Link to={`/public/projects/${projectId}`} className="hover:text-indigo-600">{project.name}</Link>
        <span className="mx-1.5">›</span>
        <span className="text-gray-700 font-medium">{list.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{list.name}</h1>
              <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{list.slug}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {project.name} <span className="text-gray-400">by {project.owner_username}</span>
            </p>
            {list.description && <p className="text-gray-500 mt-2 text-sm">{list.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              configId ? (
                <div className="flex items-center gap-1">
                  <Link
                    to={`/following/${configId}`}
                    className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Following ✓
                  </Link>
                  <button
                    onClick={handleUnfollow}
                    disabled={followingId === list.id}
                    className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {followingId === list.id ? '…' : 'Unfollow'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleFollow}
                  disabled={followingId === list.id}
                  className="text-xs bg-gray-50 border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {followingId === list.id ? 'Following…' : 'Follow'}
                </button>
              )
            )}
            <button
              onClick={copyUrl}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                copied ? 'bg-green-100 border-green-300 text-green-700' : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {copied ? '✓ Copied!' : 'Copy CSV URL'}
            </button>
          </div>
        </div>
      </div>

      {/* Choices table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Choices
            <span className="ml-2 text-xs text-gray-400 font-normal">
              {choiceSearch ? `${filteredChoices.length} of ${choices.length}` : choices.length}
            </span>
          </h2>
        </div>

        {/* Search + page size */}
        {choices.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-100 bg-gray-50/50">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by label or name…"
                value={choiceSearch}
                onChange={e => { setChoiceSearch(e.target.value); setChoicePage(1) }}
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              {choiceSearch && (
                <button onClick={() => { setChoiceSearch(''); setChoicePage(1) }} className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-gray-400 mr-1">Per page:</span>
              {([25, 50, 100] as const).map(n => (
                <button
                  key={n}
                  onClick={() => { setChoicePageSize(n); setChoicePage(1) }}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    choicePageSize === n ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {choices.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No choices in this list.</div>
        ) : filteredChoices.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            No choices match "<span className="font-medium text-gray-600">{choiceSearch}</span>"
            <span className="block mt-1">
              <button onClick={() => setChoiceSearch('')} className="text-indigo-600 hover:underline text-xs">Clear search</button>
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Label</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                </tr>
              </thead>
              <tbody>
                {pagedChoices.map((choice, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-900">{choice.label}</td>
                    <td className="px-5 py-3">
                      <code className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{choice.value}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredChoices.length > 0 && choiceTotalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <button
              onClick={() => setChoicePage(p => Math.max(1, p - 1))}
              disabled={clampedPage <= 1}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>
            <span className="text-sm text-gray-500">
              Page <span className="font-semibold text-gray-700">{clampedPage}</span> of{' '}
              <span className="font-semibold text-gray-700">{choiceTotalPages}</span>
              <span className="hidden sm:inline text-gray-400"> · {filteredChoices.length} choice{filteredChoices.length !== 1 ? 's' : ''}</span>
            </span>
            <button
              onClick={() => setChoicePage(p => Math.min(choiceTotalPages, p + 1))}
              disabled={clampedPage >= choiceTotalPages}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

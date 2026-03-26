import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import apiClient, { type PublicCollection } from '../services/api'

export default function PublicCollectionsPage() {
  const [collections, setCollections] = useState<PublicCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const load = useCallback((q: string) => {
    setLoading(true)
    apiClient.getPublicCollections(q || undefined)
      .then(res => setCollections((res.data as any).results ?? (res.data as unknown as PublicCollection[])))
      .catch(() => setError('Failed to load public collections.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(search) }, [load, search])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Public Collections</h1>
        <p className="text-sm text-gray-500 mt-0.5">Browse publicly shared choice list collections.</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by name, description, or owner…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setSearchInput('') }}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
          >
            Clear
          </button>
        )}
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">{error}</div>
      ) : collections.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400 text-sm">
          {search ? 'No collections matched your search.' : 'No public collections yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map(col => (
            <Link
              key={col.id}
              to={`/collections/public/${col.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {col.name}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">by {col.owner_username}</p>
                  {col.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{col.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{col.project_count} project{col.project_count !== 1 ? 's' : ''}</span>
                    <span>Updated {new Date(col.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className="text-xs text-indigo-500 group-hover:text-indigo-700 shrink-0 mt-1">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

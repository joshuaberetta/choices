import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import apiClient, { type Collection } from '../services/api'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function MyCollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Delete
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    apiClient.getCollections()
      .then(res => setCollections(res.data.results ?? (res.data as unknown as Collection[])))
      .catch(() => setError('Failed to load collections.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      await apiClient.createCollection({ name: newName, slug: newSlug || slugify(newName), description: newDesc })
      setNewName(''); setNewSlug(''); setNewDesc('')
      setShowCreate(false)
      load()
    } catch (err: any) {
      const detail = err.response?.data?.slug?.[0] ?? err.response?.data?.name?.[0] ?? err.response?.data?.detail ?? 'Failed to create collection.'
      setCreateError(detail)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this collection? This will not delete any projects.')) return
    setDeletingId(id)
    try {
      await apiClient.deleteCollection(id)
      setCollections(cs => cs.filter(c => c.id !== id))
    } catch {
      alert('Failed to delete collection.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
  if (error) return <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">{error}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collections</h1>
          <p className="text-sm text-gray-500 mt-0.5">Group your projects for easier organisation and sharing.</p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + New Collection
        </button>
      </div>

      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Create Collection</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                value={newName}
                onChange={e => { setNewName(e.target.value); if (!newSlug) setNewSlug(slugify(e.target.value)) }}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Global PCodes"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Slug <span className="text-red-500">*</span></label>
              <input
                value={newSlug}
                onChange={e => setNewSlug(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="global-pcodes"
              />
              <p className="text-xs text-gray-400 mt-0.5">Unique identifier used in the URL.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional description…"
              />
            </div>
            {createError && <p className="text-xs text-red-600">{createError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setCreateError(null) }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {collections.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400 text-sm">
          No collections yet. Create your first collection to group projects together.
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map(col => (
            <div key={col.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/collections/${col.id}`}
                      className="text-base font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                    >
                      {col.name}
                    </Link>
                    {col.is_public && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Public</span>
                    )}
                    {col.role === 'shared' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        Shared by {col.owner_username}
                      </span>
                    )}
                  </div>
                  {col.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{col.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    <span>{col.project_count} project{col.project_count !== 1 ? 's' : ''}</span>
                    <span>Updated {new Date(col.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/collections/${col.id}`}
                    className="text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-300 transition-colors"
                  >
                    Open
                  </Link>
                  {col.role === 'owner' && (
                    <button
                      onClick={() => handleDelete(col.id)}
                      disabled={deletingId === col.id}
                      className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-300 transition-colors disabled:opacity-50"
                    >
                      {deletingId === col.id ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

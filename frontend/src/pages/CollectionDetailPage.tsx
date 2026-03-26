import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import apiClient, { type Collection, type CollectionShare, type Project, type PaginatedResponse } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const collectionId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [collection, setCollection] = useState<Collection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Settings panel
  const [showSettings, setShowSettings] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPublic, setEditPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sharing
  const [shares, setShares] = useState<CollectionShare[]>([])
  const [sharesLoading, setSharesLoading] = useState(false)
  const [shareInput, setShareInput] = useState('')
  const [shareError, setShareError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [removingShare, setRemovingShare] = useState<string | null>(null)

  // Add project
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [addProjectId, setAddProjectId] = useState('')
  const [addingProject, setAddingProject] = useState(false)
  const [addProjectError, setAddProjectError] = useState<string | null>(null)

  // Remove project
  const [removingProjectId, setRemovingProjectId] = useState<number | null>(null)

  const isOwner = collection?.role === 'owner'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getCollection(collectionId)
      setCollection(res.data)
      setEditName(res.data.name)
      setEditDesc(res.data.description)
      setEditPublic(res.data.is_public)
    } catch {
      setError('Collection not found.')
    } finally {
      setLoading(false)
    }
  }, [collectionId])

  const loadShares = useCallback(async () => {
    if (!isOwner) return
    setSharesLoading(true)
    try {
      const res = await apiClient.getCollectionShares(collectionId)
      setShares(res.data)
    } finally {
      setSharesLoading(false)
    }
  }, [collectionId, isOwner])

  const loadMyProjects = useCallback(async () => {
    try {
      const res = await apiClient.getProjects()
      const all = (res.data as unknown as PaginatedResponse<Project>).results ?? (res.data as unknown as Project[])
      setMyProjects(all)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (showSettings && isOwner) loadShares() }, [showSettings, isOwner, loadShares])
  useEffect(() => { loadMyProjects() }, [loadMyProjects])

  // Save settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const res = await apiClient.updateCollection(collectionId, {
        name: editName,
        description: editDesc,
        is_public: editPublic,
      })
      setCollection(res.data)
    } catch (err: any) {
      setSaveError(err.response?.data?.detail ?? 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  // Delete collection
  const handleDelete = async () => {
    if (!window.confirm('Delete this collection? This will not delete any projects.')) return
    try {
      await apiClient.deleteCollection(collectionId)
      navigate('/collections')
    } catch {
      alert('Failed to delete.')
    }
  }

  // Share
  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    setSharing(true)
    setShareError(null)
    try {
      await apiClient.shareCollection(collectionId, shareInput.trim())
      setShareInput('')
      loadShares()
    } catch (err: any) {
      setShareError(err.response?.data?.error ?? 'Failed to share.')
    } finally {
      setSharing(false)
    }
  }

  const handleRemoveShare = async (username: string) => {
    setRemovingShare(username)
    try {
      await apiClient.removeCollectionShare(collectionId, username)
      setShares(s => s.filter(sh => sh.username !== username))
    } finally {
      setRemovingShare(null)
    }
  }

  // Add project
  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addProjectId) return
    setAddingProject(true)
    setAddProjectError(null)
    try {
      const res = await apiClient.addProjectToCollection(collectionId, Number(addProjectId))
      setCollection(res.data)
      setAddProjectId('')
    } catch (err: any) {
      setAddProjectError(err.response?.data?.error ?? 'Failed to add project.')
    } finally {
      setAddingProject(false)
    }
  }

  // Remove project
  const handleRemoveProject = async (projectId: number) => {
    setRemovingProjectId(projectId)
    try {
      await apiClient.removeProjectFromCollection(collectionId, projectId)
      setCollection(prev => prev ? {
        ...prev,
        projects: prev.projects?.filter(p => p.id !== projectId),
        project_count: (prev.project_count ?? 1) - 1,
      } : prev)
    } catch {
      alert('Failed to remove project.')
    } finally {
      setRemovingProjectId(null)
    }
  }

  // Already-in-collection project IDs
  const memberIds = new Set(collection?.projects?.map(p => p.id) ?? [])
  const availableProjects = myProjects.filter(p => !memberIds.has(p.id))

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
  if (error || !collection) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
      {error ?? 'Collection not found.'}
      <div className="mt-3"><Link to="/collections" className="text-indigo-600 hover:underline">← Back to Collections</Link></div>
    </div>
  )

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-500">
        <Link to="/collections" className="hover:text-indigo-600">Collections</Link>
        <span className="mx-1.5">›</span>
        <span className="text-gray-700 font-medium">{collection.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{collection.name}</h1>
              {collection.is_public && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Public</span>
              )}
              {collection.role === 'shared' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Shared by {collection.owner_username}
                </span>
              )}
            </div>
            {collection.description && <p className="text-gray-500 mt-1 text-sm">{collection.description}</p>}
            <p className="text-xs text-gray-400 mt-0.5">
              {collection.project_count} project{collection.project_count !== 1 ? 's' : ''} · Updated {new Date(collection.updated_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && (
              <>
                <button
                  onClick={() => setShowSettings(v => !v)}
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  Settings
                </button>
                <button
                  onClick={handleDelete}
                  className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-300 transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && isOwner && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm space-y-5">
          <h2 className="text-sm font-semibold text-gray-700">Collection Settings</h2>

          {/* Edit form */}
          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={editPublic}
                  onChange={e => setEditPublic(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-9 h-5 rounded-full transition-colors ${editPublic ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full shadow transition-transform ${editPublic ? 'translate-x-4' : ''}`} />
                </div>
              </label>
              <span className="text-sm text-gray-700">Make this collection public</span>
              {editPublic && (
                <span className="text-xs text-green-600">Visible to anyone on the Public Collections page</span>
              )}
            </div>
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>

          {/* Share management */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Shared with</h3>
            {sharesLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : shares.length === 0 ? (
              <p className="text-sm text-gray-400">Not shared with anyone yet.</p>
            ) : (
              <ul className="space-y-1.5 mb-3">
                {shares.map(s => (
                  <li key={s.username} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{s.username}</span>
                    <button
                      onClick={() => handleRemoveShare(s.username)}
                      disabled={removingShare === s.username}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleShare} className="flex gap-2">
              <input
                value={shareInput}
                onChange={e => setShareInput(e.target.value)}
                placeholder="Username"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={sharing || !shareInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
              >
                {sharing ? 'Sharing…' : 'Share'}
              </button>
            </form>
            {shareError && <p className="text-xs text-red-600 mt-1">{shareError}</p>}
          </div>
        </div>
      )}

      {/* Add project */}
      {(isOwner || collection.role === 'shared') && availableProjects.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Add project to collection</h2>
          <form onSubmit={handleAddProject} className="flex gap-2">
            <select
              value={addProjectId}
              onChange={e => setAddProjectId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a project…</option>
              {availableProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={addingProject || !addProjectId}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
            >
              {addingProject ? 'Adding…' : 'Add'}
            </button>
          </form>
          {addProjectError && <p className="text-xs text-red-600 mt-1">{addProjectError}</p>}
        </div>
      )}

      {/* Projects list */}
      {!collection.projects || collection.projects.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400 text-sm">
          No projects in this collection yet.{' '}
          {(isOwner || collection.role === 'shared') && 'Add a project using the dropdown above.'}
        </div>
      ) : (
        <div className="space-y-3">
          {collection.projects.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/`}
                    state={{ highlightProject: p.slug }}
                    className="text-base font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                  >
                    {p.name}
                  </Link>
                  {p.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{p.list_count} list{p.list_count !== 1 ? 's' : ''}</span>
                    <span>Updated {new Date(p.updated_at).toLocaleDateString()}</span>
                    {p.owner_username !== user?.username && (
                      <span className="text-amber-600">by {p.owner_username}</span>
                    )}
                  </div>
                </div>
                {(isOwner || collection.role === 'shared') && (
                  <button
                    onClick={() => handleRemoveProject(p.id)}
                    disabled={removingProjectId === p.id}
                    className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50 px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-300 transition-colors shrink-0"
                  >
                    {removingProjectId === p.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

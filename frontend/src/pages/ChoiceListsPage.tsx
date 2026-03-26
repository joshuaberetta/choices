import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useProjects } from '../hooks/useChoiceLists'
import apiClient, {
  type Project,
  type PublicProject,
  type ProjectShare,
  type Collection,
  type PublicCollection,
  type ChoiceList,
} from '../services/api'

// ── Combined Public Tab ───────────────────────────────────────────────────────

function CombinedPublicTab() {
  const [search, setSearch] = useState('')
  const [projects, setProjects] = useState<PublicProject[]>([])
  const [collections, setCollections] = useState<PublicCollection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doSearch = useCallback(async (q: string) => {
    setLoading(true); setError(null)
    try {
      const [projRes, collRes] = await Promise.all([
        apiClient.getPublicProjects(q || undefined),
        apiClient.getPublicCollections(q || undefined),
      ])
      const pd = projRes.data as unknown as { results: PublicProject[] } | PublicProject[]
      const cd = collRes.data as unknown as { results: PublicCollection[] } | PublicCollection[]
      setProjects(Array.isArray(pd) ? pd : (pd as { results: PublicProject[] }).results)
      setCollections(Array.isArray(cd) ? cd : (cd as { results: PublicCollection[] }).results)
    } catch {
      setError('Failed to load public content.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { doSearch('') }, [doSearch])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); doSearch(search) }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Search by name, owner, or description…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          Search
        </button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      ) : collections.length === 0 && projects.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No public content found.</div>
      ) : (
        <div className="space-y-6">
          {collections.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                📁 Collections
              </p>
              <div className="space-y-2">
                {collections.map(c => (
                  <Link
                    key={c.id}
                    to={`/collections/public/${c.id}`}
                    className="flex overflow-hidden bg-white rounded-xl border border-purple-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all"
                  >
                    <div className="w-1 shrink-0 bg-purple-400" />
                    <div className="flex items-start gap-3 flex-1 p-4">
                      <span className="text-lg shrink-0 mt-0.5 leading-none">📁</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-gray-900">{c.name}</span>
                        <span className="ml-2 text-xs text-gray-400">by {c.owner_username}</span>
                        {c.description && (
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{c.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-gray-400">
                          {c.project_count} project{c.project_count !== 1 ? 's' : ''}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(c.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {projects.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                📄 Projects
              </p>
              <div className="space-y-2">
                {projects.map(p => (
                  <Link
                    key={p.id}
                    to={`/public/projects/${p.id}`}
                    className="flex overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all"
                  >
                    <div className="w-1 shrink-0 bg-gray-200" />
                    <div className="flex items-start gap-3 flex-1 p-4">
                      <span className="text-lg shrink-0 mt-0.5 leading-none">📄</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-gray-900">{p.name}</span>
                        <span className="ml-2 text-xs text-gray-400">by {p.owner_username}</span>
                        {p.description && (
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-gray-400">
                          {p.list_count} list{p.list_count !== 1 ? 's' : ''}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(p.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ── Project Settings Panel (owner only) ──────────────────────────────────────

function ProjectSettingsPanel({
  project, onClose, onProjectUpdated,
}: {
  project: Project
  onClose: () => void
  onProjectUpdated: () => void
}) {
  const [isPublic, setIsPublic] = useState(project.is_public)
  const [togglingPublic, setTogglingPublic] = useState(false)
  const [shares, setShares] = useState<ProjectShare[]>([])
  const [sharesLoading, setSharesLoading] = useState(true)
  const [sharesError, setSharesError] = useState<string | null>(null)
  const [shareUsername, setShareUsername] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [removingShare, setRemovingShare] = useState<string | null>(null)

  useEffect(() => {
    apiClient.getProjectShares(project.slug)
      .then(res => setShares(res.data as unknown as ProjectShare[]))
      .catch(() => setSharesError('Failed to load shares.'))
      .finally(() => setSharesLoading(false))
  }, [project.slug])

  const handleTogglePublic = async () => {
    setTogglingPublic(true)
    try { await apiClient.updateProject(project.slug, { is_public: !isPublic }); setIsPublic(v => !v); onProjectUpdated() }
    finally { setTogglingPublic(false) }
  }

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    const username = shareUsername.trim()
    if (!username) return
    setSharing(true); setShareError(null)
    try {
      const res = await apiClient.shareProject(project.slug, username)
      const data = res.data as { username: string }
      setShares(prev => [...prev, { username: data.username, created_at: new Date().toISOString() }])
      setShareUsername('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setShareError(msg || 'Failed to share project.')
    } finally {
      setSharing(false)
    }
  }

  const handleRemoveShare = async (username: string) => {
    setRemovingShare(username)
    try { await apiClient.removeProjectShare(project.slug, username); setShares(prev => prev.filter(s => s.username !== username)) }
    finally { setRemovingShare(null) }
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Project Settings</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕ Close</button>
      </div>
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleTogglePublic} disabled={togglingPublic}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${isPublic ? 'bg-indigo-600' : 'bg-gray-300'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-sm font-medium text-gray-700">Make this project public</span>
        </div>
        <p className="mt-1 text-xs text-gray-400 ml-12">Public projects are discoverable by anyone. CSV links are always public regardless of this setting.</p>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Sharing</p>
        {sharesLoading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : sharesError ? (
          <p className="text-xs text-red-500">{sharesError}</p>
        ) : (
          <>
            {shares.length === 0 ? (
              <p className="text-xs text-gray-400 mb-2">No one else has access to this project.</p>
            ) : (
              <table className="w-full text-sm mb-3">
                <tbody>
                  {shares.map(s => (
                    <tr key={s.username} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 text-gray-700 font-mono text-xs">{s.username}</td>
                      <td className="py-1.5 text-gray-400 text-xs">Added {new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="py-1.5 text-right">
                        <button onClick={() => handleRemoveShare(s.username)} disabled={removingShare === s.username} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                          {removingShare === s.username ? 'Removing…' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <form onSubmit={handleShare} className="flex gap-2">
              <input type="text" placeholder="Username to share with…" value={shareUsername} onChange={e => setShareUsername(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" disabled={sharing || !shareUsername.trim()} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {sharing ? 'Sharing…' : 'Share'}
              </button>
            </form>
            {shareError && <p className="mt-1 text-xs text-red-600">{shareError}</p>}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChoiceListsPage() {
  const { projects, loading, error, refetch: refetchProjects } = useProjects()

  const [activeTab, setActiveTab] = useState<'my' | 'public'>('my')
  const [settingsProjectSlug, setSettingsProjectSlug] = useState<string | null>(null)

  // Group choice lists by project
  const grouped = useMemo(() => {
    const map = new Map<number, {
      id: number
      project_name: string
      project_slug: string
      description: string
      is_public: boolean
      role: 'owner' | 'shared'
      owner_username: string | null
      collection_memberships: { id: number; name: string; slug: string }[]
      lists: ChoiceList[]
    }>()
    for (const p of projects) {
      map.set(p.id, {
        id: p.id,
        project_name: p.name,
        project_slug: p.slug,
        description: p.description,
        is_public: p.is_public,
        role: p.role ?? 'owner',
        owner_username: p.owner_username ?? null,
        collection_memberships: p.collection_memberships ?? [],
        lists: p.choice_lists ?? [],
      })
    }
    return Array.from(map.values()).sort((a, b) => a.project_name.localeCompare(b.project_name))
  }, [projects])

  // Project accordion collapse state (all expanded by default)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const toggleProject = (id: number) =>
    setCollapsed(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  // ── Collections state ────────────────────────────────────────────────────

  const [collections, setCollections] = useState<Collection[]>([])
  const [collapsedCollections, setCollapsedCollections] = useState<Set<number>>(new Set())
  const [confirmDeleteCollectionId, setConfirmDeleteCollectionId] = useState<number | null>(null)
  const [deletingCollectionId, setDeletingCollectionId] = useState<number | null>(null)
  const [moveMenuProjectId, setMoveMenuProjectId] = useState<number | null>(null)
  const [movingProject, setMovingProject] = useState(false)
  const [showCollectionForm, setShowCollectionForm] = useState(false)
  const [collectionForm, setCollectionForm] = useState({ name: '', slug: '', description: '' })
  const [collectionSubmitting, setCollectionSubmitting] = useState(false)
  const [collectionFormError, setCollectionFormError] = useState<string | null>(null)
  const [collectionSearches, setCollectionSearches] = useState<Map<number, string>>(new Map())
  const [collectionPages, setCollectionPages] = useState<Map<number, number>>(new Map())
  const COLL_PAGE_SIZE = 10

  const fetchCollections = useCallback(async () => {
    try {
      const res = await apiClient.getCollections()
      const data = res.data as unknown as { results?: Collection[] } | Collection[]
      setCollections(Array.isArray(data) ? data : (data as { results: Collection[] }).results ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchCollections() }, [fetchCollections])

  // Derived: which projects belong to at least one collection
  const collectedProjectIds = useMemo(() => {
    const ids = new Set<number>()
    for (const c of collections) for (const p of (c.projects ?? [])) ids.add(p.id)
    return ids
  }, [collections])

  const uncollectedProjects = useMemo(
    () => grouped.filter(g => !collectedProjectIds.has(g.id)),
    [grouped, collectedProjectIds]
  )

  // Collections with their full grouped project objects
  const collectionsWithGroupedProjects = useMemo(() =>
    collections.map(c => ({
      collection: c,
      projects: (c.projects ?? [])
        .map(cp => grouped.find(g => g.id === cp.id))
        .filter((g): g is NonNullable<typeof g> => g !== undefined),
    })),
    [collections, grouped]
  )

  const toggleCollection = (id: number) =>
    setCollapsedCollections(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    setCollectionSubmitting(true); setCollectionFormError(null)
    try {
      await apiClient.createCollection({
        name: collectionForm.name,
        slug: collectionForm.slug || collectionForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: collectionForm.description,
      })
      setShowCollectionForm(false)
      setCollectionForm({ name: '', slug: '', description: '' })
      fetchCollections()
    } catch {
      setCollectionFormError('Failed to create. The slug must be globally unique and URL-safe.')
    } finally {
      setCollectionSubmitting(false)
    }
  }

  const handleDeleteCollection = async (id: number) => {
    setDeletingCollectionId(id)
    try {
      await apiClient.deleteCollection(id)
      setConfirmDeleteCollectionId(null)
      fetchCollections()
      refetchProjects()
    } catch { /* ignore */ } finally {
      setDeletingCollectionId(null)
    }
  }

  const handleMoveProject = async (projectId: number, targetCollectionId: number, add: boolean, currentCollectionId?: number) => {
    setMovingProject(true)
    try {
      if (add) {
        // If already in a different collection, remove from it first (atomic move)
        if (currentCollectionId != null && currentCollectionId !== targetCollectionId) {
          await apiClient.removeProjectFromCollection(currentCollectionId, projectId)
        }
        await apiClient.addProjectToCollection(targetCollectionId, projectId)
      } else {
        await apiClient.removeProjectFromCollection(targetCollectionId, projectId)
      }
      setMoveMenuProjectId(null)
      await Promise.all([fetchCollections(), refetchProjects()])
    } catch { /* ignore */ } finally {
      setMovingProject(false)
    }
  }

  // ── List inline editing ──────────────────────────────────────────────────

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', slug: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const startEdit = (list: { id: number; name: string; slug: string }) => {
    setEditingId(list.id); setEditForm({ name: list.name, slug: list.slug }); setEditError(null)
  }
  const cancelEdit = () => { setEditingId(null); setEditError(null) }
  const saveEdit = async (id: number) => {
    setEditSaving(true); setEditError(null)
    try {
      await apiClient.updateChoiceList(id, { name: editForm.name, slug: editForm.slug })
      setEditingId(null); refetchProjects()
    } catch {
      setEditError('Failed to save. Check that the slug is unique and valid.')
    } finally { setEditSaving(false) }
  }

  // ── New project form ─────────────────────────────────────────────────────

  const [showProjectForm, setShowProjectForm] = useState(false)
  const [projectForm, setProjectForm] = useState({ name: '', slug: '', description: '' })
  const [projectSubmitting, setProjectSubmitting] = useState(false)
  const [projectFormError, setProjectFormError] = useState<string | null>(null)

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setProjectSubmitting(true); setProjectFormError(null)
    try {
      await apiClient.createProject({
        name: projectForm.name,
        slug: projectForm.slug || projectForm.name.toLowerCase().replace(/\s+/g, '-'),
        description: projectForm.description,
      })
      setShowProjectForm(false)
      setProjectForm({ name: '', slug: '', description: '' })
      refetchProjects()
    } catch {
      setProjectFormError('Failed to create project. Check that the slug is unique and valid.')
    } finally { setProjectSubmitting(false) }
  }

  // ── Inline project editing ───────────────────────────────────────────────

  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [editProjectForm, setEditProjectForm] = useState({ name: '', description: '' })
  const [editProjectSaving, setEditProjectSaving] = useState(false)
  const [editProjectError, setEditProjectError] = useState<string | null>(null)

  const startEditProject = (p: { id: number; project_name: string; description?: string }) => {
    setEditingProjectId(p.id)
    setEditProjectForm({ name: p.project_name, description: p.description ?? '' })
    setEditProjectError(null)
  }
  const cancelEditProject = () => { setEditingProjectId(null); setEditProjectError(null) }
  const saveEditProject = async (id: number) => {
    setEditProjectSaving(true); setEditProjectError(null)
    try {
      await apiClient.updateProject(id, { name: editProjectForm.name, description: editProjectForm.description })
      setEditingProjectId(null); refetchProjects()
    } catch {
      setEditProjectError('Failed to save. Please try again.')
    } finally { setEditProjectSaving(false) }
  }

  // ── Delete project ───────────────────────────────────────────────────────

  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<number | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null)
  const handleDeleteProject = async (id: number, slug: string) => {
    setDeletingProjectId(id)
    try {
      await apiClient.deleteProject(slug)
      setConfirmDeleteProjectId(null)
      refetchProjects()
    } catch { /* keep confirm open */ } finally { setDeletingProjectId(null) }
  }

  // ── Delete choice list ───────────────────────────────────────────────────

  const [confirmDeleteListId, setConfirmDeleteListId] = useState<number | null>(null)
  const [deletingListId, setDeletingListId] = useState<number | null>(null)
  const handleDeleteList = async (id: number) => {
    setDeletingListId(id)
    try {
      await apiClient.deleteChoiceList(id)
      setConfirmDeleteListId(null); refetchProjects()
    } catch { /* keep confirm open */ } finally { setDeletingListId(null) }
  }

  // ── Per-project new list form ────────────────────────────────────────────

  const [newListForProject, setNewListForProject] = useState<number | null>(null)
  const [listForm, setListForm] = useState({ name: '', slug: '', description: '' })
  const [listSubmitting, setListSubmitting] = useState(false)
  const [listFormError, setListFormError] = useState<string | null>(null)

  const openNewList = (projectId: number) => {
    setNewListForProject(projectId); setListForm({ name: '', slug: '', description: '' }); setListFormError(null)
  }
  const closeNewList = () => { setNewListForProject(null); setListFormError(null) }

  const handleCreateList = async (e: React.FormEvent, projectId: number) => {
    e.preventDefault()
    setListSubmitting(true); setListFormError(null)
    try {
      await apiClient.createChoiceList({
        project: projectId,
        name: listForm.name,
        slug: listForm.slug || listForm.name.toLowerCase().replace(/\s+/g, '-'),
        description: listForm.description,
      })
      closeNewList(); refetchProjects()
    } catch {
      setListFormError('Failed to create choice list. Check that the slug is unique and valid.')
    } finally { setListSubmitting(false) }
  }

  // ── Project group renderer ───────────────────────────────────────────────

  function renderProjectGroup(group: typeof grouped[0]) {
    const isOpen = !collapsed.has(group.id)
    const isAddingList = newListForProject === group.id
    const isEditingProject = editingProjectId === group.id
    const isOwner = group.role === 'owner'
    const isSettingsOpen = settingsProjectSlug === group.project_slug
    const projectObj: Project = {
      id: group.id,
      name: group.project_name,
      slug: group.project_slug,
      description: group.description,
      owner: null,
      owner_username: group.owner_username,
      is_public: group.is_public,
      role: group.role,
      created_at: '',
      updated_at: '',
    }

    return (
      <div key={group.project_slug} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden group/project">
        <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <button onClick={() => toggleProject(group.id)} className="flex items-center gap-3 flex-1 text-left flex-wrap">
            <span className="font-semibold text-gray-900">{group.project_name}</span>
            <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
              {group.project_slug}
            </span>
            {!isOwner && group.owner_username && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                Shared by {group.owner_username}
              </span>
            )}
            {group.is_public && (
              <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">Public</span>
            )}
            <span className="text-xs text-gray-400">{group.lists.length} list{group.lists.length !== 1 ? 's' : ''}</span>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            {/* Move to collection button + dropdown */}
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); setMoveMenuProjectId(m => m === group.id ? null : group.id) }}
                className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors opacity-0 group-hover/project:opacity-100 ${
                  group.collection_memberships.length > 0
                    ? 'border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                📁 {group.collection_memberships[0]?.name ?? 'Move'}
              </button>

              {moveMenuProjectId === group.id && (
                <div className="absolute right-0 top-full mt-1 z-20 min-w-[220px] bg-white rounded-lg border border-gray-200 shadow-lg py-1.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-1 pb-1.5 border-b border-gray-100">
                    Collection membership
                  </p>
                  {collections.length === 0 ? (
                    <p className="px-3 py-2.5 text-xs text-gray-400">No collections yet. Create one first.</p>
                  ) : (
                    collections.map(c => {
                      const inThis = c.projects?.some(p => p.id === group.id) ?? false
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleMoveProject(group.id, c.id, !inThis, group.collection_memberships[0]?.id)}
                          disabled={movingProject}
                          className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          <span className={`flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] font-bold ${
                            inThis ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 text-transparent'
                          }`}>✓</span>
                          <span className="truncate flex-1">{c.name}</span>
                          {c.role === 'shared' && (
                            <span className="text-[10px] text-gray-400 shrink-0">shared</span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {isOwner && confirmDeleteProjectId === group.id ? (
              <>
                <span className="text-xs text-gray-500">
                  Delete project{group.lists.length > 0 ? ` and ${group.lists.length} list${group.lists.length !== 1 ? 's' : ''}` : ''}?
                </span>
                <button
                  onClick={() => handleDeleteProject(group.id, group.project_slug)}
                  disabled={deletingProjectId === group.id}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deletingProjectId === group.id ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setConfirmDeleteProjectId(null)}
                  className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => isEditingProject ? cancelEditProject() : startEditProject(group)}
                  className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors opacity-0 group-hover/project:opacity-100"
                >
                  {isEditingProject ? 'Cancel edit' : 'Edit'}
                </button>
                {isOwner && (
                  <>
                    <button
                      onClick={() => setSettingsProjectSlug(s => s === group.project_slug ? null : group.project_slug)}
                      className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors opacity-0 group-hover/project:opacity-100 ${isSettingsOpen ? 'border-indigo-300 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                    >
                      {isSettingsOpen ? 'Close settings' : 'Settings'}
                    </button>
                    <button
                      onClick={() => { cancelEditProject(); setConfirmDeleteProjectId(group.id) }}
                      className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors opacity-0 group-hover/project:opacity-100"
                    >
                      Delete
                    </button>
                  </>
                )}
                <button
                  onClick={() => isAddingList ? closeNewList() : openNewList(group.id)}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
                >
                  {isAddingList ? 'Cancel' : '+ New List'}
                </button>
              </>
            )}

            <svg
              onClick={() => toggleProject(group.id)}
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 cursor-pointer ${isOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Inline project edit form */}
        {isEditingProject && (
          <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60">
            {editProjectError && <p className="text-red-600 text-xs mb-3 bg-red-50 px-3 py-2 rounded">{editProjectError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  autoFocus required type="text"
                  value={editProjectForm.name}
                  onChange={e => setEditProjectForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input
                  type="text" placeholder="Optional"
                  value={editProjectForm.description}
                  onChange={e => setEditProjectForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => saveEditProject(group.id)}
                disabled={editProjectSaving}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {editProjectSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Owner settings panel */}
        {isOwner && isSettingsOpen && (
          <ProjectSettingsPanel
            project={projectObj}
            onClose={() => setSettingsProjectSlug(null)}
            onProjectUpdated={refetchProjects}
          />
        )}

        {/* Accordion body */}
        {isOpen && (
          <div className="border-t border-gray-100">
            {isAddingList && (
              <form
                onSubmit={e => handleCreateList(e, group.id)}
                className="px-5 py-4 bg-indigo-50/40 border-b border-indigo-100"
              >
                <h3 className="text-sm font-semibold text-gray-700 mb-3">New list in {group.project_name}</h3>
                {listFormError && <p className="text-red-600 text-xs mb-3 bg-red-50 px-3 py-2 rounded">{listFormError}</p>}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                    <input required autoFocus type="text" placeholder="e.g. Fruits"
                      value={listForm.name} onChange={e => setListForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">ID <span className="text-gray-400 font-normal">(auto)</span></label>
                    <input type="text" placeholder="e.g. fruits"
                      value={listForm.slug} onChange={e => setListForm(f => ({ ...f, slug: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <input type="text" placeholder="Optional"
                      value={listForm.description} onChange={e => setListForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button type="submit" disabled={listSubmitting}
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {listSubmitting ? 'Creating…' : 'Create List'}
                  </button>
                </div>
              </form>
            )}
            {group.lists.length === 0 && !isAddingList ? (
              <div className="px-5 py-6 text-center text-gray-400 text-sm">
                No lists yet — click <span className="font-medium text-indigo-600">+ New List</span> to add one.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Name</th>
                    <th className="px-5 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">ID</th>
                    <th className="px-5 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Choices</th>
                    <th className="px-5 py-2.5 text-right font-semibold text-gray-500 text-xs uppercase tracking-wide"></th>
                  </tr>
                </thead>
                <tbody>
                  {group.lists.map(list => (
                    editingId === list.id ? (
                      <tr key={list.id} className="border-b border-gray-50 last:border-b-0 bg-indigo-50/40">
                        <td className="px-4 py-2">
                          <input autoFocus type="text" value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full border border-indigo-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          {editError && <p className="text-red-600 text-xs mt-1">{editError}</p>}
                        </td>
                        <td className="px-4 py-2">
                          <input type="text" value={editForm.slug}
                            onChange={e => setEditForm(f => ({ ...f, slug: e.target.value }))}
                            className="w-full border border-indigo-300 rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </td>
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <button onClick={() => saveEdit(list.id)} disabled={editSaving}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors mr-2">
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={cancelEdit}
                            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={list.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors group/row">
                        <td className="px-5 py-3 font-medium text-gray-900">{list.name}</td>
                        <td className="px-5 py-3 font-mono text-gray-500 text-xs">{list.slug}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{list.choices_count}</td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          {confirmDeleteListId === list.id ? (
                            <>
                              <span className="text-xs text-gray-500 mr-2">Delete list?</span>
                              <button onClick={() => handleDeleteList(list.id)} disabled={deletingListId === list.id}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors mr-2">
                                {deletingListId === list.id ? 'Deleting…' : 'Yes, delete'}
                              </button>
                              <button onClick={() => setConfirmDeleteListId(null)}
                                className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(list)}
                                className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors mr-2 opacity-0 group-hover/row:opacity-100">
                                Edit
                              </button>
                              <button onClick={() => { cancelEdit(); setConfirmDeleteListId(list.id) }}
                                className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors mr-2 opacity-0 group-hover/row:opacity-100">
                                Delete
                              </button>
                              <Link to={`/${list.project_slug}/${list.slug}`}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors">
                                View →
                              </Link>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const isEmpty = grouped.length === 0 && collections.length === 0

  return (
    <div>
      {/* Overlay to close move-to-collection dropdown on outside click */}
      {moveMenuProjectId !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setMoveMenuProjectId(null)} />
      )}

      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        {activeTab === 'my' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowCollectionForm(v => !v); setCollectionFormError(null) }}
              className="px-4 py-2 border border-purple-300 text-purple-700 bg-purple-50 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
            >
              {showCollectionForm ? 'Cancel' : '📁 New Collection'}
            </button>
            <button
              onClick={() => { setShowProjectForm(v => !v); setProjectFormError(null) }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {showProjectForm ? 'Cancel' : '+ New Project'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['my', 'public'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab ? 'text-indigo-700 border-b-2 border-indigo-600 -mb-px bg-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'my' ? 'My Projects' : 'Public'}
          </button>
        ))}
      </div>

      {activeTab === 'public' && <CombinedPublicTab />}

      {activeTab === 'my' && (
        <>
          {/* New collection form */}
          {showCollectionForm && (
            <form onSubmit={handleCreateCollection} className="mb-4 bg-purple-50 rounded-xl border border-purple-200 p-5 shadow-sm">
              <h2 className="font-semibold text-purple-900 mb-4">📁 Create Collection</h2>
              {collectionFormError && (
                <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded">{collectionFormError}</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input required autoFocus type="text" placeholder="e.g. Admin Boundaries"
                    value={collectionForm.name}
                    onChange={e => setCollectionForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID <span className="text-gray-400 font-normal">(globally unique; auto-generated if empty)</span>
                  </label>
                  <input type="text" placeholder="e.g. admin-boundaries"
                    value={collectionForm.slug}
                    onChange={e => setCollectionForm(f => ({ ...f, slug: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" placeholder="Optional"
                    value={collectionForm.description}
                    onChange={e => setCollectionForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" disabled={collectionSubmitting}
                  className="px-4 py-2 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-800 disabled:opacity-50 transition-colors">
                  {collectionSubmitting ? 'Creating…' : 'Create Collection'}
                </button>
              </div>
            </form>
          )}

          {/* New project form */}
          {showProjectForm && (
            <form onSubmit={handleCreateProject} className="mb-4 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">Create Project</h2>
              {projectFormError && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded">{projectFormError}</p>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input required autoFocus type="text" placeholder="e.g. My Project"
                    value={projectForm.name}
                    onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID <span className="text-gray-400 font-normal">(auto-generated if empty)</span>
                  </label>
                  <input type="text" placeholder="e.g. my-project"
                    value={projectForm.slug}
                    onChange={e => setProjectForm(f => ({ ...f, slug: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" placeholder="Optional"
                    value={projectForm.description}
                    onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" disabled={projectSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {projectSubmitting ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
          ) : isEmpty ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg">No projects yet</p>
              <p className="text-sm mt-1">Create a project or collection using the buttons above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* ── Collection folders with nested project accordions ── */}
              {collectionsWithGroupedProjects.map(({ collection, projects: collProjects }) => {
                const isCollOpen = !collapsedCollections.has(collection.id)
                return (
                  <div key={collection.id} className="group/collection rounded-xl overflow-hidden border-2 border-purple-100 bg-white shadow-sm">
                    {/* Folder header */}
                    <div className="flex items-center justify-between px-5 py-3.5 bg-purple-50/70 hover:bg-purple-50 transition-colors">
                      <button
                        onClick={() => toggleCollection(collection.id)}
                        className="flex items-center gap-3 flex-1 text-left flex-wrap"
                      >
                        <span className="text-base leading-none">{isCollOpen ? '📂' : '📁'}</span>
                        <span className="font-semibold text-gray-900">{collection.name}</span>
                        {collection.description && (
                          <span className="text-xs text-gray-400 truncate max-w-xs hidden sm:block">
                            {collection.description}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {collection.project_count} project{collection.project_count !== 1 ? 's' : ''}
                        </span>
                        {collection.is_public && (
                          <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">Public</span>
                        )}
                        {collection.role === 'shared' && (
                          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                            Shared by {collection.owner_username}
                          </span>
                        )}
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        {collection.role === 'owner' && confirmDeleteCollectionId === collection.id ? (
                          <>
                            <span className="text-xs text-gray-500">Delete collection?</span>
                            <button
                              onClick={() => handleDeleteCollection(collection.id)}
                              disabled={deletingCollectionId === collection.id}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {deletingCollectionId === collection.id ? 'Deleting…' : 'Yes, delete'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteCollectionId(null)}
                              className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <Link
                              to={`/collections/${collection.id}`}
                              onClick={e => e.stopPropagation()}
                              className="px-3 py-1.5 border border-purple-200 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 transition-colors opacity-0 group-hover/collection:opacity-100"
                            >
                              Manage →
                            </Link>
                            {collection.role === 'owner' && (
                              <button
                                onClick={() => setConfirmDeleteCollectionId(collection.id)}
                                className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors opacity-0 group-hover/collection:opacity-100"
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                        <svg
                          onClick={() => toggleCollection(collection.id)}
                          className={`w-4 h-4 text-gray-400 transition-transform duration-200 cursor-pointer ${isCollOpen ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Nested project accordions */}
                    {isCollOpen && (
                      collProjects.length === 0 ? (
                        <div className="px-6 py-5 text-sm text-gray-400 text-center border-t border-purple-100">
                          No projects in this collection yet. Hover over any project and click{' '}
                          <span className="font-medium text-purple-700">📁 Move</span> to add one.
                        </div>
                      ) : (() => {
                        const q = (collectionSearches.get(collection.id) ?? '').toLowerCase()
                        const filtered = q
                          ? collProjects.filter(g =>
                              g.project_name.toLowerCase().includes(q) ||
                              (g.description ?? '').toLowerCase().includes(q)
                            )
                          : collProjects
                        const numPages = Math.ceil(filtered.length / COLL_PAGE_SIZE)
                        const pg = Math.min(collectionPages.get(collection.id) ?? 1, Math.max(numPages, 1))
                        const pageItems = filtered.slice((pg - 1) * COLL_PAGE_SIZE, pg * COLL_PAGE_SIZE)
                        return (
                          <div className="border-t border-purple-100 bg-purple-50/20">
                            {/* Search bar — only show when there are enough projects */}
                            {collProjects.length > COLL_PAGE_SIZE && (
                              <div className="px-3 pt-3">
                                <input
                                  type="text"
                                  placeholder="Search projects…"
                                  value={collectionSearches.get(collection.id) ?? ''}
                                  onChange={e => {
                                    const val = e.target.value
                                    setCollectionSearches(m => new Map(m).set(collection.id, val))
                                    setCollectionPages(m => new Map(m).set(collection.id, 1))
                                  }}
                                  className="w-full border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                                />
                              </div>
                            )}
                            {/* Pagination header */}
                            {numPages > 1 && (
                              <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400">
                                <span>
                                  {filtered.length} project{filtered.length !== 1 ? 's' : ''}
                                  {q ? ` matching "${collectionSearches.get(collection.id)}"` : ''}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setCollectionPages(m => new Map(m).set(collection.id, Math.max(pg - 1, 1)))}
                                    disabled={pg <= 1}
                                    className="px-2 py-0.5 border border-purple-200 rounded text-purple-600 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    ← Prev
                                  </button>
                                  {Array.from({ length: numPages }, (_, i) => i + 1).map(p => (
                                    <button
                                      key={p}
                                      onClick={() => setCollectionPages(m => new Map(m).set(collection.id, p))}
                                      className={`px-2 py-0.5 border rounded transition-colors ${
                                        p === pg
                                          ? 'bg-purple-600 text-white border-purple-600'
                                          : 'border-purple-200 text-purple-600 hover:bg-purple-50'
                                      }`}
                                    >
                                      {p}
                                    </button>
                                  ))}
                                  <button
                                    onClick={() => setCollectionPages(m => new Map(m).set(collection.id, Math.min(pg + 1, numPages)))}
                                    disabled={pg >= numPages}
                                    className="px-2 py-0.5 border border-purple-200 rounded text-purple-600 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    Next →
                                  </button>
                                </div>
                              </div>
                            )}
                            <div className="p-3 space-y-2">
                              {pageItems.length === 0 ? (
                                <p className="text-xs text-center text-gray-400 py-3">
                                  No projects match &ldquo;{collectionSearches.get(collection.id)}&rdquo;
                                </p>
                              ) : (
                                pageItems.map(g => renderProjectGroup(g))
                              )}
                            </div>
                          </div>
                        )
                      })()
                    )}
                  </div>
                )
              })}

              {/* Divider when both collections and uncollected projects exist */}
              {collectionsWithGroupedProjects.length > 0 && uncollectedProjects.length > 0 && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 pt-2 pb-1">
                  Uncollected projects
                </p>
              )}

              {/* ── Standalone (uncollected) projects ── */}
              {uncollectedProjects.map(group => renderProjectGroup(group))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

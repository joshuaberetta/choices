import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useChoiceLists, useProjects } from '../hooks/useChoiceLists'
import apiClient, { type Project, type PublicProject, type ProjectShare } from '../services/api'

// ──────────────────────────────────────────────────────────────────────────────
// Public Projects Tab
// ──────────────────────────────────────────────────────────────────────────────

function PublicProjectsTab() {
  const [search, setSearch] = useState('')
  const [projects, setProjects] = useState<PublicProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doSearch = useCallback(async (q: string) => {
    setLoading(true); setError(null)
    try {
      const res = await apiClient.getPublicProjects(q || undefined)
      const data = res.data as unknown as { results: PublicProject[] } | PublicProject[]
      setProjects(Array.isArray(data) ? data : (data as { results: PublicProject[] }).results)
    } catch {
      setError('Failed to load public projects.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { doSearch('') }, [doSearch])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); doSearch(search) }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-5">
        <input
          type="text"
          placeholder="Search by project name or owner…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Search</button>
      </form>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No public projects found.</div>
      ) : (
        <div className="space-y-3">
          {projects.map(p => (
            <Link key={p.id} to={`/public/projects/${p.id}`} className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-semibold text-gray-900">{p.name}</span>
                  <span className="ml-2 text-xs text-gray-400">by {p.owner_username}</span>
                  {p.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-gray-400">{p.list_count} list{p.list_count !== 1 ? 's' : ''}</span>
                  <p className="text-xs text-gray-400 mt-0.5">Updated {new Date(p.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Project Settings Panel (owner only)
// ──────────────────────────────────────────────────────────────────────────────

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
      {/* is_public toggle */}
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
      {/* Share management */}
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



export default function ChoiceListsPage() {
  const { choiceLists, loading, error, refetch } = useChoiceLists()
  const { projects, refetch: refetchProjects } = useProjects()

  // Tab state
  const [activeTab, setActiveTab] = useState<'my' | 'public'>('my')

  // Track which project has settings panel open
  const [settingsProjectSlug, setSettingsProjectSlug] = useState<string | null>(null)

  // Group choice lists by project, merging in all known projects (even empty ones)
  const grouped = useMemo(() => {
    const map = new Map<number, {
      id: number
      project_name: string
      project_slug: string
      description: string
      is_public: boolean
      role: 'owner' | 'shared'
      owner_username: string | null
      lists: typeof choiceLists
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
        lists: [],
      })
    }
    for (const list of choiceLists) {
      if (!map.has(list.project)) {
        map.set(list.project, {
          id: list.project,
          project_name: list.project_name,
          project_slug: list.project_slug,
          description: '',
          is_public: false,
          role: 'owner',
          owner_username: null,
          lists: [],
        })
      }
      map.get(list.project)!.lists.push(list)
    }
    return Array.from(map.values()).sort((a, b) => a.project_name.localeCompare(b.project_name))
  }, [choiceLists, projects])

  // All projects expanded by default
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const toggleProject = (projectId: number) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(projectId) ? next.delete(projectId) : next.add(projectId)
      return next
    })

  // Inline list editing
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', slug: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const startEdit = (list: { id: number; name: string; slug: string }) => {
    setEditingId(list.id)
    setEditForm({ name: list.name, slug: list.slug })
    setEditError(null)
  }
  const cancelEdit = () => { setEditingId(null); setEditError(null) }
  const saveEdit = async (id: number) => {
    setEditSaving(true)
    setEditError(null)
    try {
      await apiClient.updateChoiceList(id, { name: editForm.name, slug: editForm.slug })
      setEditingId(null)
      refetch()
    } catch {
      setEditError('Failed to save. Check that the slug is unique and valid.')
    } finally {
      setEditSaving(false)
    }
  }

  // New project form
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [projectForm, setProjectForm] = useState({ name: '', slug: '', description: '' })
  const [projectSubmitting, setProjectSubmitting] = useState(false)
  const [projectFormError, setProjectFormError] = useState<string | null>(null)

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setProjectSubmitting(true)
    setProjectFormError(null)
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
    } finally {
      setProjectSubmitting(false)
    }
  }

  // Inline project editing
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
    setEditProjectSaving(true)
    setEditProjectError(null)
    try {
      await apiClient.updateProject(id, { name: editProjectForm.name, description: editProjectForm.description })
      setEditingProjectId(null)
      refetchProjects()
    } catch {
      setEditProjectError('Failed to save. Please try again.')
    } finally {
      setEditProjectSaving(false)
    }
  }

  // Delete project
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<number | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null)
  const handleDeleteProject = async (id: number, slug: string) => {
    setDeletingProjectId(id)
    try {
      await apiClient.deleteProject(slug)
      setConfirmDeleteProjectId(null)
      refetchProjects()
      refetch()
    } catch {
      // keep confirm state open so user can retry or cancel
    } finally {
      setDeletingProjectId(null)
    }
  }

  // Delete choice list
  const [confirmDeleteListId, setConfirmDeleteListId] = useState<number | null>(null)
  const [deletingListId, setDeletingListId] = useState<number | null>(null)
  const handleDeleteList = async (id: number) => {
    setDeletingListId(id)
    try {
      await apiClient.deleteChoiceList(id)
      setConfirmDeleteListId(null)
      refetch()
    } catch {
      // keep confirm state open so user can retry or cancel
    } finally {
      setDeletingListId(null)
    }
  }

  // Per-project new list form
  const [newListForProject, setNewListForProject] = useState<number | null>(null)
  const [listForm, setListForm] = useState({ name: '', slug: '', description: '' })
  const [listSubmitting, setListSubmitting] = useState(false)
  const [listFormError, setListFormError] = useState<string | null>(null)

  const openNewList = (projectId: number) => {
    setNewListForProject(projectId)
    setListForm({ name: '', slug: '', description: '' })
    setListFormError(null)
  }
  const closeNewList = () => { setNewListForProject(null); setListFormError(null) }

  const handleCreateList = async (e: React.FormEvent, projectId: number) => {
    e.preventDefault()
    setListSubmitting(true)
    setListFormError(null)
    try {
      await apiClient.createChoiceList({
        project: projectId,
        name: listForm.name,
        slug: listForm.slug || listForm.name.toLowerCase().replace(/\s+/g, '-'),
        description: listForm.description,
      })
      closeNewList()
      refetch()
    } catch {
      setListFormError('Failed to create choice list. Check that the slug is unique and valid.')
    } finally {
      setListSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        {activeTab === 'my' && (
          <button
            onClick={() => { setShowProjectForm(v => !v); setProjectFormError(null) }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {showProjectForm ? 'Cancel' : '+ New Project'}
          </button>
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
            {tab === 'my' ? 'My Projects' : 'Public Projects'}
          </button>
        ))}
      </div>

      {activeTab === 'public' && <PublicProjectsTab />}

      {activeTab === 'my' && (
        <>
      {showProjectForm && (
        <form onSubmit={handleCreateProject} className="mb-6 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Create Project</h2>
          {projectFormError && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded">{projectFormError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                required
                autoFocus
                type="text"
                placeholder="e.g. My Project"
                value={projectForm.name}
                onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID <span className="text-gray-400 font-normal">(auto-generated if empty)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. my-project"
                value={projectForm.slug}
                onChange={e => setProjectForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                placeholder="Optional"
                value={projectForm.description}
                onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={projectSubmitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {projectSubmitting ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No projects yet</p>
          <p className="text-sm mt-1">Create a project using the button above to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(group => {
            const isOpen = !collapsed.has(group.id)
            const isAddingList = newListForProject === group.id
            const isEditingProject = editingProjectId === group.id
            const isOwner = group.role === 'owner'
            const isSettingsOpen = settingsProjectSlug === group.project_slug
            // Build a Project-shaped object for the settings panel
            const projectObj: Project = {
              id: group.id,
              name: group.project_name,
              slug: group.project_slug,
              description: group.description,
              is_public: group.is_public,
              role: group.role,
              owner_username: group.owner_username,
              updated_at: '',
            }
            return (
              <div key={group.project_slug} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden group/project">
                {/* Accordion header */}
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <button
                    onClick={() => toggleProject(group.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
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
                  <div className="flex items-center gap-2">
                    {isOwner && confirmDeleteProjectId === group.id ? (
                      <>
                        <span className="text-xs text-gray-500">Delete project{group.lists.length > 0 ? ` and ${group.lists.length} list${group.lists.length !== 1 ? 's' : ''}` : ''}?</span>
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
                          autoFocus
                          required
                          type="text"
                          value={editProjectForm.name}
                          onChange={e => setEditProjectForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                        <input
                          type="text"
                          placeholder="Optional"
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
                            <input
                              required
                              autoFocus
                              type="text"
                              placeholder="e.g. Fruits"
                              value={listForm.name}
                              onChange={e => setListForm(f => ({ ...f, name: e.target.value }))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              ID <span className="text-gray-400 font-normal">(auto)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. fruits"
                              value={listForm.slug}
                              onChange={e => setListForm(f => ({ ...f, slug: e.target.value }))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <input
                              type="text"
                              placeholder="Optional"
                              value={listForm.description}
                              onChange={e => setListForm(f => ({ ...f, description: e.target.value }))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button
                            type="submit"
                            disabled={listSubmitting}
                            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
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
                                  <input
                                    autoFocus
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full border border-indigo-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                  {editError && <p className="text-red-600 text-xs mt-1">{editError}</p>}
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={editForm.slug}
                                    onChange={e => setEditForm(f => ({ ...f, slug: e.target.value }))}
                                    className="w-full border border-indigo-300 rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="px-4 py-2"></td>
                                <td className="px-4 py-2 text-right whitespace-nowrap">
                                  <button
                                    onClick={() => saveEdit(list.id)}
                                    disabled={editSaving}
                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors mr-2"
                                  >
                                    {editSaving ? 'Saving…' : 'Save'}
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                                  >
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
                                      <button
                                        onClick={() => handleDeleteList(list.id)}
                                        disabled={deletingListId === list.id}
                                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors mr-2"
                                      >
                                        {deletingListId === list.id ? 'Deleting…' : 'Yes, delete'}
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteListId(null)}
                                        className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => startEdit(list)}
                                        className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors mr-2 opacity-0 group-hover/row:opacity-100"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => { cancelEdit(); setConfirmDeleteListId(list.id) }}
                                        className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors mr-2 opacity-0 group-hover/row:opacity-100"
                                      >
                                        Delete
                                      </button>
                                      <Link
                                        to={`/${list.project_slug}/${list.slug}`}
                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
                                      >
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
          })}
        </div>
      )}
        </>
      )}
    </div>
  )
}

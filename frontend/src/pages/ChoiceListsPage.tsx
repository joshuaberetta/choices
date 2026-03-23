import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useChoiceLists, useProjects } from '../hooks/useChoiceLists'
import apiClient from '../services/api'

export default function ChoiceListsPage() {
  const { choiceLists, loading, error, refetch } = useChoiceLists()
  const { projects, refetch: refetchProjects } = useProjects()

  // Group choice lists by project, merging in all known projects (even empty ones)
  const grouped = useMemo(() => {
    const map = new Map<number, { id: number; project_name: string; project_slug: string; description: string; lists: typeof choiceLists }>()
    // Seed from all projects so empty projects are shown
    for (const p of projects) {
      map.set(p.id, { id: p.id, project_name: p.name, project_slug: p.slug, description: p.description, lists: [] })
    }
    for (const list of choiceLists) {
      if (!map.has(list.project)) {
        map.set(list.project, { id: list.project, project_name: list.project_name, project_slug: list.project_slug, description: '', lists: [] })
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
  const handleDeleteProject = async (id: number) => {
    setDeletingProjectId(id)
    try {
      await apiClient.deleteProject(id)
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        </div>
        <button
          onClick={() => { setShowProjectForm(v => !v); setProjectFormError(null) }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          {showProjectForm ? 'Cancel' : '+ New Project'}
        </button>
      </div>

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
                    <span className="text-xs text-gray-400">{group.lists.length} list{group.lists.length !== 1 ? 's' : ''}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {confirmDeleteProjectId === group.id ? (
                      <>
                        <span className="text-xs text-gray-500">Delete project{group.lists.length > 0 ? ` and ${group.lists.length} list${group.lists.length !== 1 ? 's' : ''}` : ''}?</span>
                        <button
                          onClick={() => handleDeleteProject(group.id)}
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
                          {isEditingProject ? 'Cancel' : 'Edit'}
                        </button>
                        <button
                          onClick={() => { cancelEditProject(); setConfirmDeleteProjectId(group.id) }}
                          className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors opacity-0 group-hover/project:opacity-100"
                        >
                          Delete
                        </button>
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
    </div>
  )
}

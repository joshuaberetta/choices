import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useChoiceLists, useProjects } from '../hooks/useChoiceLists'
import apiClient from '../services/api'

export default function ChoiceListsPage() {
  const { choiceLists, loading, error, refetch } = useChoiceLists()
  const { projects } = useProjects()

  const [showForm, setShowForm] = useState(false)

  // Group choice lists by project
  const grouped = useMemo(() => {
    const map = new Map<number, { project_name: string; project_slug: string; lists: typeof choiceLists }>()
    for (const list of choiceLists) {
      if (!map.has(list.project)) {
        map.set(list.project, { project_name: list.project_name, project_slug: list.project_slug, lists: [] })
      }
      map.get(list.project)!.lists.push(list)
    }
    return Array.from(map.values()).sort((a, b) => a.project_name.localeCompare(b.project_name))
  }, [choiceLists])

  // All projects expanded by default
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const toggleProject = (projectId: number) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(projectId) ? next.delete(projectId) : next.add(projectId)
      return next
    })
  const [form, setForm] = useState({ project: '', name: '', slug: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      await apiClient.createChoiceList({
        project: Number(form.project),
        name: form.name,
        slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
        description: form.description,
      })
      setShowForm(false)
      setForm({ project: '', name: '', slug: '', description: '' })
      refetch()
    } catch {
      setFormError('Failed to create choice list. Check that the project and slug are valid.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Choice Lists</h1>
          <p className="text-gray-500 text-sm mt-1">Manage external choice lists for KoboToolbox</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New List'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Create Choice List</h2>
          {formError && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded">{formError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select
                required
                value={form.project}
                onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select project…</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                required
                type="text"
                placeholder="e.g. Fruits"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug <span className="text-gray-400 font-normal">(auto-generated if empty)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. fruits"
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                placeholder="Optional"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating…' : 'Create List'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      ) : choiceLists.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No choice lists yet</p>
          <p className="text-sm mt-1">Create one using the button above, or add data via the Django admin.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(group => {
            const isOpen = !collapsed.has(group.lists[0].project)
            return (
              <div key={group.project_slug} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Accordion header */}
                <button
                  onClick={() => toggleProject(group.lists[0].project)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">{group.project_name}</span>
                    <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                      {group.project_slug}
                    </span>
                    <span className="text-xs text-gray-400">{group.lists.length} list{group.lists.length !== 1 ? 's' : ''}</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Accordion body */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-5 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Name</th>
                          <th className="px-5 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Slug</th>
                          <th className="px-5 py-2.5 text-right font-semibold text-gray-500 text-xs uppercase tracking-wide"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.lists.map(list => (
                          <tr key={list.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-gray-900">{list.name}</td>
                            <td className="px-5 py-3 font-mono text-gray-500 text-xs">{list.slug}</td>
                            <td className="px-5 py-3 text-right">
                              <Link
                                to={`/choice-lists/${list.id}`}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
                              >
                                View →
                              </Link>
                            </td>
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
  )
}

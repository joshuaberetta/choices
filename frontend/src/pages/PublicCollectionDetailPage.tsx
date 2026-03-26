import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import apiClient, { type PublicCollection, type PublicChoiceList } from '../services/api'
import { useAuthStore } from '../store/authStore'

function buildCsvUrl(ownerUsername: string, projectSlug: string, listSlug: string): string {
  return `${window.location.origin}/${ownerUsername}/${projectSlug}/${listSlug}/export/${listSlug}.csv`
}

export default function PublicCollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [collection, setCollection] = useState<PublicCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set())
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    apiClient.getPublicCollection(Number(id))
      .then(res => {
        setCollection(res.data)
        // Expand all projects by default
        if (res.data.projects) {
          setExpandedProjects(new Set(res.data.projects.map(p => p.id)))
        }
      })
      .catch(() => setError('Collection not found or not public.'))
      .finally(() => setLoading(false))
  }, [id])

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

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
  if (error || !collection) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
      {error ?? 'Collection not found.'}
      <div className="mt-3"><Link to="/collections/public" className="text-indigo-600 hover:underline">← Public Collections</Link></div>
    </div>
  )

  return (
    <div>
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
            <Link
              to="/collections"
              className="text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-300 transition-colors shrink-0"
            >
              My Collections →
            </Link>
          )}
        </div>
      </div>

      {!collection.projects || collection.projects.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400 text-sm">
          This collection has no projects yet.
        </div>
      ) : (
        <div className="space-y-3">
          {collection.projects.map(project => {
            const expanded = expandedProjects.has(project.id)
            const lists: PublicChoiceList[] = project.choice_lists ?? []
            return (
              <div key={project.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {/* Project header */}
                <button
                  onClick={() => toggleProject(project.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <span className="font-semibold text-gray-900">{project.name}</span>
                    {project.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{project.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      by {project.owner_username} · {project.list_count} list{project.list_count !== 1 ? 's' : ''} · Updated {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-gray-400 transition-transform ml-4 shrink-0 ${expanded ? 'rotate-90' : ''}`}>›</span>
                </button>

                {/* Choice lists */}
                {expanded && (
                  <div className="border-t border-gray-100">
                    {lists.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-gray-400">No choice lists.</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {lists.map(list => {
                          const csvUrl = buildCsvUrl(project.owner_username, project.slug, list.slug)
                          const activeChoices = list.choices?.filter(c => {
                            // Choices in the public serializer are already filtered
                            return true
                          }) ?? []
                          return (
                            <div key={list.id} className="px-5 py-4">
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <div>
                                  <span className="font-medium text-gray-800 text-sm">{list.name}</span>
                                  {list.description && <p className="text-xs text-gray-400">{list.description}</p>}
                                </div>
                                <button
                                  onClick={() => copyUrl(csvUrl)}
                                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors shrink-0 ${
                                    copiedUrl === csvUrl
                                      ? 'bg-green-100 border-green-300 text-green-700'
                                      : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                                  }`}
                                >
                                  {copiedUrl === csvUrl ? '✓ Copied' : 'Copy CSV URL'}
                                </button>
                              </div>
                              {activeChoices.length > 0 && (
                                <div className="mt-1 max-h-40 overflow-y-auto">
                                  <table className="w-full text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-gray-50">
                                        <th className="text-left px-2 py-1 text-gray-500 font-medium border border-gray-200">Name</th>
                                        <th className="text-left px-2 py-1 text-gray-500 font-medium border border-gray-200">Label</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {activeChoices.map((choice, i) => (
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
      )}
    </div>
  )
}

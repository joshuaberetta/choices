import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFollowedLists } from '../hooks/useFollowedLists'
import apiClient, { type UserChoiceListConfig } from '../services/api'

export default function FollowingPage() {
  const { configs, loading, error, refetch } = useFollowedLists()
  const [copied, setCopied] = useState<number | null>(null)
  const [unfollowing, setUnfollowing] = useState<number | null>(null)
  const [unfollowingProject, setUnfollowingProject] = useState<string | null>(null)
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleUnfollow = async (id: number) => {
    if (!confirm('Unfollow this list? Your column customisations will be lost.')) return
    setUnfollowing(id)
    try {
      await apiClient.unfollowList(id)
      refetch()
      showToast('Unfollowed list.')
    } catch {
      showToast('Failed to unfollow.')
    } finally {
      setUnfollowing(null)
    }
  }

  const handleUnfollowProject = async (projectSlug: string, projectConfigs: UserChoiceListConfig[]) => {
    if (!confirm(`Unfollow all ${projectConfigs.length} list${projectConfigs.length !== 1 ? 's' : ''} in this project? All column customisations will be lost.`)) return
    setUnfollowingProject(projectSlug)
    for (const cfg of projectConfigs) {
      try { await apiClient.unfollowList(cfg.id) } catch { /* continue */ }
    }
    setUnfollowingProject(null)
    refetch()
    showToast('Unfollowed all lists in this project.')
  }

  const copyUrl = (config: UserChoiceListConfig) => {
    const url = `${window.location.origin}${config.export_url}`
    navigator.clipboard.writeText(url)
    setCopied(config.id)
    setTimeout(() => setCopied(c => (c === config.id ? null : c)), 1500)
  }

  const toggleProject = (slug: string) =>
    setCollapsedProjects(prev => {
      const next = new Set(prev)
      next.has(slug) ? next.delete(slug) : next.add(slug)
      return next
    })

  // Group configs by project_slug, preserving insertion order
  const projectGroups = configs.reduce<Map<string, { name: string; ownerUsername: string; projectId: number; configs: UserChoiceListConfig[] }>>(
    (map, cfg) => {
      if (!map.has(cfg.project_slug)) {
        map.set(cfg.project_slug, {
          name: cfg.project_name,
          ownerUsername: cfg.owner_username,
          projectId: cfg.project_id,
          configs: [],
        })
      }
      map.get(cfg.project_slug)!.configs.push(cfg)
      return map
    },
    new Map(),
  )

  return (
    <div>
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Following</h1>
        <p className="text-sm text-gray-500 mt-1">
          Projects and choice lists you follow, with your personal column customisations.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && configs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">You are not following any lists yet.</p>
          <p className="text-sm mt-2">
            Browse <Link to="/collections/public" className="text-indigo-600 hover:underline">public collections</Link> or{' '}
            <Link to="/public/projects" className="text-indigo-600 hover:underline">public projects</Link> and click "Follow all lists" on a project.
          </p>
        </div>
      )}

      {!loading && !error && projectGroups.size > 0 && (
        <div className="space-y-4">
          {Array.from(projectGroups.entries()).map(([projectSlug, group]) => {
            const isCollapsed = collapsedProjects.has(projectSlug)
            const isUnfollowingThis = unfollowingProject === projectSlug
            return (
              <div key={projectSlug} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Project header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <button
                    onClick={() => toggleProject(projectSlug)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <svg
                      className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                    <div className="min-w-0">
                      <Link
                        to={`/public/projects/${group.projectId}`}
                        onClick={e => e.stopPropagation()}
                        className="font-semibold text-gray-900 hover:text-indigo-700 hover:underline"
                      >
                        {group.name}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">
                        by {group.ownerUsername} · {group.configs.length} list{group.configs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleUnfollowProject(projectSlug, group.configs)}
                    disabled={isUnfollowingThis}
                    className="ml-4 shrink-0 text-xs bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                  >
                    {isUnfollowingThis ? 'Removing…' : 'Unfollow project'}
                  </button>
                </div>

                {/* List rows */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-50">
                    {group.configs.map(cfg => (
                      <div key={cfg.id} className="px-5 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                to={`/following/${cfg.id}`}
                                className="text-sm font-medium text-indigo-700 hover:underline"
                              >
                                {cfg.choice_list_name}
                              </Link>
                              {cfg.label_column_name && (
                                <span className="text-xs text-gray-400 font-mono">{cfg.label_column_name}</span>
                              )}
                            </div>
                            {cfg.columns.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {cfg.columns.map(col => (
                                  <span key={col.id} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                                    {col.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => copyUrl(cfg)}
                              className="text-xs bg-gray-50 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-600 hover:text-indigo-700 px-2.5 py-1.5 rounded transition-colors"
                              title="Copy public CSV export URL"
                            >
                              {copied === cfg.id ? '✓ Copied' : 'Copy CSV URL'}
                            </button>
                            <Link
                              to={`/following/${cfg.id}`}
                              className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-2.5 py-1.5 rounded transition-colors"
                            >
                              Open
                            </Link>
                            <button
                              onClick={() => handleUnfollow(cfg.id)}
                              disabled={unfollowing === cfg.id}
                              className="text-xs bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 px-2.5 py-1.5 rounded transition-colors disabled:opacity-50"
                            >
                              {unfollowing === cfg.id ? '…' : 'Unfollow'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
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

import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useFollowedList } from '../hooks/useFollowedLists'
import apiClient, {
  type FollowedChoice,
  type UserChoiceListColumn,
} from '../services/api'

// --------------------------------------------------------------------------
// EditableCell (user extra columns only)
// --------------------------------------------------------------------------

function EditableCell({
  value,
  saving,
  editing,
  onStart,
  onDraftChange,
  onCommit,
  onCancel,
}: {
  value: string
  saving: boolean
  editing: boolean
  onStart: () => void
  onDraftChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
}) {
  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={e => onDraftChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={e => {
          if (e.key === 'Enter') onCommit()
          if (e.key === 'Escape') onCancel()
        }}
        disabled={saving}
        className="border border-indigo-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
      />
    )
  }
  return (
    <span
      className={`cursor-pointer ${
        value
          ? 'text-gray-900 hover:text-indigo-700 underline decoration-dotted underline-offset-2'
          : 'text-gray-300 hover:text-indigo-400 italic'
      }`}
      onClick={onStart}
    >
      {value || '—'}
    </span>
  )
}

// --------------------------------------------------------------------------
// Main page
// --------------------------------------------------------------------------

export default function FollowedListDetailPage() {
  const { configId } = useParams<{ configId: string }>()
  const navigate = useNavigate()
  const { config, setConfig, loading, error } = useFollowedList(Number(configId))

  const [choices, setChoices] = useState<FollowedChoice[]>([])
  const [choicesLoading, setChoicesLoading] = useState(false)

  const [labelOverrideDraft, setLabelOverrideDraft] = useState('')
  const [savingLabel, setSavingLabel] = useState(false)

  const [editCell, setEditCell] = useState<{ choiceId: number; colId: number; draft: string } | null>(null)
  const [savingCell, setSavingCell] = useState(false)

  const [newColName, setNewColName] = useState('')
  const [addingCol, setAddingCol] = useState(false)
  const [editingColId, setEditingColId] = useState<number | null>(null)
  const [editingColDraft, setEditingColDraft] = useState('')

  const [dupLabelName, setDupLabelName] = useState('')
  const [dupLabelLoading, setDupLabelLoading] = useState(false)

  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ matched: number; skipped: number } | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // Load choices when config is available
  useEffect(() => {
    if (!config) return
    setChoicesLoading(true)
    apiClient.getFollowedListChoices(config.id)
      .then(res => setChoices(res.data))
      .catch(() => showToast('Failed to load choices.'))
      .finally(() => setChoicesLoading(false))
  }, [config?.id])

  // Sync label override draft from config
  useEffect(() => {
    if (config) setLabelOverrideDraft(config.label_column_name)
  }, [config?.label_column_name])

  // ---- label column override ----

  const saveLabelOverride = async () => {
    if (!config) return
    const trimmed = labelOverrideDraft.trim()
    if (trimmed === config.label_column_name) return
    setSavingLabel(true)
    try {
      const res = await apiClient.updateFollowConfig(config.id, { label_column_name: trimmed })
      setConfig(res.data)
      showToast('Label column override saved.')
    } catch {
      showToast('Failed to save.')
    } finally {
      setSavingLabel(false)
    }
  }

  // ---- user extra cell edit ----

  const commitCell = async () => {
    if (!editCell || !config) return
    const choice = choices.find(c => c.id === editCell.choiceId)
    if (!choice) { setEditCell(null); return }
    const currentUev = choice.user_extra_values.find(u => u.column === editCell.colId)
    if (editCell.draft === (currentUev?.value ?? '')) { setEditCell(null); return }
    setSavingCell(true)
    try {
      await apiClient.setUserExtraValue(editCell.choiceId, config.id, editCell.colId, editCell.draft)
      setChoices(prev => prev.map(c => {
        if (c.id !== editCell.choiceId) return c
        const alreadyHas = c.user_extra_values.some(u => u.column === editCell.colId)
        const updated = alreadyHas
          ? c.user_extra_values.map(u => u.column === editCell.colId ? { ...u, value: editCell.draft } : u)
          : [...c.user_extra_values, { id: 0, column: editCell.colId, value: editCell.draft }]
        return { ...c, user_extra_values: updated }
      }))
    } catch {
      showToast('Failed to save cell value.')
    } finally {
      setSavingCell(false)
      setEditCell(null)
    }
  }

  // ---- add user column ----

  const handleAddColumn = async () => {
    if (!config || !newColName.trim()) return
    setAddingCol(true)
    try {
      const res = await apiClient.addUserColumn(config.id, newColName.trim())
      setConfig(prev => prev ? { ...prev, columns: [...prev.columns, res.data] } : prev)
      setNewColName('')
      showToast(`Column "${res.data.name}" added.`)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      showToast(msg ?? 'Failed to add column.')
    } finally {
      setAddingCol(false)
    }
  }

  // ---- rename user column ----

  const commitRenameCol = async (col: UserChoiceListColumn) => {
    if (!config) return
    const trimmed = editingColDraft.trim()
    if (!trimmed || trimmed === col.name) { setEditingColId(null); return }
    try {
      const res = await apiClient.updateUserColumn(config.id, col.id, trimmed)
      setConfig(prev => prev ? {
        ...prev,
        columns: prev.columns.map(c => c.id === col.id ? res.data : c),
      } : prev)
      showToast('Column renamed.')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      showToast(msg ?? 'Failed to rename column.')
    } finally {
      setEditingColId(null)
    }
  }

  // ---- delete user column ----

  const handleDeleteColumn = async (colId: number) => {
    if (!config) return
    if (!confirm('Delete this column? All cell values will be lost.')) return
    try {
      await apiClient.removeUserColumn(config.id, colId)
      setConfig(prev => prev ? { ...prev, columns: prev.columns.filter(c => c.id !== colId) } : prev)
      showToast('Column deleted.')
    } catch {
      showToast('Failed to delete column.')
    }
  }

  // ---- duplicate label column ----

  const handleDuplicateLabel = async () => {
    if (!config || !dupLabelName.trim() || choices.length === 0) return
    setDupLabelLoading(true)
    try {
      const escCsv = (v: string) => /["\,\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
      const lines = ['name,' + escCsv(dupLabelName.trim())]
      for (const c of choices) lines.push(`${escCsv(c.value)},${escCsv(c.label)}`)
      const file = new File([lines.join('\n')], 'dup_label.csv', { type: 'text/csv' })
      const res = await apiClient.importUserColumns(config.id, file)
      showToast(`Duplicated label as "${dupLabelName.trim()}" (${res.data.matched} choices).`)
      setDupLabelName('')
      const [updatedConfig, updatedChoices] = await Promise.all([
        apiClient.getFollowedList(config.id),
        apiClient.getFollowedListChoices(config.id),
      ])
      setConfig(updatedConfig.data)
      setChoices(updatedChoices.data)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      showToast(msg ?? 'Failed to duplicate label.')
    } finally {
      setDupLabelLoading(false)
    }
  }

  // ---- unfollow ----

  const handleUnfollow = async () => {
    if (!config) return
    if (!confirm('Unfollow this list? Your column customisations will be lost.')) return
    try {
      await apiClient.unfollowList(config.id)
      navigate('/following')
    } catch {
      showToast('Failed to unfollow.')
    }
  }

  // ---- copy export URL ----

  const copyExportUrl = () => {
    if (!config) return
    const url = `${window.location.origin}${config.export_url}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // ---- CSV import ----

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!config) return
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const res = await apiClient.importUserColumns(config.id, file)
      setImportResult({ matched: res.data.matched, skipped: res.data.skipped })
      showToast(`Import done: ${res.data.matched} matched, ${res.data.skipped} skipped.`)
      // Reload config + choices to pick up new columns / values
      const [updatedConfig, updatedChoices] = await Promise.all([
        apiClient.getFollowedList(config.id),
        apiClient.getFollowedListChoices(config.id),
      ])
      setConfig(updatedConfig.data)
      setChoices(updatedChoices.data)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      showToast(msg ?? 'Import failed.')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // --------------------------------------------------------------------------

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
  if (error || !config) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
      {error ?? 'Config not found.'}
      <div className="mt-3">
        <Link to="/following" className="text-indigo-600 hover:underline">← Back to Following</Link>
      </div>
    </div>
  )

  const userCols = config.columns
  const origCols = config.original_columns ?? []
  const effectiveLabel = config.label_column_name || config.original_label_column_name || 'label'

  return (
    <div>
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="mb-6">
        <Link to="/following" className="text-sm text-indigo-600 hover:underline">← Back to Following</Link>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{config.choice_list_name}</h1>
              <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded">
                Following
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {config.project_name}{' '}
              <span className="text-gray-400">by {config.owner_username}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/public/projects/${config.project_id}`}
              className="text-xs bg-gray-50 border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700 px-3 py-1.5 rounded transition-colors"
            >
              View original
            </Link>
            <button
              onClick={handleUnfollow}
              className="text-xs bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded transition-colors"
            >
              Unfollow
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 mb-5">
        {/* Label column override */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Label column override</h2>
          <p className="text-xs text-gray-500 mb-3">
            Rename the label column header in your CSV export. Leave blank to inherit the original
            ({config.original_label_column_name || 'label'}).
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={labelOverrideDraft}
              onChange={e => setLabelOverrideDraft(e.target.value)}
              onBlur={saveLabelOverride}
              onKeyDown={e => { if (e.key === 'Enter') saveLabelOverride() }}
              placeholder={config.original_label_column_name || 'label'}
              disabled={savingLabel}
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Effective: <span className="font-mono">{effectiveLabel}</span>
          </p>
        </div>

        {/* Export URL */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Public CSV export URL</h2>
          <p className="text-xs text-gray-500 mb-3">
            Anyone with this URL can download your customised CSV — no login required.
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 text-xs bg-gray-50 border border-gray-200 px-2 py-1.5 rounded font-mono text-gray-600 truncate">
              {window.location.origin}{config.export_url}
            </code>
            <button
              onClick={copyExportUrl}
              className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors shrink-0"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* CSV import */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Import CSV</h2>
          <p className="text-xs text-gray-500 mb-3">
            Upload a CSV with a <code>name</code>/<code>value</code> column to match choices.
            Additional columns are auto-created as your custom columns with their values bulk-filled.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
            id="user-import-csv"
          />
          <label
            htmlFor="user-import-csv"
            className={`inline-block text-xs border rounded px-3 py-1.5 cursor-pointer transition-colors ${
              importing
                ? 'bg-gray-50 border-gray-200 text-gray-400 pointer-events-none'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            {importing ? 'Importing…' : 'Choose CSV file'}
          </label>
          {importResult && (
            <p className="text-xs text-gray-500 mt-2">
              Last import: {importResult.matched} matched
              {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}
            </p>
          )}
        </div>
      </div>

      {/* Add user column */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Your custom columns</h2>
        {userCols.length === 0 && (
          <p className="text-xs text-gray-400 mb-3">No custom columns yet.</p>
        )}
        {userCols.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {userCols.map(col => (
              <div key={col.id} className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded px-2 py-1">
                {editingColId === col.id ? (
                  <input
                    autoFocus
                    value={editingColDraft}
                    onChange={e => setEditingColDraft(e.target.value)}
                    onBlur={() => commitRenameCol(col)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRenameCol(col)
                      if (e.key === 'Escape') setEditingColId(null)
                    }}
                    className="border border-indigo-300 rounded px-1 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 w-28"
                  />
                ) : (
                  <span
                    className="text-xs font-mono text-indigo-700 cursor-pointer hover:underline"
                    title="Click to rename"
                    onClick={() => { setEditingColId(col.id); setEditingColDraft(col.name) }}
                  >
                    {col.name}
                  </span>
                )}
                <button
                  onClick={() => handleDeleteColumn(col.id)}
                  className="text-red-400 hover:text-red-600 text-xs ml-1 leading-none"
                  title="Delete column"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newColName}
            onChange={e => setNewColName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddColumn() }}
            placeholder="New column name…"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          />
          <button
            onClick={handleAddColumn}
            disabled={addingCol || !newColName.trim()}
            className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            + Add column
          </button>
        </div>

        {/* Duplicate label shortcut */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">
            <span className="font-medium text-gray-600">Duplicate label column</span>
            {' — '}copy the original labels into a new column with a different header
            (e.g. for XLSForm multi-language: <span className="font-mono">label::Español (es)</span>).
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={dupLabelName}
              onChange={e => setDupLabelName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleDuplicateLabel() }}
              placeholder="e.g. label::Español (es)"
              disabled={dupLabelLoading || choices.length === 0}
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <button
              onClick={handleDuplicateLabel}
              disabled={dupLabelLoading || !dupLabelName.trim() || choices.length === 0}
              className="text-sm bg-gray-100 border border-gray-300 text-gray-700 px-4 py-1.5 rounded hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors disabled:opacity-50"
            >
              {dupLabelLoading ? 'Duplicating…' : 'Duplicate'}
            </button>
          </div>
        </div>
      </div>

      {/* Choices table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Choices
            {choices.length > 0 && (
              <span className="ml-2 text-xs text-gray-400 font-normal">{choices.length}</span>
            )}
          </h2>
        </div>

        {choicesLoading ? (
          <div className="py-10 text-center text-gray-400 text-sm">Loading choices…</div>
        ) : choices.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No choices in this list.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {effectiveLabel}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    name
                  </th>
                  {origCols.map(col => (
                    <th key={col.id} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {col.name}
                      <span className="ml-1 text-gray-300 text-xs font-normal normal-case">(original)</span>
                    </th>
                  ))}
                  {userCols.map(col => (
                    <th key={col.id} className="px-5 py-3 text-left text-xs font-semibold text-indigo-500 uppercase tracking-wide">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {choices.map(choice => (
                  <tr key={choice.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50">
                    {/* label (read-only) */}
                    <td className="px-5 py-3 text-gray-900">{choice.label}</td>
                    {/* value/name (read-only) */}
                    <td className="px-5 py-3">
                      <code className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {choice.value}
                      </code>
                    </td>
                    {/* original extra columns (read-only) */}
                    {origCols.map(col => {
                      const ev = choice.extra_values.find(e => e.column === col.id)
                      return (
                        <td key={col.id} className="px-5 py-3 text-gray-400 text-xs">
                          {ev?.value || '—'}
                        </td>
                      )
                    })}
                    {/* user extra columns (editable) */}
                    {userCols.map(col => {
                      const uev = choice.user_extra_values.find(u => u.column === col.id)
                      const isEditing = editCell?.choiceId === choice.id && editCell.colId === col.id
                      const cellVal = isEditing ? editCell.draft : (uev?.value ?? '')
                      return (
                        <td key={col.id} className="px-5 py-3 min-w-[8rem]">
                          <EditableCell
                            value={cellVal}
                            saving={savingCell && isEditing}
                            editing={isEditing}
                            onStart={() => setEditCell({ choiceId: choice.id, colId: col.id, draft: uev?.value ?? '' })}
                            onDraftChange={v => setEditCell(prev => prev ? { ...prev, draft: v } : prev)}
                            onCommit={commitCell}
                            onCancel={() => setEditCell(null)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

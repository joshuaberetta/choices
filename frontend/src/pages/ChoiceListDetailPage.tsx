import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useChoiceList } from '../hooks/useChoiceLists'
import apiClient, { type Choice, type ChoiceListColumn, type ChoiceExtraValue } from '../services/api'

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

type EditTarget =
  | { kind: 'field'; field: 'label' | 'value'; draft: string }
  | { kind: 'extra'; columnId: number; draft: string }

function EditableCell({
  value,
  saving,
  editing,
  onStart,
  onDraftChange,
  onCommit,
  onCancel,
  mono,
  placeholder,
}: {
  value: string
  saving: boolean
  editing: boolean
  onStart: () => void
  onDraftChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  mono?: boolean
  placeholder?: string
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
        className={`border border-indigo-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full ${
          mono ? 'font-mono text-xs' : ''
        }`}
      />
    )
  }
  if (mono) {
    return (
      <code
        className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
        title="Click to edit value"
        onClick={onStart}
      >
        {value}
      </code>
    )
  }
  return (
    <span
      className={`cursor-pointer ${
        value
          ? 'text-gray-900 hover:text-indigo-700 underline decoration-dotted underline-offset-2'
          : 'text-gray-300 hover:text-indigo-400 italic'
      }`}
      title={placeholder ? `Click to edit (${placeholder})` : 'Click to edit'}
      onClick={onStart}
    >
      {value || (placeholder ? placeholder : '—')}
    </span>
  )
}

// --------------------------------------------------------------------------
// SortableChoiceRow
// --------------------------------------------------------------------------

function SortableChoiceRow({
  choice,
  columns,
  onDelete,
  onSave,
  onSaveExtra,
}: {
  choice: Choice
  columns: ChoiceListColumn[]
  onDelete: (id: number) => void
  onSave: (id: number, field: 'label' | 'value', value: string) => Promise<void>
  onSaveExtra: (id: number, columnId: number, value: string) => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: choice.id })
  const [edit, setEdit] = useState<EditTarget | null>(null)
  const [saving, setSaving] = useState(false)

  const SYSTEM_BOOL_COLS = ['protected', 'removed', 'pin']

  const isProtected = columns.some(col => col.name === 'protected' &&
    choice.extra_values.find(ev => ev.column === col.id)?.value === 'true')

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const commitEdit = async () => {
    if (!edit) return
    if (edit.kind === 'field') {
      const current = edit.field === 'label' ? choice.label : choice.value
      if (edit.draft === current || !edit.draft.trim()) { setEdit(null); return }
      setSaving(true)
      try { await onSave(choice.id, edit.field, edit.draft.trim()) } finally { setSaving(false); setEdit(null) }
    } else {
      const currentEv = choice.extra_values.find(ev => ev.column === edit.columnId)
      if (edit.draft === (currentEv?.value ?? '')) { setEdit(null); return }
      setSaving(true)
      try { await onSaveExtra(choice.id, edit.columnId, edit.draft) } finally { setSaving(false); setEdit(null) }
    }
  }

  const handleToggle = async (colId: number, checked: boolean) => {
    setSaving(true)
    try { await onSaveExtra(choice.id, colId, checked ? 'true' : 'false') } finally { setSaving(false) }
  }

  return (
    <tr ref={setNodeRef} style={style} className={`border-b border-gray-50 last:border-b-0 transition-colors ${
      isProtected ? 'bg-amber-50 hover:bg-amber-100' : 'bg-white hover:bg-gray-50'
    }`}>
      <td className="px-3 py-3 text-gray-300 w-8">
        <span
          className="cursor-grab active:cursor-grabbing select-none text-lg leading-none"
          {...attributes}
          {...listeners}
        >
          ⠿
        </span>
      </td>
      {/* Label */}
      <td className="px-5 py-3">
        <EditableCell
          value={edit?.kind === 'field' && edit.field === 'label' ? edit.draft : choice.label}
          saving={saving}
          editing={edit?.kind === 'field' && edit.field === 'label'}
          onStart={() => setEdit({ kind: 'field', field: 'label', draft: choice.label })}
          onDraftChange={v => setEdit({ kind: 'field', field: 'label', draft: v })}
          onCommit={commitEdit}
          onCancel={() => setEdit(null)}
        />
      </td>
      {/* Value */}
      <td className="px-5 py-3">
        <EditableCell
          value={edit?.kind === 'field' && edit.field === 'value' ? edit.draft : choice.value}
          saving={saving}
          editing={edit?.kind === 'field' && edit.field === 'value'}
          onStart={() => setEdit({ kind: 'field', field: 'value', draft: choice.value })}
          onDraftChange={v => setEdit({ kind: 'field', field: 'value', draft: v })}
          onCommit={commitEdit}
          onCancel={() => setEdit(null)}
          mono
        />
      </td>
      {/* Extra columns */}
      {columns.map(col => {
        const ev = choice.extra_values.find((e: ChoiceExtraValue) => e.column === col.id)
        if (SYSTEM_BOOL_COLS.includes(col.name)) {
          const checked = ev?.value === 'true'
          return (
            <td key={col.id} className="px-5 py-3 text-center">
              <input
                type="checkbox"
                checked={checked}
                disabled={saving}
                onChange={e => handleToggle(col.id, e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                title={`${col.name}: ${checked ? 'true' : 'false'}`}
              />
            </td>
          )
        }
        const val = (edit?.kind === 'extra' && edit.columnId === col.id) ? edit.draft : (ev?.value ?? '')
        return (
          <td key={col.id} className="px-5 py-3 min-w-[8rem]">
            <EditableCell
              value={val}
              saving={saving}
              editing={edit?.kind === 'extra' && edit.columnId === col.id}
              onStart={() => setEdit({ kind: 'extra', columnId: col.id, draft: ev?.value ?? '' })}
              onDraftChange={v => setEdit({ kind: 'extra', columnId: col.id, draft: v })}
              onCommit={commitEdit}
              onCancel={() => setEdit(null)}
              placeholder="blank"
            />
          </td>
        )
      })}
      <td className="px-5 py-3 text-gray-400">{choice.order}</td>
      <td className="px-5 py-3 text-right">
        {isProtected ? (
          <span
            className="px-2.5 py-1 text-xs text-amber-600 border border-amber-200 rounded-lg bg-amber-50 cursor-not-allowed select-none"
            title="This choice is protected and cannot be deleted"
          >
            🔒 Protected
          </span>
        ) : (
          <button
            onClick={() => onDelete(choice.id)}
            className="px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  )
}

export default function ChoiceListDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { choiceList, loading, error, refetch } = useChoiceList(id!)

  const [label, setLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [choices, setChoices] = useState<Choice[]>([])
  const [columns, setColumns] = useState<ChoiceListColumn[]>([])
  const [sortCol, setSortCol] = useState<'label' | 'value' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Label column name
  const [labelColumnName, setLabelColumnName] = useState('label')
  const [labelColumnEdit, setLabelColumnEdit] = useState<string | null>(null)
  const [labelColumnError, setLabelColumnError] = useState<string | null>(null)

  // Name generation settings
  const [nameGeneration, setNameGeneration] = useState<'uuid' | 'from_label'>('uuid')
  const [nameMaxLength, setNameMaxLength] = useState(0)
  const [nameSettingsSaving, setNameSettingsSaving] = useState(false)
  const [nameSettingsError, setNameSettingsError] = useState<string | null>(null)

  // Column rename state
  const [columnEdit, setColumnEdit] = useState<{ id: number; draft: string } | null>(null)
  // New column add state
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [columnError, setColumnError] = useState<string | null>(null)
  const [copiedPath, setCopiedPath] = useState<string | null>(null)

  useEffect(() => {
    if (choiceList?.choices) {
      setChoices(
        [...choiceList.choices]
          .sort((a, b) => a.order - b.order)
          .map(c => ({ ...c, extra_values: c.extra_values ?? [] }))
      )
    }
    if (choiceList?.columns) {
      setColumns(choiceList.columns)
    }
    if (choiceList?.label_column_name) {
      setLabelColumnName(choiceList.label_column_name)
    }
    if (choiceList) {
      setNameGeneration(choiceList.name_generation ?? 'uuid')
      setNameMaxLength(choiceList.name_max_length ?? 0)
    }
  }, [choiceList])

  const sensors = useSensors(useSensor(PointerSensor))

  const handleSortClick = async (col: 'label' | 'value') => {
    if (sortCol === col && sortDir === 'desc') {
      setSortCol(null)
      return
    }
    const newDir: 'asc' | 'desc' = sortCol === col ? 'desc' : 'asc'
    setSortCol(col)
    setSortDir(newDir)

    // Pin=true choices always stay at the end in their original relative order
    const pinCol = columns.find(c => c.name === 'pin')
    const isPinned = (c: Choice) =>
      pinCol ? c.extra_values.find(ev => ev.column === pinCol.id)?.value === 'true' : false

    const unpinned = choices.filter(c => !isPinned(c))
    const pinned = choices.filter(c => isPinned(c))

    const sortedUnpinned = [...unpinned].sort((a, b) =>
      a[col].localeCompare(b[col], undefined, { numeric: true, sensitivity: 'base' }) *
      (newDir === 'asc' ? 1 : -1)
    )

    const sorted = [...sortedUnpinned, ...pinned].map((c, i) => ({ ...c, order: i }))

    setChoices(sorted)
    try {
      await apiClient.reorderChoices(id!, sorted.map(c => ({ id: c.id, order: c.order })))
    } catch {
      refetch()
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = choices.findIndex(c => c.id === active.id)
    const newIndex = choices.findIndex(c => c.id === over.id)
    const reordered = arrayMove(choices, oldIndex, newIndex).map((c, i) => ({ ...c, order: i }))
    setChoices(reordered)
    setSortCol(null)
    try {
      await apiClient.reorderChoices(id!, reordered.map(c => ({ id: c.id, order: c.order })))
    } catch {
      refetch()
    }
  }

  const handleSaveField = async (choiceId: number, field: 'label' | 'value', value: string) => {
    const updated = await apiClient.updateChoice(choiceId, { [field]: value })
    setChoices(prev => prev.map(c => c.id === choiceId ? { ...c, [field]: updated.data[field] } : c))
  }

  const handleSaveExtra = async (choiceId: number, columnId: number, value: string) => {
    const res = await apiClient.setExtraValue(choiceId, columnId, value)
    const updated = res.data
    setChoices(prev => prev.map(c => {
      if (c.id !== choiceId) return c
      const existing = c.extra_values.find(ev => ev.column === columnId)
      if (existing) {
        return { ...c, extra_values: c.extra_values.map(ev => ev.column === columnId ? updated : ev) }
      }
      return { ...c, extra_values: [...c.extra_values, updated] }
    }))
  }

  const handleAddChoice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim() || !id) return
    setAdding(true)
    setAddError(null)
    try {
      await apiClient.createChoice(id, label.trim())
      setLabel('')
      refetch()
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data
        const msg = data.error || data.detail || data.label?.[0] || JSON.stringify(data)
        setAddError(`Failed to add choice: ${msg}`)
      } else {
        setAddError('Failed to add choice. Please try again.')
      }
    } finally {
      setAdding(false)
    }
  }

  const handleSaveNameSettings = async () => {
    if (!id) return
    setNameSettingsSaving(true)
    setNameSettingsError(null)
    try {
      await apiClient.updateChoiceList(id, { name_generation: nameGeneration, name_max_length: nameMaxLength })
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data
        setNameSettingsError(data.error || data.detail || JSON.stringify(data))
      } else {
        setNameSettingsError('Failed to save name settings.')
      }
    } finally {
      setNameSettingsSaving(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !id) return
    setImporting(true)
    setImportError(null)
    try {
      const res = await apiClient.importChoices(id, file)
      const imported = [...(res.data.choices ?? [])].sort((a, b) => a.order - b.order)
      setChoices(imported.map(c => ({ ...c, extra_values: c.extra_values ?? [] })))
      setColumns(res.data.columns ?? [])
      setSortCol(null)
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data
        setImportError(data.error || data.detail || JSON.stringify(data))
      } else {
        setImportError('Import failed. Please try again.')
      }
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async (choiceId: number) => {
    try {
      await apiClient.deleteChoice(choiceId)
      setChoices(prev => prev.filter(c => c.id !== choiceId))
    } catch {
      // silently ignore
    }
  }

  // ---- column management ----

  const handleConfirmAddColumn = async () => {
    const name = newColumnName.trim()
    setAddingColumn(false)
    setNewColumnName('')
    if (!name || !id) return
    setColumnError(null)
    try {
      const res = await apiClient.addColumn(id, name)
      setColumns(prev => [...prev, res.data])
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data
        setColumnError(data.error || data.detail || JSON.stringify(data))
      } else {
        setColumnError('Failed to add column.')
      }
    }
  }

  const handleCommitColumnEdit = async () => {
    if (!columnEdit || !id) { setColumnEdit(null); return }
    const name = columnEdit.draft.trim()
    const col = columns.find(c => c.id === columnEdit.id)
    setColumnEdit(null)
    if (!name || !col || name === col.name) return
    setColumnError(null)
    try {
      const res = await apiClient.updateColumn(id, columnEdit.id, name)
      setColumns(prev => prev.map(c => c.id === columnEdit.id ? res.data : c))
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data
        setColumnError(data.error || data.detail || JSON.stringify(data))
      } else {
        setColumnError('Failed to rename column.')
      }
    }
  }

  const handleDeleteColumn = async (columnId: number) => {
    if (!id) return
    if (!window.confirm('Delete this column? All values stored in it will be lost.')) return
    setColumnError(null)
    try {
      await apiClient.removeColumn(id, columnId)
      setColumns(prev => prev.filter(c => c.id !== columnId))
      setChoices(prev => prev.map(c => ({ ...c, extra_values: c.extra_values.filter(ev => ev.column !== columnId) })))
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data
        setColumnError(data.error || data.detail || JSON.stringify(data))
      } else {
        setColumnError('Failed to delete column.')
      }
    }
  }

  const handleCommitLabelColumnEdit = async () => {
    const draft = labelColumnEdit?.trim() ?? ''
    setLabelColumnEdit(null)
    if (!draft || draft === labelColumnName || !id) return
    setLabelColumnError(null)
    try {
      await apiClient.updateChoiceList(id, { label_column_name: draft })
      setLabelColumnName(draft)
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data
        setLabelColumnError(data.error || data.detail || JSON.stringify(data))
      } else {
        setLabelColumnError('Failed to rename label column.')
      }
    }
  }

  if (loading && !choiceList) {
    return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
  }
  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
  }
  if (!choiceList) return null

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link to="/" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
          ← Choice Lists
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{choiceList.name}</h1>
            {choiceList.description && (
              <p className="text-gray-500 mt-1 text-sm">{choiceList.description}</p>
            )}
          </div>
          <div className="flex gap-2 items-center shrink-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono bg-indigo-50 text-indigo-700 border border-indigo-100">
              {choiceList.project_slug}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono bg-gray-100 text-gray-600 border border-gray-200">
              {choiceList.slug}
            </span>
            <a
              href={`/api/choice-lists/${choiceList.id}/export/`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              ↓ CSV
            </a>
            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              importing
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}>
              {importing ? 'Importing…' : '↑ Import CSV'}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={importing}
                onChange={handleImport}
              />
            </label>
          </div>
        </div>
      </div>

      {/* KoboToolbox integration */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-5">
        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-3">KoboToolbox Integration</p>
        <div className="space-y-2 text-sm">
          {([
            { method: 'GET',  bg: 'bg-emerald-100', fg: 'text-emerald-700', path: `/${choiceList.project_slug}/${choiceList.slug}.csv`,    note: null },
            { method: 'POST', bg: 'bg-blue-100',    fg: 'text-blue-700',    path: `/${choiceList.project_slug}/${choiceList.slug}/add`,    note: null },
            { method: 'POST', bg: 'bg-orange-100',  fg: 'text-orange-700',  path: `/${choiceList.project_slug}/${choiceList.slug}/remove`, note: 'soft delete (sets removed=true)' },
            { method: 'POST', bg: 'bg-red-100',     fg: 'text-red-700',     path: `/${choiceList.project_slug}/${choiceList.slug}/delete`, note: 'hard delete' },
          ] as const).map(({ method, bg, fg, path, note }) => (
            <div key={path} className="flex items-center gap-2">
              <span className={`${bg} ${fg} px-2 py-0.5 rounded text-xs font-medium w-12 text-center shrink-0`}>{method}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + path)
                  setCopiedPath(path)
                  setTimeout(() => setCopiedPath(p => p === path ? null : p), 1500)
                }}
                title="Click to copy"
                className="font-mono text-indigo-800 text-xs break-all text-left hover:text-indigo-600 hover:underline cursor-pointer bg-transparent border-none p-0"
              >
                {copiedPath === path ? (
                  <span className="text-emerald-600 font-medium">✓ Copied!</span>
                ) : path}
              </button>
              {note && <span className="text-indigo-400 text-xs shrink-0">{note}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Name generation settings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Name generation</p>
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="nameGeneration"
                value="uuid"
                checked={nameGeneration === 'uuid'}
                onChange={() => setNameGeneration('uuid')}
                className="accent-indigo-600"
              />
              <span className="text-sm text-gray-700">Random ID</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="nameGeneration"
                value="from_label"
                checked={nameGeneration === 'from_label'}
                onChange={() => setNameGeneration('from_label')}
                className="accent-indigo-600"
              />
              <span className="text-sm text-gray-700">Derived from label</span>
            </label>
          </div>
          {nameGeneration === 'from_label' && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Max length</label>
              <input
                type="number"
                min={0}
                value={nameMaxLength}
                onChange={e => setNameMaxLength(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="border border-gray-300 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-400">(0 = no limit)</span>
            </div>
          )}
          <button
            onClick={handleSaveNameSettings}
            disabled={nameSettingsSaving}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {nameSettingsSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {nameGeneration === 'from_label' && (
          <p className="mt-2 text-xs text-gray-400">
            Names are lowercased, spaces become underscores, and non-latin/digit characters are removed. Duplicates get a numeric suffix (_2, _3, …).
          </p>
        )}
        {nameSettingsError && (
          <p className="mt-2 text-red-600 text-sm">{nameSettingsError}</p>
        )}
      </div>

      {/* Choices table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-gray-800">
              Choices
              <span className="ml-2 text-gray-400 font-normal text-sm">({choices.length})</span>
            </h2>
            {addingColumn ? (
              <input
                autoFocus
                placeholder="Column name…"
                value={newColumnName}
                onChange={e => setNewColumnName(e.target.value)}
                onBlur={handleConfirmAddColumn}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleConfirmAddColumn()
                  if (e.key === 'Escape') { setAddingColumn(false); setNewColumnName('') }
                }}
                className="border border-indigo-300 rounded-lg px-2.5 py-1 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="text-xs text-indigo-500 hover:text-indigo-700 border border-dashed border-indigo-300 rounded-lg px-2.5 py-1 whitespace-nowrap transition-colors"
              >
                + column
              </button>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              disabled={refreshing}
              onClick={async () => { setRefreshing(true); try { await refetch() } finally { setRefreshing(false) } }}
              title="Refresh choices"
              className="px-2.5 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              {refreshing ? 'Refreshing…' : '↻ Refresh'}
            </button>
          <form onSubmit={handleAddChoice} className="flex gap-2">
            <input
              type="text"
              placeholder="Enter label…"
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
            />
            <button
              type="submit"
              disabled={adding || !label.trim()}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
          </form>

          </div>
        </div>

        {addError && (
          <p className="px-5 py-2 text-red-600 text-sm bg-red-50 border-b border-red-100">{addError}</p>
        )}
        {importError && (
          <p className="px-5 py-2 text-red-600 text-sm bg-red-50 border-b border-red-100">Import failed: {importError}</p>
        )}
        {(columnError || labelColumnError) && (
          <p className="px-5 py-2 text-red-600 text-sm bg-red-50 border-b border-red-100">{columnError || labelColumnError}</p>
        )}

        {choices.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No choices yet — add one above
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-3 w-8"></th>
                  <th className="px-5 py-3 text-left">
                    <div className="flex items-center gap-1 group">
                      {labelColumnEdit !== null ? (
                        <input
                          autoFocus
                          value={labelColumnEdit}
                          onChange={e => setLabelColumnEdit(e.target.value)}
                          onBlur={handleCommitLabelColumnEdit}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCommitLabelColumnEdit()
                            if (e.key === 'Escape') setLabelColumnEdit(null)
                          }}
                          className="border border-indigo-300 rounded px-2 py-0.5 text-sm w-40 focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => handleSortClick('label')}
                          className="flex items-center gap-1 font-semibold text-gray-600 hover:text-indigo-700 transition-colors"
                        >
                          {labelColumnName}
                          <span className="text-xs w-4 text-center">
                            {sortCol === 'label' ? (sortDir === 'asc' ? '↑' : '↓ ×') : <span className="text-gray-300">↕</span>}
                          </span>
                        </button>
                      )}
                      {labelColumnEdit === null && (
                        <button
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 text-xs ml-1 transition-opacity leading-none"
                          title="Rename label column (e.g. label::English (en))"
                          onClick={() => setLabelColumnEdit(labelColumnName)}
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="px-5 py-3 text-left">
                    <button
                      onClick={() => handleSortClick('value')}
                      className="flex items-center gap-1 font-semibold text-gray-600 hover:text-indigo-700 transition-colors"
                    >
                      name
                      <span className="text-xs w-4 text-center">
                        {sortCol === 'value' ? (sortDir === 'asc' ? '↑' : '↓ ×') : <span className="text-gray-300">↕</span>}
                      </span>
                    </button>
                  </th>
                  {/* Extra column headers */}
                  {columns.map(col => {
                    const isSystem = col.name === 'protected' || col.name === 'removed'
                    return (
                    <th key={col.id} className="px-5 py-3 text-left min-w-[8rem]">
                      <div className="flex items-center gap-1 group">
                        {!isSystem && columnEdit?.id === col.id ? (
                          <input
                            autoFocus
                            value={columnEdit.draft}
                            onChange={e => setColumnEdit({ id: col.id, draft: e.target.value })}
                            onBlur={handleCommitColumnEdit}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleCommitColumnEdit()
                              if (e.key === 'Escape') setColumnEdit(null)
                            }}
                            className="border border-indigo-300 rounded px-2 py-0.5 text-sm w-28 focus:outline-none"
                          />
                        ) : (
                          <span
                            className={`font-semibold text-gray-600 transition-colors ${
                              isSystem
                                ? 'cursor-default text-indigo-700'
                                : 'cursor-pointer hover:text-indigo-700'
                            }`}
                            title={isSystem ? `System column (${col.name})` : 'Click to rename'}
                            onClick={() => !isSystem && setColumnEdit({ id: col.id, draft: col.name })}
                          >
                            {col.name === 'protected' ? '🔒 ' : col.name === 'removed' ? '🗑 ' : col.name === 'pin' ? '📌 ' : ''}{col.name}
                          </span>
                        )}
                        {!isSystem && (
                          <button
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs ml-1 transition-opacity leading-none"
                            title="Delete column"
                            onClick={() => handleDeleteColumn(col.id)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </th>
                    )
                  })}
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Order</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <SortableContext items={choices.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {choices.map(choice => (
                    <SortableChoiceRow
                      key={choice.id}
                      choice={choice}
                      columns={columns}
                      onDelete={handleDelete}
                      onSave={handleSaveField}
                      onSaveExtra={handleSaveExtra}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
            </div>
          </DndContext>
        )}
      </div>
    </div>
  )
}

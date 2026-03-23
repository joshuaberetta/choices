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
import apiClient, { type Choice } from '../services/api'

function SortableChoiceRow({
  choice,
  onDelete,
  onSave,
}: {
  choice: Choice
  onDelete: (id: number) => void
  onSave: (id: number, field: 'label' | 'value', value: string) => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: choice.id })
  const [edit, setEdit] = useState<{ field: 'label' | 'value'; draft: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const startEdit = (field: 'label' | 'value') => {
    setEdit({ field, draft: field === 'label' ? choice.label : choice.value })
  }

  const commitEdit = async () => {
    if (!edit) return
    const current = edit.field === 'label' ? choice.label : choice.value
    if (edit.draft === current || !edit.draft.trim()) {
      setEdit(null)
      return
    }
    setSaving(true)
    try {
      await onSave(choice.id, edit.field, edit.draft.trim())
    } finally {
      setSaving(false)
      setEdit(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEdit(null)
  }

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-gray-50 last:border-b-0 bg-white hover:bg-gray-50 transition-colors">
      <td className="px-3 py-3 text-gray-300 w-8">
        <span
          className="cursor-grab active:cursor-grabbing select-none text-lg leading-none"
          {...attributes}
          {...listeners}
        >
          ⠿
        </span>
      </td>
      <td className="px-5 py-3">
        {edit?.field === 'label' ? (
          <input
            autoFocus
            value={edit.draft}
            onChange={e => setEdit({ ...edit, draft: e.target.value })}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="border border-indigo-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
          />
        ) : (
          <span
            className="cursor-pointer text-gray-900 hover:text-indigo-700 underline decoration-dotted underline-offset-2"
            title="Click to edit label"
            onClick={() => startEdit('label')}
          >
            {choice.label}
          </span>
        )}
      </td>
      <td className="px-5 py-3">
        {edit?.field === 'value' ? (
          <input
            autoFocus
            value={edit.draft}
            onChange={e => setEdit({ ...edit, draft: e.target.value })}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="font-mono text-xs border border-indigo-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32"
          />
        ) : (
          <code
            className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            title="Click to edit value"
            onClick={() => startEdit('value')}
          >
            {choice.value}
          </code>
        )}
      </td>
      <td className="px-5 py-3 text-gray-400">{choice.order}</td>
      <td className="px-5 py-3 text-right">
        <button
          onClick={() => onDelete(choice.id)}
          className="px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          Delete
        </button>
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
  const [sortCol, setSortCol] = useState<'label' | 'value' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    if (choiceList?.choices) {
      setChoices([...choiceList.choices].sort((a, b) => a.order - b.order))
    }
  }, [choiceList])

  const sensors = useSensors(useSensor(PointerSensor))

  const handleSortClick = async (col: 'label' | 'value') => {
    // Cycle: unsorted → asc → desc → unsorted (drag re-enabled)
    if (sortCol === col && sortDir === 'desc') {
      setSortCol(null)
      return
    }
    const newDir: 'asc' | 'desc' = sortCol === col ? 'desc' : 'asc'
    setSortCol(col)
    setSortDir(newDir)

    const sorted = [...choices]
      .sort((a, b) =>
        a[col].localeCompare(b[col], undefined, { numeric: true, sensitivity: 'base' }) *
        (newDir === 'asc' ? 1 : -1)
      )
      .map((c, i) => ({ ...c, order: i }))

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

  const handleDelete = async (choiceId: number) => {
    try {
      await apiClient.deleteChoice(choiceId)
      setChoices(prev => prev.filter(c => c.id !== choiceId))
    } catch {
      // silently ignore
    }
  }

  if (loading) {
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
          </div>
        </div>
      </div>

      {/* KoboToolbox integration */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-5">
        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-3">KoboToolbox Integration</p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-medium w-12 text-center shrink-0">GET</span>
            <code className="font-mono text-indigo-800 text-xs break-all">/{choiceList.project_slug}/{choiceList.slug}.csv</code>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium w-12 text-center shrink-0">POST</span>
            <code className="font-mono text-indigo-800 text-xs break-all">/{choiceList.project_slug}/{choiceList.slug}/add</code>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-medium w-12 text-center shrink-0">POST</span>
            <code className="font-mono text-indigo-800 text-xs break-all">/{choiceList.project_slug}/{choiceList.slug}/remove</code>
          </div>
        </div>
      </div>

      {/* Choices table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">
            Choices
            <span className="ml-2 text-gray-400 font-normal text-sm">({choices.length})</span>
          </h2>
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

        {addError && (
          <p className="px-5 py-2 text-red-600 text-sm bg-red-50 border-b border-red-100">{addError}</p>
        )}

        {choices.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No choices yet — add one above
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-3 w-8"></th>
                  <th className="px-5 py-3 text-left">
                    <button
                      onClick={() => handleSortClick('label')}
                      className="flex items-center gap-1 font-semibold text-gray-600 hover:text-indigo-700 transition-colors"
                    >
                      Label
                      <span className="text-xs w-4 text-center">
                        {sortCol === 'label' ? (sortDir === 'asc' ? '↑' : '↓ ×') : <span className="text-gray-300">↕</span>}
                      </span>
                    </button>
                  </th>
                  <th className="px-5 py-3 text-left">
                    <button
                      onClick={() => handleSortClick('value')}
                      className="flex items-center gap-1 font-semibold text-gray-600 hover:text-indigo-700 transition-colors"
                    >
                      Value (ID)
                      <span className="text-xs w-4 text-center">
                        {sortCol === 'value' ? (sortDir === 'asc' ? '↑' : '↓ ×') : <span className="text-gray-300">↕</span>}
                      </span>
                    </button>
                  </th>
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
                      onDelete={handleDelete}
                      onSave={handleSaveField}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        )}
      </div>
    </div>
  )
}

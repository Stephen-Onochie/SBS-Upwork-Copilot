import React, { useEffect, useState } from 'react'
import type { Template, TemplateBlock, TemplateBlockType } from '@/lib/types'
import { generateId } from '@/lib/utils'

function newBlock(type: TemplateBlockType): TemplateBlock {
  return {
    id: generateId(),
    type,
    prompt: type === 'ai' ? 'Write a professional cover letter section based on the job post and profile.' : undefined,
    text: type === 'static' ? '' : undefined,
    numProjects: type === 'dynamic_projects' ? 3 : undefined,
  }
}

export function Templates(): React.ReactElement {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(['templates'], (result) => {
      const t = (result.templates as Template[] | undefined) ?? []
      setTemplates(t)
      if (t.length > 0) setSelectedId(t[0].id)
    })
  }, [])

  function save(updated: Template[]): void {
    chrome.storage.local.set({ templates: updated }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
    setTemplates(updated)
  }

  function addTemplate(): void {
    const t: Template = {
      id: generateId(),
      name: 'New Template',
      isDefault: templates.length === 0,
      blocks: [newBlock('ai')],
    }
    const updated = [...templates, t]
    save(updated)
    setSelectedId(t.id)
  }

  function deleteTemplate(id: string): void {
    const updated = templates.filter((t) => t.id !== id)
    if (updated.length > 0 && !updated.find((t) => t.isDefault)) {
      updated[0].isDefault = true
    }
    save(updated)
    setSelectedId(updated[0]?.id ?? null)
  }

  function setDefault(id: string): void {
    save(templates.map((t) => ({ ...t, isDefault: t.id === id })))
  }

  function updateTemplate(id: string, changes: Partial<Template>): void {
    save(templates.map((t) => (t.id === id ? { ...t, ...changes } : t)))
  }

  function addBlock(templateId: string, type: TemplateBlockType): void {
    const t = templates.find((t) => t.id === templateId)
    if (!t) return
    updateTemplate(templateId, { blocks: [...t.blocks, newBlock(type)] })
  }

  function removeBlock(templateId: string, blockId: string): void {
    const t = templates.find((t) => t.id === templateId)
    if (!t) return
    updateTemplate(templateId, { blocks: t.blocks.filter((b) => b.id !== blockId) })
  }

  function updateBlock(templateId: string, blockId: string, changes: Partial<TemplateBlock>): void {
    const t = templates.find((t) => t.id === templateId)
    if (!t) return
    updateTemplate(templateId, {
      blocks: t.blocks.map((b) => (b.id === blockId ? { ...b, ...changes } : b)),
    })
  }

  function moveBlock(templateId: string, blockId: string, dir: 'up' | 'down'): void {
    const t = templates.find((t) => t.id === templateId)
    if (!t) return
    const idx = t.blocks.findIndex((b) => b.id === blockId)
    if (idx < 0) return
    const newIdx = dir === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= t.blocks.length) return
    const blocks = [...t.blocks]
    ;[blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]]
    updateTemplate(templateId, { blocks })
  }

  const selected = templates.find((t) => t.id === selectedId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Templates</h2>
        <button onClick={addTemplate}
          className="px-4 py-1.5 bg-upwork-green text-white text-sm font-medium rounded-lg hover:opacity-90">
          + New Template
        </button>
      </div>

      {saved && <div className="text-sm text-green-600 font-semibold">✅ Saved!</div>}

      <div className="flex gap-6">
        {/* Template list */}
        <div className="w-44 flex-shrink-0 space-y-1">
          {templates.map((t) => (
            <div key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`px-3 py-2 rounded-lg cursor-pointer text-sm flex items-center justify-between ${
                t.id === selectedId ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              <span className="truncate">{t.name}</span>
              {t.isDefault && <span className="text-xs text-green-500 ml-1">★</span>}
            </div>
          ))}
        </div>

        {/* Template editor */}
        {selected && (
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <input
                value={selected.name}
                onChange={(e) => updateTemplate(selected.id, { name: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold flex-1"
              />
              {!selected.isDefault && (
                <button onClick={() => setDefault(selected.id)}
                  className="text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-2 py-1">
                  Set as Default
                </button>
              )}
              <button onClick={() => deleteTemplate(selected.id)}
                className="text-xs text-red-500 hover:underline">Delete</button>
            </div>

            {/* Blocks */}
            <div className="space-y-3">
              {selected.blocks.map((block, idx) => (
                <div key={block.id} className="border border-gray-200 rounded-xl p-4 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      {block.type === 'ai' ? '🤖 AI Block' : block.type === 'static' ? '📝 Static' : '📂 Dynamic Projects'}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => moveBlock(selected.id, block.id, 'up')} disabled={idx === 0}
                        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30">↑</button>
                      <button onClick={() => moveBlock(selected.id, block.id, 'down')} disabled={idx === selected.blocks.length - 1}
                        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30">↓</button>
                      <button onClick={() => removeBlock(selected.id, block.id)}
                        className="text-xs text-red-400 hover:text-red-600">✕</button>
                    </div>
                  </div>
                  {block.type === 'ai' && (
                    <textarea
                      value={block.prompt ?? ''}
                      onChange={(e) => updateBlock(selected.id, block.id, { prompt: e.target.value })}
                      rows={3}
                      placeholder="Write prompt instructions for this AI section..."
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-none"
                    />
                  )}
                  {block.type === 'static' && (
                    <textarea
                      value={block.text ?? ''}
                      onChange={(e) => updateBlock(selected.id, block.id, { text: e.target.value })}
                      rows={4}
                      placeholder="Static text that appears verbatim in every proposal..."
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-none"
                    />
                  )}
                  {block.type === 'dynamic_projects' && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-600">Number of projects to include:</label>
                      <input type="number" min={1} max={10} value={block.numProjects ?? 3}
                        onChange={(e) => updateBlock(selected.id, block.id, { numProjects: parseInt(e.target.value) })}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-16" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add block */}
            <div className="flex gap-2">
              <span className="text-xs text-gray-500 self-center">Add block:</span>
              {(['ai', 'static', 'dynamic_projects'] as TemplateBlockType[]).map((type) => (
                <button key={type} onClick={() => addBlock(selected.id, type)}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">
                  + {type === 'ai' ? 'AI' : type === 'static' ? 'Static' : 'Projects'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

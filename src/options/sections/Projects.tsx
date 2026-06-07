import React, { useEffect, useState } from 'react'
import type { Project } from '@/lib/types'
import { generateId } from '@/lib/utils'

const EMPTY_PROJECT = (): Project => ({
  id: generateId(),
  name: '',
  description: '',
  tools: [],
  url: '',
  relevanceTags: [],
})

export function Projects(): React.ReactElement {
  const [projects, setProjects] = useState<Project[]>([])
  const [editing, setEditing] = useState<Project | null>(null)
  const [toolsInput, setToolsInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(['projects'], (result) => {
      setProjects((result.projects as Project[] | undefined) ?? [])
    })
  }, [])

  function save(updated: Project[]): void {
    chrome.storage.local.set({ projects: updated }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
    setProjects(updated)
  }

  function startEdit(project: Project): void {
    setEditing({ ...project })
    setToolsInput(project.tools.join(', '))
    setTagsInput(project.relevanceTags.join(', '))
  }

  function startNew(): void {
    const p = EMPTY_PROJECT()
    setEditing(p)
    setToolsInput('')
    setTagsInput('')
  }

  function saveEdit(): void {
    if (!editing) return
    const finalProject: Project = {
      ...editing,
      tools: toolsInput.split(',').map((t) => t.trim()).filter(Boolean),
      relevanceTags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
    }
    const exists = projects.find((p) => p.id === finalProject.id)
    const updated = exists
      ? projects.map((p) => (p.id === finalProject.id ? finalProject : p))
      : [...projects, finalProject]
    save(updated)
    setEditing(null)
  }

  function deleteProject(id: string): void {
    save(projects.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Projects ({projects.length})</h2>
        <button onClick={startNew}
          className="px-4 py-1.5 bg-upwork-green text-white text-sm font-medium rounded-lg hover:opacity-90">
          + Add Project
        </button>
      </div>

      {saved && <div className="text-sm text-green-600 font-semibold">✅ Saved!</div>}

      {/* Edit form */}
      {editing && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">
            {projects.find((p) => p.id === editing.id) ? 'Edit Project' : 'New Project'}
          </h3>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Name *</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Description</label>
            <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              rows={3} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tools (comma-separated)</label>
              <input value={toolsInput} onChange={(e) => setToolsInput(e.target.value)}
                placeholder="React, TypeScript, Node.js"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Relevance Tags (comma-separated)</label>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e-commerce, saas, dashboard"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">URL</label>
            <input type="url" value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveEdit}
              className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg">
              Save
            </button>
            <button onClick={() => setEditing(null)}
              className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Project list */}
      <div className="space-y-3">
        {projects.length === 0 && !editing && (
          <p className="text-sm text-gray-400">No projects yet. Add projects to improve proposal generation.</p>
        )}
        {projects.map((project) => (
          <div key={project.id} className="border border-gray-200 bg-white rounded-xl p-4 flex justify-between items-start">
            <div className="space-y-1">
              <p className="font-semibold text-sm text-gray-900">{project.name}</p>
              <p className="text-xs text-gray-500 line-clamp-2">{project.description}</p>
              {project.tools.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {project.tools.map((t, i) => (
                    <span key={i} className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              )}
              {project.url && (
                <a href={project.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                  {project.url}
                </a>
              )}
            </div>
            <div className="flex gap-2 ml-4 flex-shrink-0">
              <button onClick={() => startEdit(project)}
                className="text-xs text-blue-600 hover:underline">Edit</button>
              <button onClick={() => deleteProject(project.id)}
                className="text-xs text-red-500 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useState } from 'react'
import WeatherWidget from './WeatherWidget'

export default function Header({ me, onUpdateName }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(me.friendly_name || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onUpdateName(name.trim())
      setEditing(false)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <header className="bg-white border-b shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-orange-500">LunchTool</span>
          <WeatherWidget />
        </div>

        <div className="flex items-center gap-3">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Your display name"
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="text-sm font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="text-right">
              {me.friendly_name ? (
                <div className="text-sm font-semibold text-gray-900">{me.friendly_name}</div>
              ) : (
                <div className="text-sm text-gray-400 italic">No display name set</div>
              )}
              <div className="text-xs text-gray-500">{me.email}</div>
            </div>
          )}

          <button
            onClick={() => {
              setName(me.friendly_name || '')
              setEditing(!editing)
            }}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            title="Edit display name"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}

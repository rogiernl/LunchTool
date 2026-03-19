import { useState } from 'react'
import { api } from '../api'

function displayName(user) {
  return user.friendly_name || user.email
}

function PlaceForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [hasOrderAhead, setHasOrderAhead] = useState(initial?.has_order_ahead || false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), description: description.trim() || null, has_order_ahead: hasOrderAhead })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-sm">{error}</div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. De Lunchroom"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          required
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Sandwiches & soups, 5 min walk"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={hasOrderAhead}
          onChange={(e) => setHasOrderAhead(e.target.checked)}
          className="w-4 h-4 rounded accent-orange-500"
        />
        <span className="text-sm text-gray-700">Requires ordering ahead</span>
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? 'Saving...' : initial ? 'Save changes' : 'Add place'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function PlacesView({ places, me, onRefresh }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState(null)

  const handleAdd = async (data) => {
    await api.createPlace(data)
    setShowAddForm(false)
    await onRefresh()
  }

  const handleEdit = async (id, data) => {
    await api.updatePlace(id, data)
    setEditingId(null)
    await onRefresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this lunch place?')) return
    setError(null)
    try {
      await api.deletePlace(id)
      await onRefresh()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Lunch Places</h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="py-2 px-4 bg-orange-500 text-white text-sm rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            + Add place
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New lunch place</h3>
          <PlaceForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {/* Places list */}
      {places.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          No lunch places yet. Add the first one!
        </div>
      ) : (
        <div className="space-y-3">
          {places.map((place) => {
            const isOwner = place.added_by?.id === me.id

            return (
              <div key={place.id} className="bg-white rounded-lg shadow p-4">
                {editingId === place.id ? (
                  <PlaceForm
                    initial={place}
                    onSave={(data) => handleEdit(place.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{place.name}</span>
                        {place.has_order_ahead && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            Order ahead
                          </span>
                        )}
                      </div>
                      {place.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{place.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Added by {displayName(place.added_by)}
                      </p>
                    </div>

                    {isOwner && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditingId(place.id)}
                          className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(place.id)}
                          className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
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

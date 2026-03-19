import { useState, useEffect, useRef } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { api } from '../api'

function displayName(user) {
  return user.friendly_name || user.email
}

export function StarRating({ rating }) {
  if (rating == null) return null
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400 text-sm" title={`${rating} / 5`}>
      {'★'.repeat(full)}
      {half ? '½' : ''}
      <span className="text-gray-300">{'★'.repeat(empty)}</span>
      <span className="text-gray-500 text-xs ml-1">{rating.toFixed(1)}</span>
    </span>
  )
}

// Singleton loader — created once when API key is known
let _loader = null
function getLoader(apiKey) {
  if (!_loader && apiKey) {
    _loader = new Loader({ apiKey, version: 'weekly' })
  }
  return _loader
}

function PlaceForm({ initial, onSave, onCancel, googleMapsApiKey }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [address, setAddress] = useState(initial?.address || '')
  const [googleRating, setGoogleRating] = useState(initial?.google_rating ?? null)
  const [hasOrderAhead, setHasOrderAhead] = useState(initial?.has_order_ahead || false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const loader = getLoader(googleMapsApiKey)
    if (!loader || !containerRef.current) return

    let mounted = true
    let el = null

    loader.importLibrary('places').then(({ PlaceAutocompleteElement }) => {
      if (!mounted || !containerRef.current) return

      el = new PlaceAutocompleteElement({ types: ['establishment'] })
      el.style.cssText = 'width:100%;font-size:0.875rem;'
      containerRef.current.appendChild(el)

      el.addEventListener('gmp-placeselect', async (event) => {
        const { place } = event
        // place.id is always available; fetch full details server-side
        try {
          const details = await api.getPlaceDetails(place.id)
          if (details.name) setName((prev) => prev || details.name)
          if (details.address) setAddress(details.address)
          if (details.rating != null) setGoogleRating(details.rating)
        } catch (err) {
          // Fallback: use displayName from the autocomplete element itself
          console.warn('Place details error:', err)
          if (place.displayName) setName((prev) => prev || place.displayName)
        }
        document.getElementById('place-name-input')?.focus()
      })
    })

    return () => {
      mounted = false
      if (el && containerRef.current?.contains(el)) {
        containerRef.current.removeChild(el)
      }
    }
  }, [googleMapsApiKey])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        google_rating: googleRating,
        has_order_ahead: hasOrderAhead,
      })
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

      {googleMapsApiKey && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search for a business</label>
          <div ref={containerRef} className="w-full" />
          <p className="text-xs text-gray-400 mt-1">Select a result to auto-fill name, address and rating</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          id="place-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. De Lunchroom"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          required
          autoFocus={!googleMapsApiKey && !initial}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. Kalverstraat 12, Amsterdam"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {googleRating != null && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Google rating:</span>
          <StarRating rating={googleRating} />
        </div>
      )}

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

export default function PlacesView({ places, me, onRefresh, googleMapsApiKey }) {
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

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New lunch place</h3>
          <PlaceForm
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
            googleMapsApiKey={googleMapsApiKey}
          />
        </div>
      )}

      {places.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          No lunch places yet. Add the first one!
        </div>
      ) : (
        <div className="space-y-3">
          {places.map((place) => (
            <div key={place.id} className="bg-white rounded-lg shadow p-4">
              {editingId === place.id ? (
                <PlaceForm
                  initial={place}
                  onSave={(data) => handleEdit(place.id, data)}
                  onCancel={() => setEditingId(null)}
                  googleMapsApiKey={googleMapsApiKey}
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
                      <StarRating rating={place.google_rating} />
                    </div>
                    {place.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{place.description}</p>
                    )}
                    {place.address && (
                      <p className="text-sm text-gray-400 mt-0.5">{place.address}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Added by {displayName(place.added_by)}
                    </p>
                  </div>

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
                    {place.added_by?.id === me.id && (
                      <button
                        onClick={() => handleDelete(place.id)}
                        className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

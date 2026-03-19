import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import MapView from './MapView'

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

function BusinessSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(timerRef.current)
    if (val.length < 2) { setSuggestions([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await api.autocomplete(val)
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch (e) {
        console.error('Autocomplete error:', e)
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  const handleSelect = (s) => {
    setQuery(s.main_text)
    setOpen(false)
    setSuggestions([])
    onSelect(s.place_id, s.main_text)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Type a restaurant or café name…"
          className="w-full border-2 border-orange-300 rounded-lg pl-9 pr-9 py-2 text-sm bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white placeholder-orange-300"
          autoFocus
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        )}
        {query && !loading && (
          <button
            type="button"
            onClick={() => { setQuery(''); setSuggestions([]); setOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s.place_id}
              onMouseDown={() => handleSelect(s)}
              className="px-4 py-3 cursor-pointer hover:bg-orange-50 border-b border-gray-100 last:border-0"
            >
              <div className="text-sm font-semibold text-gray-900">{s.main_text}</div>
              {s.secondary_text && (
                <div className="text-xs text-gray-500 mt-0.5">{s.secondary_text}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PlaceForm({ initial, onSave, onCancel, hasGoogleMaps }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [address, setAddress] = useState(initial?.address || '')
  const [googleRating, setGoogleRating] = useState(initial?.google_rating ?? null)
  const [hasOrderAhead, setHasOrderAhead] = useState(initial?.has_order_ahead || false)
  const [loading, setLoading] = useState(false)
  const [fetchingDetails, setFetchingDetails] = useState(false)
  const [error, setError] = useState(null)

  const handleBusinessSelect = async (placeId, nameHint) => {
    setFetchingDetails(true)
    try {
      const details = await api.getPlaceDetails(placeId)
      setName(details.name || nameHint || '')
      setAddress(details.address || '')
      if (details.rating != null) setGoogleRating(details.rating)
    } catch (err) {
      console.error('Place details error:', err)
      setName((prev) => prev || nameHint)
    } finally {
      setFetchingDetails(false)
    }
  }

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

      {hasGoogleMaps && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search for a business
          </label>
          <BusinessSearch onSelect={handleBusinessSelect} />
          {fetchingDetails && (
            <p className="text-xs text-orange-500 mt-1">Fetching details…</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Selecting a result fills in name, address and Google rating below
          </p>
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
          autoFocus={!hasGoogleMaps && !initial}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. Oudegracht 12, Utrecht"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {googleRating != null && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-amber-50 rounded-lg px-3 py-2">
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
          disabled={loading || fetchingDetails || !name.trim()}
          className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? 'Saving…' : initial ? 'Save changes' : 'Add place'}
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

export default function PlacesView({ places, me, onRefresh, config }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [error, setError] = useState(null)
  const googleMapsApiKey = config?.google_maps_api_key

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
        <div className="flex items-center gap-2">
          {googleMapsApiKey && places.some((p) => p.lat) && (
            <button
              onClick={() => setShowMap((v) => !v)}
              className={`py-2 px-4 text-sm rounded-lg font-medium transition-colors border ${
                showMap
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {showMap ? 'Hide map' : 'Show map'}
            </button>
          )}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="py-2 px-4 bg-orange-500 text-white text-sm rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              + Add place
            </button>
          )}
        </div>
      </div>

      {showMap && <MapView places={places} config={config} />}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
      )}

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New lunch place</h3>
          <PlaceForm
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
            hasGoogleMaps={!!googleMapsApiKey}
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
                  hasGoogleMaps={!!googleMapsApiKey}
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
                      {place.walking_minutes != null && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>
                            <path d="M9 12l2-4 3 3-1 5"/>
                            <path d="M7 17l2-2M14 10l2 2-1 5"/>
                          </svg>
                          {place.walking_minutes} min
                        </span>
                      )}
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

import { useState, useEffect } from 'react'
import { api } from '../api'
import { StarRating } from './PlacesView'

function displayName(user) {
  return user?.friendly_name || user?.email || '?'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('nl-NL', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  })
}

function OrderRow({ order, sessionId, me, onRefresh }) {
  const isOwn = order.user.id === me.id
  const [loading, setLoading] = useState(false)

  const handlePaid = async () => {
    setLoading(true)
    try {
      await api.markPaidInSession(sessionId, order.id)
      await onRefresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <div>
        <span className="text-sm font-medium text-gray-800">{displayName(order.user)}</span>
        {order.item_description && (
          <span className="text-sm text-gray-500 ml-2">{order.item_description}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {order.amount != null && (
          <span className="text-sm text-gray-600">€{order.amount.toFixed(2)}</span>
        )}
        {order.is_paid ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Paid</span>
        ) : isOwn ? (
          <button
            onClick={handlePaid}
            disabled={loading}
            className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full hover:bg-orange-200 disabled:opacity-50"
          >
            {loading ? '…' : 'Mark paid'}
          </button>
        ) : (
          <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Unpaid</span>
        )}
      </div>
    </div>
  )
}

function SessionCard({ session, places, me, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const myOrder = session.orders.find((o) => o.user.id === me.id)

  const handleAddOrder = async (e) => {
    e.preventDefault()
    if (!item.trim()) return
    setLoading(true)
    setError(null)
    try {
      await api.addOrderToSession(session.id, item.trim(), amount ? parseFloat(amount) : null)
      setShowOrderForm(false)
      setItem('')
      setAmount('')
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const total = session.orders.reduce((s, o) => s + (o.amount || 0), 0)

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-gray-900 shrink-0">{formatDate(session.date)}</span>
          {session.selected_place && (
            <span className="text-sm text-gray-500 truncate">{session.selected_place.name}</span>
          )}
          {session.selected_place?.google_rating != null && (
            <StarRating rating={session.selected_place.google_rating} />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {session.orders.length > 0 && (
            <span className="text-xs text-gray-400">{session.orders.length} order{session.orders.length !== 1 ? 's' : ''}</span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-100 space-y-3 pt-3">
          {session.selected_place && (
            <div className="text-sm text-gray-600 space-y-0.5">
              {session.selected_place.address && (
                <div className="text-gray-400 text-xs">{session.selected_place.address}</div>
              )}
              {session.pickup_location && (
                <div>Pickup: <span className="font-medium">{session.pickup_location}</span>
                  {session.pickup_time && <span className="text-gray-400 ml-1">at {session.pickup_time}</span>}
                </div>
              )}
              {session.host && (
                <div>Host: <span className="font-medium">{displayName(session.host)}</span></div>
              )}
            </div>
          )}

          {session.orders.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Orders</div>
              {session.orders.map((o) => (
                <OrderRow key={o.id} order={o} sessionId={session.id} me={me} onRefresh={onRefresh} />
              ))}
              {total > 0 && (
                <div className="text-right text-sm font-medium text-gray-700 mt-2">
                  Total: €{total.toFixed(2)}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-sm">{error}</div>
          )}

          {showOrderForm ? (
            <form onSubmit={handleAddOrder} className="space-y-2 pt-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  placeholder={myOrder ? 'Update your order…' : 'What did you have?'}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  autoFocus
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="€"
                  className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !item.trim()}
                  className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                >
                  {loading ? 'Saving…' : myOrder ? 'Update order' : 'Add order'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowOrderForm(false); setItem(''); setAmount('') }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => { setShowOrderForm(true); setItem(myOrder?.item_description || ''); setAmount(myOrder?.amount ?? '') }}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              {myOrder ? 'Edit my order' : '+ Add my order'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function RetroactiveForm({ places, me, onCreated, onCancel }) {
  const [date, setDate] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!date || !placeId) return
    setLoading(true)
    setError(null)
    try {
      const session = await api.createRetroactive({
        date,
        place_id: parseInt(placeId),
        pickup_location: pickupLocation.trim() || null,
        pickup_time: pickupTime.trim() || null,
      })
      onCreated(session)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Record a past lunch</h3>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-sm">{error}</div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Lunch place *</label>
        <select
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="">-- Select a place --</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Pickup location</label>
          <input
            type="text"
            value={pickupLocation}
            onChange={(e) => setPickupLocation(e.target.value)}
            placeholder="e.g. Main entrance"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="w-28">
          <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
          <input
            type="time"
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={loading || !date || !placeId}
          className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Record lunch'}
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

export default function HistoryView({ places, me }) {
  const [sessions, setSessions] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    try {
      const data = await api.getSessions()
      setSessions(data)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreated = (session) => {
    setShowForm(false)
    setSessions((prev) => [session, ...(prev || [])])
  }

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Lunch History</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="py-2 px-4 bg-orange-500 text-white text-sm rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            + Record past lunch
          </button>
        )}
      </div>

      {showForm && (
        <RetroactiveForm
          places={places}
          me={me}
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {sessions === null ? (
        <div className="text-gray-400 text-sm">Loading history…</div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          No lunch sessions recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} places={places} me={me} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  )
}

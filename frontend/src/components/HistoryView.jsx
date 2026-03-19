import { useState, useEffect } from 'react'
import QRCode from 'react-qr-code'
import { api } from '../api'
import { StarRating } from './PlacesView'

function displayName(user) {
  return user?.friendly_name || user?.email || '?'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('nl-NL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('nl-NL', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

// ─── Settling session card (open, needs settlement) ──────────────────────────

export function SettlingCard({ session, me, onRefresh }) {
  const [orderText, setOrderText] = useState('')
  const [orderAmount, setOrderAmount] = useState('')
  const [paymentUrl, setPaymentUrl] = useState(session.payment_url || '')
  const [editingTotal, setEditingTotal] = useState(false)
  const [totalInput, setTotalInput] = useState(session.total_amount != null ? String(session.total_amount) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const myOrder = session.orders.find((o) => o.user.id === me.id)
  const isHost = session.host?.id === me.id
  const paidSum = session.orders.reduce((s, o) => s + (o.is_paid ? (o.amount || 0) : 0), 0)
  const remaining = session.total_amount != null ? Math.max(0, session.total_amount - paidSum) : null

  // Pre-fill my order if it exists
  useEffect(() => {
    if (myOrder) {
      setOrderText(myOrder.item_description || '')
      setOrderAmount(myOrder.amount != null ? String(myOrder.amount) : '')
    }
  }, [])

  const handleOrder = async (e) => {
    e.preventDefault()
    if (!orderText.trim()) return
    setLoading(true)
    setError(null)
    try {
      await api.addOrderToSession(session.id, orderText.trim(), orderAmount ? parseFloat(orderAmount) : null)
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSetPayment = async () => {
    if (!paymentUrl.trim()) return
    setLoading(true)
    setError(null)
    try {
      await api.setSessionPayment(session.id, paymentUrl.trim())
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBecomeHost = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.takeSessionHost(session.id)
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTotal = async () => {
    if (!totalInput) return
    setLoading(true)
    setError(null)
    try {
      await api.setSessionTotal(session.id, parseFloat(totalInput))
      setEditingTotal(false)
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSettle = async () => {
    if (!confirm('Mark this lunch as settled?')) return
    setLoading(true)
    setError(null)
    try {
      await api.settleSession(session.id)
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkPaid = async (oid) => {
    setLoading(true)
    try {
      await api.markPaidInSession(session.id, oid)
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
              {formatDate(session.date)}
            </p>
            <h3 className="text-xl font-bold text-gray-900">{session.selected_place?.name}</h3>
            {session.selected_place?.description && (
              <p className="text-sm text-gray-500 mt-0.5">{session.selected_place.description}</p>
            )}
            {session.selected_place?.address && (
              <p className="text-sm text-gray-400 mt-0.5">{session.selected_place.address}</p>
            )}
            {session.selected_place?.google_rating != null && (
              <div className="mt-1">
                <StarRating rating={session.selected_place.google_rating} />
              </div>
            )}
            {(session.pickup_location || session.pickup_time) && (
              <p className="text-sm text-gray-600 mt-1">
                Pickup: <span className="font-medium">{session.pickup_location}</span>
                {session.pickup_time && <span className="text-gray-400 ml-1">at {session.pickup_time}</span>}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            {session.total_amount != null && (
              remaining > 0 ? (
                <div>
                  <p className="text-xs text-gray-400">Remaining</p>
                  {editingTotal ? (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-sm text-gray-400">€</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={totalInput}
                        onChange={(e) => setTotalInput(e.target.value)}
                        className="w-24 border border-orange-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        autoFocus
                      />
                      <button onClick={handleUpdateTotal} disabled={loading || !totalInput} className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50">Save</button>
                      <button onClick={() => setEditingTotal(false)} className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50">✕</button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-2xl font-bold text-orange-600">€{remaining.toFixed(2)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        of €{session.total_amount.toFixed(2)}
                        {isHost && (
                          <button onClick={() => { setEditingTotal(true); setTotalInput(String(session.total_amount)) }} className="ml-1.5 text-orange-400 hover:text-orange-600 underline">edit</button>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Settled ✓</span>
              )
            )}
          </div>
        </div>

        {/* Host */}
        {session.host ? (
          <p className="text-sm text-gray-500 mt-2">
            Host: <span className="font-medium text-gray-700">{displayName(session.host)}</span>
          </p>
        ) : (
          <button
            onClick={handleBecomeHost}
            disabled={loading}
            className="mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50"
          >
            + Become host
          </button>
        )}
      </div>

      {error && (
        <div className="px-5 py-3 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/* Payment */}
      <div className="p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Payment</h4>
        {session.payment_url ? (
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <QRCode value={session.payment_url} size={160} />
            </div>
            <a
              href={session.payment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-orange-600 hover:underline break-all text-center"
            >
              {session.payment_url}
            </a>
            {isHost && (
              <div className="w-full flex gap-2">
                <input
                  type="url"
                  value={paymentUrl}
                  onChange={(e) => setPaymentUrl(e.target.value)}
                  placeholder="Update payment URL"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button
                  onClick={handleSetPayment}
                  disabled={loading || !paymentUrl.trim()}
                  className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  Update
                </button>
              </div>
            )}
          </div>
        ) : isHost ? (
          <div className="flex gap-2">
            <input
              type="url"
              value={paymentUrl}
              onChange={(e) => setPaymentUrl(e.target.value)}
              placeholder="https://tikkie.me/pay/..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={handleSetPayment}
              disabled={loading || !paymentUrl.trim()}
              className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              Share
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Waiting for host to share payment link…</p>
        )}
      </div>

      {/* Orders */}
      <div className="p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Orders{' '}
          <span className="font-normal text-gray-400">({session.orders.length})</span>
        </h4>

        {session.orders.length > 0 && (
          <ul className="divide-y divide-gray-100 mb-3">
            {session.orders.map((order) => {
              const isOwn = order.user.id === me.id
              return (
                <li key={order.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800">{displayName(order.user)}</span>
                    {order.item_description && (
                      <>
                        <span className="text-gray-300 mx-1.5">—</span>
                        <span className="text-sm text-gray-600">{order.item_description}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {order.amount != null && (
                      <span className="text-sm font-medium text-gray-700">€{order.amount.toFixed(2)}</span>
                    )}
                    {order.is_paid ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Paid</span>
                    ) : isOwn ? (
                      <button
                        onClick={() => handleMarkPaid(order.id)}
                        disabled={loading}
                        className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full hover:bg-orange-200 disabled:opacity-50"
                      >
                        Mark paid
                      </button>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Unpaid</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {session.total_amount != null && (
          <div className="pt-2 border-t border-gray-100 mb-4 space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Paid</span>
              <span>€{paidSum.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-gray-800">
              <span>Total bill</span>
              <span>€{session.total_amount.toFixed(2)}</span>
            </div>
            <div className={`flex justify-between text-sm font-bold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              <span>Remaining</span>
              <span>€{remaining.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Host: mark as settled */}
        {isHost && remaining > 0 && (
          <div className="mb-3">
            <button
              onClick={handleSettle}
              disabled={loading}
              className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              Mark as settled
            </button>
          </div>
        )}

        {/* Add / update my order */}
        <form onSubmit={handleOrder} className="space-y-2 pt-1">
          <div className="flex gap-2">
            <input
              type="text"
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              placeholder={myOrder ? 'Update your order…' : 'What did you have?'}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              required
            />
            <div className="relative w-28">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !orderText.trim()}
            className="w-full py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? 'Saving…' : myOrder ? 'Update my order' : 'Add my order'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Done session row (collapsed history) ────────────────────────────────────

function DoneCard({ session, me, onRefresh }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-medium text-gray-700 shrink-0">{formatDateShort(session.date)}</span>
          {session.selected_place && (
            <span className="text-sm text-gray-500 truncate">{session.selected_place.name}</span>
          )}
          {session.selected_place?.google_rating != null && (
            <StarRating rating={session.selected_place.google_rating} />
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          {session.total_amount != null && <span className="text-sm text-gray-400">€{session.total_amount.toFixed(2)}</span>}
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
        <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-2">
          {session.selected_place?.address && (
            <p className="text-xs text-gray-400">{session.selected_place.address}</p>
          )}
          {session.pickup_location && (
            <p className="text-sm text-gray-600">
              Pickup: <span className="font-medium">{session.pickup_location}</span>
              {session.pickup_time && <span className="text-gray-400 ml-1">at {session.pickup_time}</span>}
            </p>
          )}
          {session.host && (
            <p className="text-sm text-gray-600">Host: <span className="font-medium">{displayName(session.host)}</span></p>
          )}
          {session.orders.length > 0 && (
            <ul className="divide-y divide-gray-100 mt-2">
              {session.orders.map((order) => (
                <li key={order.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800">{displayName(order.user)}</span>
                    {order.item_description && (
                      <>
                        <span className="text-gray-300 mx-1.5">—</span>
                        <span className="text-sm text-gray-600">{order.item_description}</span>
                      </>
                    )}
                  </div>
                  {order.amount != null && (
                    <span className="text-sm font-medium text-gray-700 shrink-0">€{order.amount.toFixed(2)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Record form ─────────────────────────────────────────────────────────────

function RetroactiveForm({ places, onCreated, onCancel }) {
  const [date, setDate] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!date || !placeId || !totalAmount) return
    setLoading(true)
    setError(null)
    try {
      const session = await api.createRetroactive({
        date,
        place_id: parseInt(placeId),
        total_amount: parseFloat(totalAmount),
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
      <div className="flex gap-3">
        <div className="flex-1">
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
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Lunch place *</label>
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">-- Select --</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium text-gray-700 mb-1">Total bill *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>
      </div>
      <div className="flex gap-3">
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
          disabled={loading || !date || !placeId || !totalAmount}
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

// ─── Main view ───────────────────────────────────────────────────────────────

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

  const done = sessions?.filter((s) => s.status === 'done') || []

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
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {sessions === null ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : done.length === 0 && !showForm ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          No past lunches yet.
        </div>
      ) : (
        <div className="space-y-3">
          {done.map((s) => (
            <DoneCard key={s.id} session={s} me={me} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  )
}

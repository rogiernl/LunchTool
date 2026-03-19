import { useState } from 'react'
import QRCode from 'react-qr-code'
import { api } from '../api'
import { StarRating } from './PlacesView'

function displayName(user) {
  return user.friendly_name || user.email
}

export default function OrderingView({ session, me, onRefresh }) {
  const [orderText, setOrderText] = useState(() => {
    const myOrder = session.orders.find((o) => o.user.id === me.id)
    return myOrder ? myOrder.item_description : ''
  })
  const [orderAmount, setOrderAmount] = useState(() => {
    const myOrder = session.orders.find((o) => o.user.id === me.id)
    return myOrder?.amount != null ? String(myOrder.amount) : ''
  })
  const [paymentUrl, setPaymentUrl] = useState(session.payment_url || '')
  const [pickupLocation, setPickupLocation] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPickupForm, setShowPickupForm] = useState(false)

  const isHost = session.host?.id === me.id
  const myOrder = session.orders.find((o) => o.user.id === me.id)

  const handleOrder = async () => {
    if (!orderText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const amount = orderAmount ? parseFloat(orderAmount) : null
      await api.addOrder(orderText.trim(), amount)
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
      await api.setPayment(paymentUrl.trim())
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSetPickup = async () => {
    if (!pickupLocation.trim() || !pickupTime.trim()) return
    setLoading(true)
    setError(null)
    try {
      await api.setPickup({ pickup_location: pickupLocation.trim(), pickup_time: pickupTime.trim() })
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Selected restaurant */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Today we're going to</p>
            <h2 className="text-2xl font-bold text-gray-900">{session.selected_place?.name}</h2>
            {session.selected_place?.description && (
              <p className="text-sm text-gray-500 mt-1">{session.selected_place.description}</p>
            )}
            {session.selected_place?.address && (
              <p className="text-sm text-gray-400 mt-0.5">{session.selected_place.address}</p>
            )}
            <StarRating rating={session.selected_place?.google_rating} />
            {session.selected_place?.walking_minutes != null && (
              <p className="inline-flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>
                  <path d="M9 12l2-4 3 3-1 5"/>
                  <path d="M7 17l2-2M14 10l2 2-1 5"/>
                </svg>
                {session.selected_place.walking_minutes} min walk from office
              </p>
            )}
            {session.selected_place?.has_order_ahead && (
              <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Order ahead required
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          Host: <span className="font-medium text-gray-700">{displayName(session.host)}</span>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Payment */}
      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Payment</h3>

        {session.payment_url ? (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <QRCode value={session.payment_url} size={180} />
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
              <div className="w-full flex gap-2 mt-1">
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
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Share a payment link so people can pay you back (Tikkie, PayPal.me, Revolut, etc.)
            </p>
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
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Waiting for host to share payment link...</p>
        )}
      </div>

      {/* Your order */}
      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          {myOrder ? 'Your order' : 'Add your order'}
        </h3>
        <div className="space-y-2">
          <input
            type="text"
            value={orderText}
            onChange={(e) => setOrderText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleOrder()}
            placeholder="What do you want? e.g. Club sandwich + sparkling water"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <div className="flex gap-2">
            <div className="relative w-36">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <button
              onClick={handleOrder}
              disabled={loading || !orderText.trim()}
              className="flex-1 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 whitespace-nowrap"
            >
              {myOrder ? 'Update' : 'Submit'}
            </button>
          </div>
        </div>
      </div>

      {/* All orders */}
      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          All orders{' '}
          <span className="text-sm text-gray-400 font-normal">({session.orders.length})</span>
        </h3>

        {session.orders.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No orders yet</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {session.orders.map((order) => (
                <li key={order.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800">
                      {displayName(order.user)}
                    </span>
                    <span className="text-gray-400 mx-1.5">—</span>
                    <span className="text-sm text-gray-600">{order.item_description}</span>
                  </div>
                  {order.amount != null && (
                    <span className="shrink-0 text-sm font-medium text-gray-700">
                      € {order.amount.toFixed(2)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {session.orders.some((o) => o.amount != null) && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm font-semibold text-gray-800">
                <span>Total</span>
                <span>
                  € {session.orders.reduce((sum, o) => sum + (o.amount || 0), 0).toFixed(2)}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Host: set pickup info */}
      {isHost && (
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Ready to order?</h3>
          <p className="text-sm text-gray-500 mb-4">
            Once you've placed the order at the restaurant, enter the pickup details below. This will notify everyone.
          </p>

          {!showPickupForm ? (
            <button
              onClick={() => setShowPickupForm(true)}
              className="py-2.5 px-6 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              I've ordered — set pickup info
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup location</label>
                <input
                  type="text"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  placeholder="e.g. Main entrance lobby, 3rd floor kitchen"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup time</label>
                <input
                  type="text"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  placeholder="e.g. 12:30"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSetPickup}
                  disabled={loading || !pickupLocation.trim() || !pickupTime.trim()}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : 'Confirm pickup info'}
                </button>
                <button
                  onClick={() => setShowPickupForm(false)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

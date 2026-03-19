import { useState } from 'react'
import QRCode from 'react-qr-code'
import { api } from '../api'

function displayName(user) {
  return user.friendly_name || user.email
}

export default function PickupView({ session, me, onRefresh }) {
  const [orderText, setOrderText] = useState(() => {
    const myOrder = session.orders.find((o) => o.user.id === me.id)
    return myOrder ? myOrder.item_description : ''
  })
  const [orderAmount, setOrderAmount] = useState(() => {
    const myOrder = session.orders.find((o) => o.user.id === me.id)
    return myOrder?.amount != null ? String(myOrder.amount) : ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const myOrder = session.orders.find((o) => o.user.id === me.id)
  const isHost = session.host?.id === me.id

  const handleMarkPaid = async () => {
    if (!myOrder) return
    setLoading(true)
    setError(null)
    try {
      await api.markPaid(myOrder.id)
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

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

  const paidCount = session.orders.filter((o) => o.is_paid).length

  return (
    <div className="space-y-4">
      {/* Pickup info banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-5">
        <p className="text-xs text-green-600 uppercase tracking-wide font-medium mb-2">Pickup info</p>
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-green-700 font-medium w-16 shrink-0">Where</span>
            <span className="text-lg font-bold text-green-900">{session.pickup_location}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-green-700 font-medium w-16 shrink-0">When</span>
            <span className="text-lg font-bold text-green-900">{session.pickup_time}</span>
          </div>
        </div>
        <p className="text-xs text-green-600 mt-3">
          Ordered from <span className="font-medium">{session.selected_place?.name}</span> by{' '}
          <span className="font-medium">{displayName(session.host)}</span>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Payment / QR */}
      {session.payment_url && (
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Pay the host</h3>
          <div className="flex flex-col items-center gap-3">
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
          </div>
        </div>
      )}

      {/* My order + paid */}
      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Your order</h3>

        {myOrder ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm text-gray-700">{myOrder.item_description}</span>
              {myOrder.is_paid ? (
                <span className="shrink-0 text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">
                  Paid
                </span>
              ) : (
                <button
                  onClick={handleMarkPaid}
                  disabled={loading}
                  className="shrink-0 text-xs bg-orange-500 text-white font-medium px-3 py-1.5 rounded-full hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  Mark as paid
                </button>
              )}
            </div>
            {myOrder.amount != null && (
              <p className="text-sm text-gray-500">Amount: <span className="font-medium text-gray-700">€ {myOrder.amount.toFixed(2)}</span></p>
            )}
            {/* Allow updating order even in pickup phase */}
            <div className="space-y-2 pt-1">
              <input
                type="text"
                value={orderText}
                onChange={(e) => setOrderText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOrder()}
                placeholder="Update your order"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="flex gap-2">
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <button
                  onClick={handleOrder}
                  disabled={loading || !orderText.trim()}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-40"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-400 italic mb-3">You haven't added an order yet</p>
            <div className="space-y-2">
              <input
                type="text"
                value={orderText}
                onChange={(e) => setOrderText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOrder()}
                placeholder="What do you want?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="flex gap-2">
                <div className="relative w-32">
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
                  className="flex-1 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* All orders */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">All orders</h3>
          {session.orders.length > 0 && (
            <span className="text-xs text-gray-400">
              {paidCount}/{session.orders.length} paid
            </span>
          )}
        </div>
        {session.orders.some((o) => o.amount != null) && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg flex justify-between text-sm font-semibold text-gray-700">
            <span>Total</span>
            <span>€ {session.orders.reduce((sum, o) => sum + (o.amount || 0), 0).toFixed(2)}</span>
          </div>
        )}

        {session.orders.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No orders yet</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {session.orders.map((order) => {
              const isMe = order.user.id === me.id
              return (
                <li
                  key={order.id}
                  className={`py-3 flex items-center justify-between gap-2 ${
                    isMe ? 'bg-orange-50 -mx-5 px-5 rounded' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span
                      className={`text-sm font-medium ${
                        isMe ? 'text-orange-700' : 'text-gray-800'
                      }`}
                    >
                      {displayName(order.user)}
                      {isMe && <span className="text-xs ml-1 text-orange-400">(you)</span>}
                    </span>
                    <p className="text-sm text-gray-600 truncate">{order.item_description}</p>
                  </div>
                  {order.amount != null && (
                    <span className="text-sm font-medium text-gray-600 shrink-0">
                      € {order.amount.toFixed(2)}
                    </span>
                  )}
                  {order.is_paid ? (
                    <span className="shrink-0 text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                      Paid
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                      Unpaid
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

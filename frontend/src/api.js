const BASE = '/api'

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  getConfig: () => req('GET', '/config'),
  getWeather: () => req('GET', '/weather'),
  autocomplete: (q) => req('GET', `/places-autocomplete?q=${encodeURIComponent(q)}`),
  getPlaceDetails: (placeId) => req('GET', `/place-details/${placeId}`),
  getMe: () => req('GET', '/me'),
  updateMe: (friendly_name) => req('PUT', '/me', { friendly_name }),

  getPlaces: () => req('GET', '/places'),
  toggleLike: (id) => req('POST', `/places/${id}/like`, {}),
  createPlace: (data) => req('POST', '/places', data),
  updatePlace: (id, data) => req('PUT', `/places/${id}`, data),
  deletePlace: (id) => req('DELETE', `/places/${id}`),

  getSession: () => req('GET', '/session/today'),
  castVote: (data) => req('POST', '/session/today/vote', data),
  extendVote: () => req('POST', '/session/today/extend-vote', {}),
  takeHost: (data) => req('POST', '/session/today/host', data),
  setPayment: (payment_url) => req('PUT', '/session/today/payment', { payment_url }),
  setPickup: (data) => req('PUT', '/session/today/pickup', data),
  addOrder: (item_description, amount) => req('POST', '/session/today/orders', { item_description, amount: amount || null }),
  markPaid: (id) => req('PUT', `/session/today/orders/${id}/paid`, {}),

  getSessions: () => req('GET', '/sessions'),
  createRetroactive: (data) => req('POST', '/sessions/retroactive', data),
  uploadSessionImage: async (sid, file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/sessions/${sid}/image`, { method: 'POST', body: form })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Upload failed') }
    return res.json()
  },
  addOrderToSession: (sid, item_description, amount) => req('POST', `/sessions/${sid}/orders`, { item_description, amount: amount || null }),
  markPaidInSession: (sid, oid) => req('PUT', `/sessions/${sid}/orders/${oid}/paid`, {}),
  setSessionPayment: (sid, payment_url) => req('PUT', `/sessions/${sid}/payment`, { payment_url }),
  takeSessionHost: (sid) => req('POST', `/sessions/${sid}/host`, {}),
  setSessionTotal: (sid, total_amount) => req('PUT', `/sessions/${sid}/total`, { total_amount }),
  settleSession: (sid) => req('PUT', `/sessions/${sid}/settle`, {}),
  setFarewell: (sid, farewell_payment_url) => req('PUT', `/sessions/${sid}/farewell`, { farewell_payment_url }),

  getPolls: () => req('GET', '/polls'),
  createPoll: (data) => req('POST', '/polls', data),
  respondToPoll: (pid, responses) => req('POST', `/polls/${pid}/respond`, { responses }),
  confirmPoll: (pid, option_id) => req('PUT', `/polls/${pid}/confirm`, { option_id }),
  deletePoll: (pid) => req('DELETE', `/polls/${pid}`),
  setPollFarewell: (pid, farewell_payment_url) => req('PUT', `/polls/${pid}/farewell`, { farewell_payment_url }),
}

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
  getMe: () => req('GET', '/me'),
  updateMe: (friendly_name) => req('PUT', '/me', { friendly_name }),

  getPlaces: () => req('GET', '/places'),
  createPlace: (data) => req('POST', '/places', data),
  updatePlace: (id, data) => req('PUT', `/places/${id}`, data),
  deletePlace: (id) => req('DELETE', `/places/${id}`),

  getSession: () => req('GET', '/session/today'),
  castVote: (data) => req('POST', '/session/today/vote', data),
  takeHost: (data) => req('POST', '/session/today/host', data),
  setPayment: (payment_url) => req('PUT', '/session/today/payment', { payment_url }),
  setPickup: (data) => req('PUT', '/session/today/pickup', data),
  addOrder: (item_description) => req('POST', '/session/today/orders', { item_description }),
  markPaid: (id) => req('PUT', `/session/today/orders/${id}/paid`, {}),
}

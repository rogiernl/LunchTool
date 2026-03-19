let _promise = null

export function loadMapsApi(apiKey) {
  if (window.google?.maps) return Promise.resolve()
  if (_promise) return _promise
  _promise = new Promise((resolve) => {
    const cb = `_gmCb${Date.now()}`
    window[cb] = () => { delete window[cb]; resolve() }
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${cb}`
    s.async = true
    document.head.appendChild(s)
  })
  return _promise
}

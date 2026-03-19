import { useEffect, useRef } from 'react'
import { loadMapsApi } from '../mapsLoader'

// Default center: Utrecht city centre
const DEFAULT_LAT = 52.0907
const DEFAULT_LNG = 5.1214

export default function CoordPicker({ apiKey, lat, lng, onChange, onClose }) {
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (!apiKey || !mapRef.current) return

    const initLat = lat ?? DEFAULT_LAT
    const initLng = lng ?? DEFAULT_LNG

    loadMapsApi(apiKey).then(() => {
      const G = window.google.maps

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new G.Map(mapRef.current, {
          center: { lat: initLat, lng: initLng },
          zoom: lat ? 17 : 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        })
      }

      const map = mapInstanceRef.current

      // Place draggable marker
      if (!markerRef.current) {
        markerRef.current = new G.Marker({
          position: { lat: initLat, lng: initLng },
          map,
          draggable: true,
          title: 'Drag to adjust location',
          animation: G.Animation.DROP,
        })

        markerRef.current.addListener('dragend', (e) => {
          onChange(e.latLng.lat(), e.latLng.lng())
        })

        map.addListener('click', (e) => {
          const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() }
          markerRef.current.setPosition(pos)
          onChange(pos.lat, pos.lng)
        })
      } else {
        markerRef.current.setPosition({ lat: initLat, lng: initLng })
      }
    })
  }, [apiKey])

  // Keep marker in sync if lat/lng change externally (e.g. after geocode)
  useEffect(() => {
    if (markerRef.current && lat != null && lng != null) {
      markerRef.current.setPosition({ lat, lng })
      mapInstanceRef.current?.panTo({ lat, lng })
    }
  }, [lat, lng])

  return (
    <div className="rounded-lg overflow-hidden border border-orange-300 shadow-sm">
      <div ref={mapRef} style={{ height: '260px', width: '100%' }} />
      <div className="bg-orange-50 px-3 py-2 flex items-center justify-between border-t border-orange-200">
        <span className="text-xs text-gray-500">
          {lat != null && lng != null
            ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
            : 'Click the map or drag the pin to set location'}
        </span>
        <div className="flex items-center gap-2">
          {lat != null && (
            <button
              type="button"
              onClick={() => onChange(null, null)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-orange-700 hover:text-orange-900"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

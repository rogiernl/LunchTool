import { useEffect, useRef } from 'react'
import { loadMapsApi } from '../mapsLoader'

export default function MapView({ places, config }) {
  const mapRef = useRef(null)
  const instanceRef = useRef(null)

  useEffect(() => {
    if (!config?.google_maps_api_key || !mapRef.current) return

    const officeLat = config.office_lat ?? 52.0919
    const officeLng = config.office_lng ?? 5.1183
    const officeName = config.office_name ?? 'Office'

    loadMapsApi(config.google_maps_api_key).then(() => {
      const G = window.google.maps

      if (!instanceRef.current) {
        instanceRef.current = new G.Map(mapRef.current, {
          center: { lat: officeLat, lng: officeLng },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
      }

      const map = instanceRef.current
      // Clear old markers by rebuilding (simple approach)
      map.markers?.forEach((m) => m.setMap(null))
      map.markers = []

      // Office marker (blue pin)
      const officeMarker = new G.Marker({
        position: { lat: officeLat, lng: officeLng },
        map,
        title: officeName,
        icon: {
          path: G.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        zIndex: 10,
      })
      const officeInfo = new G.InfoWindow({
        content: `<div style="font-size:13px;font-weight:600;color:#1e40af">${officeName}</div>`,
      })
      officeMarker.addListener('click', () => officeInfo.open(map, officeMarker))
      map.markers.push(officeMarker)

      // Place markers
      const bounds = new G.LatLngBounds()
      bounds.extend({ lat: officeLat, lng: officeLng })

      let hasPlacesOnMap = false
      places.filter((p) => p.lat && p.lng).forEach((place) => {
        hasPlacesOnMap = true
        bounds.extend({ lat: place.lat, lng: place.lng })

        const marker = new G.Marker({
          position: { lat: place.lat, lng: place.lng },
          map,
          title: place.name,
          icon: {
            path: G.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#f97316',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        })

        const walkText = place.walking_minutes != null
          ? `<div style="color:#6b7280;font-size:12px;margin-top:2px">🚶 ${place.walking_minutes} min walk</div>`
          : ''
        const infoContent = `
          <div style="min-width:140px">
            <div style="font-size:13px;font-weight:600;color:#111">${place.name}</div>
            ${place.address ? `<div style="color:#6b7280;font-size:11px;margin-top:2px">${place.address}</div>` : ''}
            ${walkText}
          </div>`
        const info = new G.InfoWindow({ content: infoContent })
        marker.addListener('click', () => {
          map.markers.forEach((m) => m._info?.close())
          info.open(map, marker)
        })
        marker._info = info
        map.markers.push(marker)
      })

      if (hasPlacesOnMap) {
        map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 })
      }
    })
  }, [places, config])

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 shadow">
      <div ref={mapRef} style={{ height: '360px', width: '100%' }} />
      <div className="bg-white px-4 py-2 flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> {config?.office_name ?? 'Office'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-orange-500" /> Lunch places
        </span>
        {places.filter((p) => !p.lat).length > 0 && (
          <span className="text-gray-400 italic">
            {places.filter((p) => !p.lat).length} place{places.filter((p) => !p.lat).length !== 1 ? 's' : ''} without address not shown
          </span>
        )}
      </div>
    </div>
  )
}

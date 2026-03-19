import { useState, useEffect, useCallback } from 'react'
import { api } from './api'
import Header from './components/Header'
import TodayView from './components/TodayView'
import PlacesView from './components/PlacesView'

export default function App() {
  const [me, setMe] = useState(null)
  const [session, setSession] = useState(null)
  const [places, setPlaces] = useState([])
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('')
  const [tab, setTab] = useState('today')
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    try {
      const [meData, sessionData, placesData, config] = await Promise.all([
        api.getMe(),
        api.getSession(),
        api.getPlaces(),
        api.getConfig(),
      ])
      setMe(meData)
      setSession(sessionData)
      setPlaces(placesData)
      if (config.google_maps_api_key) setGoogleMapsApiKey(config.google_maps_api_key)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <div className="text-4xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!me || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        me={me}
        onUpdateName={async (name) => {
          await api.updateMe(name)
          await loadData()
        }}
      />

      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex">
          {[
            { key: 'today', label: "Today's Lunch" },
            { key: 'places', label: 'Lunch Places' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                tab === key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {tab === 'today' && (
          <TodayView session={session} places={places} me={me} onRefresh={loadData} />
        )}
        {tab === 'places' && (
          <PlacesView places={places} me={me} onRefresh={loadData} googleMapsApiKey={googleMapsApiKey} />
        )}
      </main>
    </div>
  )
}

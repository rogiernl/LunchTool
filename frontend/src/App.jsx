import { useState, useEffect, useCallback } from 'react'
import { api } from './api'
import Header from './components/Header'
import TodayView from './components/TodayView'
import PlacesView from './components/PlacesView'
import HistoryView, { SettlingCard } from './components/HistoryView'
import PollView, { PollCard } from './components/PollView'

function DinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <path d="M18 2v20M18 8c0-3-3-6-3-6v12s3-1 3-6zM6 2v6a4 4 0 0 0 4 4v10" />
    </svg>
  )
}

function DrinksIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <path d="M8 22h8M12 11v11M5 2l2 9a5 5 0 0 0 10 0l2-9H5z" />
    </svg>
  )
}

function LunchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12h6M12 9v6" />
    </svg>
  )
}

const TYPE_ICONS = { lunch: LunchIcon, dinner: DinnerIcon, drinks: DrinksIcon }

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function App() {
  const [me, setMe] = useState(null)
  const [session, setSession] = useState(null)
  const [places, setPlaces] = useState([])
  const [settlingSessions, setSettlingSessions] = useState([])
  const [polls, setPolls] = useState([])
  const [config, setConfig] = useState({})
  const [tab, setTab] = useState('today')
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    try {
      const [meData, sessionData, placesData, configData, allSessions, pollsData] = await Promise.all([
        api.getMe(),
        api.getSession(),
        api.getPlaces(),
        api.getConfig(),
        api.getSessions(),
        api.getPolls(),
      ])
      setMe(meData)
      setSession(sessionData)
      setPlaces(placesData)
      setSettlingSessions(allSessions.filter((s) => s.status === 'settling'))
      setConfig(configData)
      setPolls(pollsData)
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

  // Polls that the current user hasn't responded to yet
  const unansweredPolls = polls.filter((p) => p.status === 'open' && !p.has_responded)
  const confirmedPolls = polls.filter((p) => p.status === 'confirmed')

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
            { key: 'today', label: 'Overview' },
            { key: 'activities', label: 'Activities', badge: unansweredPolls.length },
            { key: 'places', label: 'Lunch Places' },
            { key: 'history', label: 'History' },
          ].map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative px-5 py-3 font-medium text-sm border-b-2 transition-colors ${
                tab === key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {badge > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-xs font-bold bg-orange-500 text-white rounded-full">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Poll banner — unanswered open polls */}
      {unansweredPolls.length > 0 && tab !== 'activities' && (
        <div
          className="bg-orange-50 border-b border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
          onClick={() => setTab('activities')}
        >
          <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <span className="text-orange-500 font-bold text-lg">!</span>
            <div className="flex-1 min-w-0">
              {unansweredPolls.length === 1 ? (
                <p className="text-sm text-orange-800 font-medium truncate">
                  Fill in your availability for <span className="font-semibold">{unansweredPolls[0].title}</span>
                </p>
              ) : (
                <p className="text-sm text-orange-800 font-medium">
                  {unansweredPolls.length} activities need your availability
                </p>
              )}
            </div>
            <span className="text-xs text-orange-600 font-medium shrink-0">View →</span>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {tab === 'today' && (
          <>
            {/* Upcoming confirmed activities */}
            {confirmedPolls.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-base font-bold text-gray-900">Upcoming</h2>
                {confirmedPolls.map((p) => {
                  const IconComp = TYPE_ICONS[p.poll_type] || DinnerIcon
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 bg-white rounded-xl shadow px-4 py-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setTab('activities')}
                    >
                      <span className="text-orange-500"><IconComp /></span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{p.title}</p>
                        {p.confirmed_option && (
                          <p className="text-xs text-gray-500">
                            {formatDate(p.confirmed_option.date)}
                            {p.confirmed_option.time_label ? ` · ${p.confirmed_option.time_label}` : ''}
                          </p>
                        )}
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full shrink-0">
                        Confirmed
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Open outings (settling) */}
            {settlingSessions.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-bold text-gray-900">Open outings</h2>
                {settlingSessions.map((s) => (
                  <SettlingCard key={s.id} session={s} me={me} onRefresh={loadData} />
                ))}
              </div>
            )}

            <div className={settlingSessions.length > 0 || confirmedPolls.length > 0 ? 'pt-2' : ''}>
              {(settlingSessions.length > 0 || confirmedPolls.length > 0) && (
                <h2 className="text-base font-bold text-gray-900 mb-3">Today's lunch</h2>
              )}
              <TodayView session={session} places={places} me={me} onRefresh={loadData} />
            </div>
          </>
        )}

        {tab === 'activities' && (
          <PollView polls={polls} me={me} onRefresh={loadData} />
        )}

        {tab === 'places' && (
          <PlacesView places={places} me={me} onRefresh={loadData} config={config} onConfigRefresh={loadData} />
        )}

        {tab === 'history' && (
          <HistoryView places={places} me={me} />
        )}
      </main>
    </div>
  )
}

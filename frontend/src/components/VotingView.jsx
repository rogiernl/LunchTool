import { useState, useEffect } from 'react'
import { api } from '../api'
import { StarRating } from './PlacesView'

function displayName(user) {
  return user.friendly_name || user.email
}

function useCountdown(deadlineISO) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const deadline = deadlineISO ? new Date(deadlineISO) : (() => {
      const d = new Date(); d.setHours(11, 0, 0, 0); return d
    })()

    const update = () => {
      const diff = deadline - new Date()
      if (diff <= 0) { setTimeLeft('closed'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${h > 0 ? h + 'h ' : ''}${m}m ${s}s`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [deadlineISO])

  return timeLeft
}

export default function VotingView({ session, places, me, onRefresh }) {
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)
  const [isJoining, setIsJoining] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showHostForm, setShowHostForm] = useState(false)
  const [hostPlaceId, setHostPlaceId] = useState('')
  const [error, setError] = useState(null)
  const [extending, setExtending] = useState(false)
  const countdown = useCountdown(session.vote_deadline)

  const myVote = session.votes.find((v) => v.user.id === me.id)

  useEffect(() => {
    if (myVote) {
      setSelectedPlaceId(myVote.lunch_place.id)
      setIsJoining(myVote.is_joining)
    }
  }, [])

  // Tally votes per place
  const voteCounts = {}
  session.votes.forEach((v) => {
    const id = v.lunch_place.id
    voteCounts[id] = (voteCounts[id] || 0) + 1
  })

  const topVoteCount = Math.max(0, ...Object.values(voteCounts))
  const winnerIds = Object.entries(voteCounts)
    .filter(([, count]) => count === topVoteCount && topVoteCount > 0)
    .map(([id]) => parseInt(id))

  const sortedPlaces = [...places].sort(
    (a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0)
  )

  const handleVote = async () => {
    if (!selectedPlaceId) return
    setLoading(true)
    setError(null)
    try {
      await api.castVote({ lunch_place_id: selectedPlaceId, is_joining: isJoining })
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTakeHost = async () => {
    if (!hostPlaceId) return
    setLoading(true)
    setError(null)
    try {
      await api.takeHost({ selected_place_id: parseInt(hostPlaceId) })
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {session.can_vote ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between gap-3">
          <div>
            <span className="text-blue-800 font-medium">Voting is open</span>
            <span className="text-blue-600 text-sm font-mono ml-3">Closes in {countdown}</span>
          </div>
          <button
            onClick={async () => {
              setExtending(true)
              try { await api.extendVote(); await onRefresh() }
              catch (e) { setError(e.message) }
              finally { setExtending(false) }
            }}
            disabled={extending}
            className="shrink-0 text-xs font-medium px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 disabled:opacity-50 transition-colors"
          >
            {extending ? '…' : '+20 min'}
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <span className="text-amber-800 font-medium">
            Voting is closed — waiting for someone to take the host role
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Vote form */}
      {session.can_vote && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {myVote ? 'Update your vote' : 'Cast your vote'}
          </h2>

          {places.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No lunch places available yet. Add some in the Lunch Places tab.
            </p>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {places.map((place) => (
                  <label
                    key={place.id}
                    className={`flex items-start p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedPlaceId === place.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="place"
                      value={place.id}
                      checked={selectedPlaceId === place.id}
                      onChange={() => setSelectedPlaceId(place.id)}
                      className="mt-0.5 mr-3 accent-orange-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{place.name}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {place.description && (
                          <span className="text-sm text-gray-500">{place.description}</span>
                        )}
                        <StarRating rating={place.google_rating} />
                        {place.walking_minutes != null && (
                          <span className="text-xs text-gray-500">🚶 {place.walking_minutes} min</span>
                        )}
                      </div>
                      {place.address && (
                        <div className="text-xs text-gray-400">{place.address}</div>
                      )}
                      {place.has_order_ahead && (
                        <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          Order ahead required
                        </span>
                      )}
                    </div>
                    {voteCounts[place.id] > 0 && (
                      <span className="ml-2 text-sm text-gray-400 shrink-0">
                        {voteCounts[place.id]} vote{voteCounts[place.id] !== 1 ? 's' : ''}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isJoining}
                  onChange={(e) => setIsJoining(e.target.checked)}
                  className="w-4 h-4 rounded accent-orange-500"
                />
                <span className="text-sm text-gray-700">I'm joining for lunch</span>
              </label>

              <button
                onClick={handleVote}
                disabled={!selectedPlaceId || loading}
                className="w-full py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Saving...' : myVote ? 'Update vote' : 'Vote'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Vote results */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Results {session.votes.length > 0 && `(${session.votes.filter(v => v.is_joining).length} joining)`}
        </h2>

        {session.votes.length === 0 ? (
          <p className="text-gray-400 text-sm">No votes yet</p>
        ) : (
          <div className="space-y-4">
            {sortedPlaces
              .filter((p) => voteCounts[p.id] > 0)
              .map((place) => {
                const isWinner = winnerIds.includes(place.id)
                const placeVotes = session.votes.filter((v) => v.lunch_place.id === place.id)
                return (
                  <div key={place.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`font-medium ${
                          isWinner ? 'text-orange-600' : 'text-gray-700'
                        }`}
                      >
                        {place.name}
                        {isWinner && (
                          <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                            leading
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-gray-500">
                        {voteCounts[place.id]} vote{voteCounts[place.id] !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {placeVotes.map((v) => (
                        <span
                          key={v.id}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            v.is_joining
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500 line-through'
                          }`}
                          title={v.is_joining ? 'Joining' : 'Not joining'}
                        >
                          {displayName(v.user)}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}

            {/* Not joining */}
            {session.votes.filter((v) => !v.is_joining).length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Not joining:{' '}
                  {session.votes
                    .filter((v) => !v.is_joining)
                    .map((v) => displayName(v.user))
                    .join(', ')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Become host */}
      {!session.can_vote && !session.host && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Take the host role</h2>
          <p className="text-sm text-gray-500 mb-4">
            As host you'll collect orders, share the payment link, and coordinate pickup.
          </p>

          {!showHostForm ? (
            <button
              onClick={() => {
                setShowHostForm(true)
                setHostPlaceId(winnerIds[0] || places[0]?.id || '')
              }}
              className="py-2.5 px-6 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              Become Host
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Select today's lunch spot
                </label>
                <select
                  value={hostPlaceId}
                  onChange={(e) => setHostPlaceId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">-- Select a place --</option>
                  {sortedPlaces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {voteCounts[p.id] ? ` (${voteCounts[p.id]} vote${voteCounts[p.id] !== 1 ? 's' : ''})` : ' (0 votes)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTakeHost}
                  disabled={!hostPlaceId || loading}
                  className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Confirming...' : 'Confirm as Host'}
                </button>
                <button
                  onClick={() => setShowHostForm(false)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {session.host && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          Host: <span className="font-medium">{displayName(session.host)}</span>
        </div>
      )}
    </div>
  )
}

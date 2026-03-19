import VotingView from './VotingView'
import OrderingView from './OrderingView'
import PickupView from './PickupView'

export default function TodayView({ session, places, me, onRefresh }) {
  if (!session) return null

  const statusLabels = {
    voting: 'Voting',
    ordering: 'Ordering',
    pickup: 'Pickup',
    done: 'Done',
  }

  const statusColors = {
    voting: 'bg-blue-100 text-blue-700',
    ordering: 'bg-yellow-100 text-yellow-700',
    pickup: 'bg-green-100 text-green-700',
    done: 'bg-gray-100 text-gray-600',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          {new Date(session.date + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </h1>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColors[session.status]}`}>
          {statusLabels[session.status] || session.status}
        </span>
      </div>

      {session.status === 'voting' && (
        <VotingView session={session} places={places} me={me} onRefresh={onRefresh} />
      )}
      {session.status === 'ordering' && (
        <OrderingView session={session} me={me} onRefresh={onRefresh} />
      )}
      {session.status === 'pickup' && (
        <PickupView session={session} me={me} onRefresh={onRefresh} />
      )}
      {session.status === 'done' && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Today's lunch session is complete.
        </div>
      )}
    </div>
  )
}

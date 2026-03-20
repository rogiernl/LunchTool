import { useState } from 'react'
import { api } from '../api'

function DinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M18 2v20M18 8c0-3-3-6-3-6v12s3-1 3-6zM6 2v6a4 4 0 0 0 4 4v10" />
    </svg>
  )
}

function DrinksIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M8 22h8M12 11v11M5 2l2 9a5 5 0 0 0 10 0l2-9H5z" />
    </svg>
  )
}

function LunchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12h6M12 9v6" />
    </svg>
  )
}

const POLL_TYPES = [
  { value: 'lunch', label: 'Lunch', Icon: LunchIcon },
  { value: 'dinner', label: 'Dinner', Icon: DinnerIcon },
  { value: 'drinks', label: 'Drinks', Icon: DrinksIcon },
]

function typeInfo(t) {
  return POLL_TYPES.find((p) => p.value === t) || POLL_TYPES[1]
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

const STATUS_COLORS = {
  yes: 'bg-green-100 text-green-700',
  no: 'bg-red-100 text-red-700',
  maybe: 'bg-yellow-100 text-yellow-700',
}
const STATUS_LABELS = { yes: 'Yes', no: 'No', maybe: 'Maybe' }

// ── Two-month date picker ─────────────────────────────────────────────────────

const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function toIso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function CalendarMonth({ year, month, selected, onToggle }) {
  // First day of month (Mon=0 … Sun=6)
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date(); today.setHours(0,0,0,0)

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 text-center mb-2">
        {MONTH_NAMES[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-0.5">
        {DAY_NAMES.map((n, i) => (
          <div key={n} className={`text-center text-xs font-medium pb-1 ${i >= 5 ? 'text-gray-300' : 'text-gray-400'}`}>{n}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const iso = toIso(year, month, d)
          const dow = (i - firstDow) % 7  // 0=Mon..6=Sun
          const isWeekend = dow >= 5
          const isPast = new Date(year, month, d) < today
          const isSelected = selected.has(iso)
          return (
            <button
              key={iso}
              type="button"
              disabled={isPast}
              onClick={() => onToggle(iso)}
              className={[
                'text-xs rounded py-1 font-medium transition-colors leading-none',
                isPast ? 'text-gray-200 cursor-default' :
                isSelected ? 'bg-orange-500 text-white' :
                isWeekend ? 'text-gray-300 hover:bg-orange-50 hover:text-orange-400' :
                'text-gray-700 hover:bg-orange-50 hover:text-orange-500',
              ].join(' ')}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DatePicker({ selected, onToggle }) {
  const now = new Date()
  const months = [
    { year: now.getFullYear(), month: now.getMonth() },
    { year: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(), month: (now.getMonth() + 1) % 12 },
  ]
  const sorted = [...selected].sort()

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        {months.map(({ year, month }) => (
          <CalendarMonth key={`${year}-${month}`} year={year} month={month} selected={selected} onToggle={onToggle} />
        ))}
      </div>
      {sorted.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {sorted.map((iso) => (
            <span key={iso} className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {formatDate(iso)}
              <button type="button" onClick={() => onToggle(iso)} className="hover:text-red-500 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Create poll form ──────────────────────────────────────────────────────────

function CreatePollForm({ onCreated, onCancel }) {
  const [title, setTitle] = useState('')
  const [pollType, setPollType] = useState('dinner')
  const [description, setDescription] = useState('')
  const [selectedDates, setSelectedDates] = useState(new Set())
  const [saving, setSaving] = useState(false)

  function toggleDate(iso) {
    setSelectedDates((prev) => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const dates = [...selectedDates].sort()
    if (!title.trim() || dates.length === 0) return
    setSaving(true)
    try {
      await api.createPoll({
        title: title.trim(),
        poll_type: pollType,
        description: description.trim() || null,
        options: dates.map((d) => ({ date: d, time_label: null })),
      })
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-4">
      <h3 className="font-semibold text-gray-900 text-base">Plan an activity</h3>

      <div className="flex gap-2 flex-wrap">
        {POLL_TYPES.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPollType(value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              pollType === value
                ? 'bg-orange-500 text-white border-orange-500'
                : 'border-gray-200 text-gray-600 hover:border-orange-300'
            }`}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>

      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        placeholder="Title (e.g. Team dinner)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Select date options <span className="normal-case font-normal text-gray-400">(click to toggle)</span>
        </p>
        <DatePicker selected={selectedDates} onToggle={toggleDate} />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || selectedDates.size === 0}
          className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? 'Creating…' : `Create poll${selectedDates.size > 0 ? ` (${selectedDates.size})` : ''}`}
        </button>
      </div>
    </form>
  )
}

// ── Single poll card ──────────────────────────────────────────────────────────

export function PollCard({ poll, me, onRefresh }) {
  const [saving, setSaving] = useState(false)
  const [farewell, setFarewell] = useState(poll.farewell_payment_url || '')
  const [farewellSaving, setFarewellSaving] = useState(false)
  const [showFarewellInput, setShowFarewellInput] = useState(false)

  const { Icon } = typeInfo(poll.poll_type)
  const isOrganizer = poll.created_by?.id === me?.id
  const isConfirmed = poll.status === 'confirmed'

  // Build response map from my_responses: option_id → status
  const myResponses = poll.my_responses || {}

  // Collect all unique voters across options
  const voterMap = {}
  poll.options?.forEach((opt) => {
    opt.responses?.forEach((r) => {
      if (!voterMap[r.user.id]) voterMap[r.user.id] = r.user
    })
  })
  const otherVoters = Object.values(voterMap).filter((u) => u.id !== me?.id)

  // Response lookup: user_id + option_id → status
  function getResponse(userId, optionId) {
    const opt = poll.options?.find((o) => o.id === optionId)
    return opt?.responses?.find((r) => r.user.id === userId)?.status
  }

  async function respond(optionId, status) {
    setSaving(true)
    try {
      const responses = poll.options.map((opt) => ({
        option_id: opt.id,
        status: opt.id === optionId ? status : (myResponses[opt.id] || 'no'),
      }))
      await api.respondToPoll(poll.id, responses)
      await onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function confirm(optionId) {
    setSaving(true)
    try {
      await api.confirmPoll(poll.id, optionId)
      await onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function deletePoll() {
    if (!window.confirm('Delete this poll?')) return
    await api.deletePoll(poll.id)
    await onRefresh()
  }

  async function saveFarewell() {
    setFarewellSaving(true)
    try {
      await api.setPollFarewell(poll.id, farewell)
      await onRefresh()
      setShowFarewellInput(false)
    } finally {
      setFarewellSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-orange-500 shrink-0"><Icon /></span>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm truncate">{poll.title}</h3>
            {poll.description && <p className="text-xs text-gray-500 mt-0.5">{poll.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isConfirmed ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
            {isConfirmed ? 'Confirmed' : 'Open'}
          </span>
          {isOrganizer && (
            <button onClick={deletePoll} className="text-gray-300 hover:text-red-400 text-xl leading-none" title="Delete poll">×</button>
          )}
        </div>
      </div>

      {/* Confirmed date callout */}
      {isConfirmed && poll.confirmed_option && (
        <div className="bg-green-50 px-5 py-2.5 flex items-center gap-2 border-b border-green-100">
          <span className="text-green-600 text-base">✓</span>
          <p className="text-sm font-medium text-green-800">
            {formatDate(poll.confirmed_option.date)}
            {poll.confirmed_option.time_label ? ` · ${poll.confirmed_option.time_label}` : ''}
          </p>
        </div>
      )}

      {/* Availability grid */}
      <div className="px-5 py-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-4 min-w-[7rem]">Person</th>
              {poll.options?.map((opt) => (
                <th
                  key={opt.id}
                  className={`text-center text-xs font-medium pb-2 px-2 ${
                    opt.id === poll.confirmed_option_id ? 'text-green-600' : 'text-gray-500'
                  }`}
                >
                  {formatDate(opt.date)}
                  {opt.id === poll.confirmed_option_id && <span className="block text-green-500">✓</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* My row — interactive when open */}
            <tr className="border-t border-gray-50">
              <td className="py-2 pr-4 text-xs font-semibold text-gray-700 truncate max-w-[7rem]">
                {me?.friendly_name || 'You'}
              </td>
              {poll.options?.map((opt) => {
                const cur = myResponses[opt.id]
                return (
                  <td key={opt.id} className="py-2 px-2 text-center">
                    {!isConfirmed ? (
                      <div className="flex gap-0.5 justify-center">
                        {['yes', 'maybe', 'no'].map((s) => (
                          <button
                            key={s}
                            disabled={saving}
                            onClick={() => respond(opt.id, s)}
                            title={STATUS_LABELS[s]}
                            className={`w-7 h-7 rounded text-xs font-bold border transition-colors ${
                              cur === s
                                ? s === 'yes'
                                  ? 'bg-green-500 text-white border-green-500'
                                  : s === 'maybe'
                                  ? 'bg-yellow-400 text-white border-yellow-400'
                                  : 'bg-red-400 text-white border-red-400'
                                : 'border-gray-200 text-gray-300 hover:border-gray-400 hover:text-gray-500'
                            }`}
                          >
                            {s === 'yes' ? '✓' : s === 'maybe' ? '?' : '✗'}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cur ? STATUS_COLORS[cur] : 'text-gray-300'}`}>
                        {cur ? STATUS_LABELS[cur] : '—'}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>

            {/* Other voters */}
            {otherVoters.map((voter) => (
              <tr key={voter.id} className="border-t border-gray-50">
                <td className="py-2 pr-4 text-xs text-gray-600 truncate max-w-[7rem]">
                  {voter.friendly_name || voter.email?.split('@')[0]}
                </td>
                {poll.options?.map((opt) => {
                  const status = getResponse(voter.id, opt.id)
                  return (
                    <td key={opt.id} className="py-2 px-2 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${status ? STATUS_COLORS[status] : 'text-gray-200'}`}>
                        {status ? STATUS_LABELS[status] : '—'}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Organizer: confirm a date (open polls only) */}
      {isOrganizer && !isConfirmed && (
        <div className="px-5 pb-4 border-t pt-3">
          <p className="text-xs text-gray-400 mb-2">Confirm a date:</p>
          <div className="flex flex-wrap gap-2">
            {poll.options?.map((opt) => (
              <button
                key={opt.id}
                disabled={saving}
                onClick={() => confirm(opt.id)}
                className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                {formatDate(opt.date)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Farewell gift — confirmed polls, non-organizer only */}
      {isConfirmed && !isOrganizer && (
        <div className="px-5 pb-4 border-t pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-700">Farewell gift 🎁</p>
              {poll.farewell_payment_url ? (
                <a
                  href={poll.farewell_payment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-600 hover:underline break-all"
                >
                  {poll.farewell_payment_url}
                </a>
              ) : (
                <p className="text-xs text-gray-400">No payment link yet</p>
              )}
            </div>
            <button
              onClick={() => setShowFarewellInput((v) => !v)}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium shrink-0"
            >
              {poll.farewell_payment_url ? 'Edit' : 'Add link'}
            </button>
          </div>
          {showFarewellInput && (
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-300"
                placeholder="https://tikkie.me/…"
                value={farewell}
                onChange={(e) => setFarewell(e.target.value)}
              />
              <button
                onClick={saveFarewell}
                disabled={farewellSaving}
                className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {farewellSaving ? '…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main PollView ─────────────────────────────────────────────────────────────

export default function PollView({ polls, me, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="space-y-4">
      {polls.map((p) => (
        <PollCard key={p.id} poll={p} me={me} onRefresh={onRefresh} />
      ))}

      {showCreate ? (
        <CreatePollForm
          onCreated={async () => { await onRefresh(); setShowCreate(false) }}
          onCancel={() => setShowCreate(false)}
        />
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors font-medium"
        >
          + Plan an activity
        </button>
      )}
    </div>
  )
}

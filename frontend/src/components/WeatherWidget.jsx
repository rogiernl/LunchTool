import { useState, useEffect } from 'react'
import { api } from '../api'

// SVG weather icons — inline, no dependency
function SunIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      <line x1="12" y1="2" x2="12" y2="5" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="22" strokeLinecap="round" />
      <line x1="2" y1="12" x2="5" y2="12" strokeLinecap="round" />
      <line x1="19" y1="12" x2="22" y2="12" strokeLinecap="round" />
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" strokeLinecap="round" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" strokeLinecap="round" />
      <line x1="19.78" y1="4.22" x2="17.66" y2="6.34" strokeLinecap="round" />
      <line x1="6.34" y1="17.66" x2="4.22" y2="19.78" strokeLinecap="round" />
    </svg>
  )
}

function CloudIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 10a6 6 0 10-11.8 1.5A4 4 0 104 19h14a4 4 0 000-8z" />
    </svg>
  )
}

function PartlyCloudyIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <circle cx="9" cy="9" r="3.5" fill="#FCD34D" />
      <line x1="9" y1="2" x2="9" y2="4" stroke="#FCD34D" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9" y1="14" x2="9" y2="16" stroke="#FCD34D" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="2" y1="9" x2="4" y2="9" stroke="#FCD34D" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="14" y1="9" x2="16" y2="9" stroke="#FCD34D" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="3.93" y1="3.93" x2="5.34" y2="5.34" stroke="#FCD34D" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12.66" y1="12.66" x2="14.07" y2="14.07" stroke="#FCD34D" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 13a5 5 0 10-9.8 1.3A3.5 3.5 0 103.5 21h13a3.5 3.5 0 000-7z" fill="#94A3B8" />
    </svg>
  )
}

function RainIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M18 8a6 6 0 10-11.8 1.5A4 4 0 104 17h14a4 4 0 000-8z" fill="#94A3B8" />
      <line x1="8" y1="19" x2="7" y2="22" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="19" x2="11" y2="22" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16" y1="19" x2="15" y2="22" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ThunderIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M18 8a6 6 0 10-11.8 1.5A4 4 0 104 17h14a4 4 0 000-8z" fill="#94A3B8" />
      <polyline points="13,11 10,17 13,17 10,23" fill="none" stroke="#FBBF24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SnowIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M18 8a6 6 0 10-11.8 1.5A4 4 0 104 17h14a4 4 0 000-8z" fill="#94A3B8" />
      <line x1="12" y1="18" x2="12" y2="23" stroke="#BAE6FD" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9.5" y1="19.5" x2="14.5" y2="21.5" stroke="#BAE6FD" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="14.5" y1="19.5" x2="9.5" y2="21.5" stroke="#BAE6FD" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function FogIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round">
      <line x1="3" y1="8" x2="21" y2="8" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="5" y1="16" x2="19" y2="16" />
    </svg>
  )
}

function MoonIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function WeatherIcon({ image, className = 'w-6 h-6' }) {
  const n = image ?? ''
  if (n.startsWith('zonnig') && !n.includes('nacht')) return <SunIcon className={`${className} text-yellow-400`} />
  if (n.includes('nacht') || n.includes('nacht') || n === 'heldenacht') return <MoonIcon className={`${className} text-indigo-300`} />
  if (n === 'onweer') return <ThunderIcon className={className} />
  if (n.includes('sneeuw') || n.includes('hagel')) return <SnowIcon className={className} />
  if (n.includes('regen') || n.includes('buien') || n.includes('motregen')) return <RainIcon className={className} />
  if (n === 'mist') return <FogIcon className={className} />
  if (n.includes('halfbewolkt') || n.includes('lichtbewolkt')) return <PartlyCloudyIcon className={className} />
  if (n.includes('bewolkt') || n.includes('wolken')) return <CloudIcon className={`${className} text-slate-400`} />
  return <SunIcon className={`${className} text-yellow-400`} />
}

function RainDropIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C12 2 5 10.5 5 15a7 7 0 0014 0C19 10.5 12 2 12 2z" />
    </svg>
  )
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null)

  useEffect(() => {
    api.getWeather().then(setWeather).catch(() => {})
    const t = setInterval(() => api.getWeather().then(setWeather).catch(() => {}), 15 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  if (!weather) return null

  const lunch = weather.lunch
  const hasRain = lunch && lunch.rain_mm > 0
  const heavyRain = lunch && lunch.rain_mm >= 2

  return (
    <div className="flex items-center gap-3 text-sm">
      {/* Current conditions — small, secondary */}
      <div className="flex items-center gap-1 text-xs text-gray-400 hidden sm:flex">
        <WeatherIcon image={weather.image} className="w-4 h-4" />
        <span>{weather.temp}°C</span>
      </div>

      {/* Lunch window — primary */}
      {lunch && (
        <div className={`flex items-center gap-1.5 border-l border-gray-200 pl-3 ${hasRain ? 'text-blue-700' : 'text-gray-700'}`}>
          <span className="text-gray-400 text-xs hidden sm:inline">expected lunch</span>
          <WeatherIcon image={lunch.image} className="w-5 h-5" />
          <span className="font-semibold">{lunch.temp}°</span>
          {hasRain ? (
            <span className={`flex items-center gap-0.5 font-semibold ${heavyRain ? 'text-blue-600' : 'text-blue-400'}`}>
              <RainDropIcon className="w-3 h-3" />
              {lunch.rain_mm}mm
            </span>
          ) : (
            <span className="text-xs text-green-600 font-medium hidden md:inline">no rain</span>
          )}
        </div>
      )}

      <span className="text-gray-400 text-xs hidden lg:inline">
        {weather.wind_bft} bft {weather.wind_dir}
      </span>
    </div>
  )
}

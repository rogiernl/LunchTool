import QRCode from 'react-qr-code'

export default function QRDisplay({ value, size = 180 }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative rounded-2xl overflow-hidden shadow-lg">
        {/* Warm gradient border frame */}
        <div className="p-1 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl">
          <div className="bg-orange-50 rounded-xl p-4 relative">
            <QRCode
              value={value}
              size={size}
              fgColor="#7c2d12"
              bgColor="#fff7ed"
              level="M"
            />
            {/* Centre logo cutout */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-orange-50 rounded-lg p-1.5 shadow-sm border border-orange-200">
                <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                  <path d="M7 15h2M12 15h5" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-orange-600 hover:text-orange-800 hover:underline break-all text-center max-w-xs"
      >
        {value}
      </a>
    </div>
  )
}

import { cn } from '../../ui/cn'

type BlobTone = 'violet' | 'indigo' | 'sky' | 'amber' | 'emerald' | 'rose'
type BlobPreset = 'hero' | 'light' | 'pricing' | 'section'

const BLOB_PATH =
  'M39.5,-65.2C51.1,-58.5,60.8,-47.8,68.2,-35.2C75.6,-22.6,80.7,-8.1,79.8,6.1C78.9,20.3,72,34.2,62.1,45.8C52.2,57.4,39.3,66.7,24.8,71.8C10.3,76.9,-5.8,77.8,-20.8,73.2C-35.8,68.6,-49.7,58.5,-60.1,45.6C-70.5,32.7,-77.4,17,-78.5,0.6C-79.6,-15.8,-75,-31.9,-65.8,-44.8C-56.6,-57.7,-42.8,-67.4,-27.8,-73.4C-12.8,-79.4,3.4,-81.7,18.6,-78.9C33.8,-76.1,27.9,-72,39.5,-65.2Z'

const TONE_CLASS: Record<BlobTone, string> = {
  violet: 'marketing-blob-tone-violet',
  indigo: 'marketing-blob-tone-indigo',
  sky: 'marketing-blob-tone-sky',
  amber: 'marketing-blob-tone-amber',
  emerald: 'marketing-blob-tone-emerald',
  rose: 'marketing-blob-tone-rose',
}

const PRESETS: Record<
  BlobPreset,
  Array<{
    tone: BlobTone
    className: string
    animation: 'float' | 'float-slow' | 'drift'
    opacity?: number
  }>
> = {
  hero: [
    { tone: 'indigo', className: 'right-[-12%] top-[8%] h-[32rem] w-[32rem]', animation: 'float-slow', opacity: 0.55 },
    { tone: 'violet', className: 'bottom-[-18%] left-[-10%] h-96 w-96', animation: 'drift', opacity: 0.45 },
    { tone: 'sky', className: 'left-[38%] top-[28%] h-72 w-72', animation: 'float', opacity: 0.35 },
    { tone: 'rose', className: 'right-[18%] bottom-[12%] h-56 w-56', animation: 'float-slow', opacity: 0.25 },
  ],
  light: [
    { tone: 'violet', className: 'right-[-8%] top-[-6%] h-80 w-80', animation: 'float-slow', opacity: 0.22 },
    { tone: 'sky', className: 'bottom-[-12%] left-[-6%] h-72 w-72', animation: 'drift', opacity: 0.18 },
  ],
  section: [
    { tone: 'indigo', className: 'right-[-6%] top-[10%] h-64 w-64', animation: 'float', opacity: 0.16 },
    { tone: 'emerald', className: 'bottom-[-8%] left-[4%] h-56 w-56', animation: 'float-slow', opacity: 0.14 },
  ],
  pricing: [
    { tone: 'violet', className: 'left-[-10%] top-[-8%] h-96 w-96', animation: 'drift', opacity: 0.2 },
    { tone: 'amber', className: 'right-[-8%] bottom-[-10%] h-80 w-80', animation: 'float-slow', opacity: 0.18 },
    { tone: 'indigo', className: 'left-[42%] top-[20%] h-64 w-64', animation: 'float', opacity: 0.12 },
  ],
}

function BlobShape({
  tone,
  className,
  animation,
  opacity = 0.4,
}: {
  tone: BlobTone
  className: string
  animation: 'float' | 'float-slow' | 'drift'
  opacity?: number
}) {
  return (
    <div
      className={cn(
        'marketing-blob pointer-events-none absolute',
        TONE_CLASS[tone],
        animation === 'float' && 'marketing-blob-float',
        animation === 'float-slow' && 'marketing-blob-float-slow',
        animation === 'drift' && 'marketing-blob-drift',
        className,
      )}
      style={{ opacity }}
      aria-hidden
    >
      <svg viewBox="0 0 200 200" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <path d={BLOB_PATH} fill="currentColor" />
      </svg>
    </div>
  )
}

export function MarketingBlobs({
  preset = 'hero',
  className,
}: {
  preset?: BlobPreset
  className?: string
}) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {PRESETS[preset].map((blob) => (
        <BlobShape key={`${preset}-${blob.tone}-${blob.className}`} {...blob} />
      ))}
    </div>
  )
}

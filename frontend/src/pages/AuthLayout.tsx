import type { ReactNode } from 'react'

const ROUTE = [
  { name: 'Wishlist', color: 'var(--color-stage-0)' },
  { name: 'Applied', color: 'var(--color-stage-1)' },
  { name: 'Interviewing', color: 'var(--color-stage-2)' },
  { name: 'Offer', color: 'var(--color-stage-3)' },
]

/** The pipeline drawn as a route: this is the app's signature motif. */
function RouteMap() {
  return (
    <ol className="relative space-y-7 pl-9" aria-hidden>
      <span className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-white/25" />
      {ROUTE.map((stop) => (
        <li key={stop.name} className="relative text-lg text-white/90">
          <span
            className="absolute -left-9 top-1 size-6 rounded-full border-4 border-ink"
            style={{ background: stop.color, boxShadow: '0 0 0 2px rgba(255,255,255,.5)' }}
          />
          {stop.name}
        </li>
      ))}
    </ol>
  )
}

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <p className="font-display text-xl font-bold">CareerPipeline</p>
        <div>
          <h2 className="mb-10 max-w-sm text-4xl font-bold leading-tight">
            Every application, from wishlist to offer.
          </h2>
          <RouteMap />
        </div>
        <p className="max-w-xs text-sm text-white/60">
          Drag cards between stages, keep notes on each company, and see where your search stands.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <p className="mb-8 font-display text-xl font-bold lg:hidden">CareerPipeline</p>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 mb-8 text-ink-soft">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  )
}

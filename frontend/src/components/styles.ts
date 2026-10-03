/** Shared class strings, so buttons and inputs look the same everywhere. */
const button =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap min-h-9 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-60'

export const btnPrimary = `${button} bg-signal text-white hover:bg-signal-strong`
export const btnSecondary = `${button} border border-line bg-surface text-ink hover:bg-mist`
export const btnDanger = `${button} bg-danger text-white hover:opacity-90`
export const btnGhost = `${button} text-ink-soft hover:bg-mist hover:text-ink`
export const btnDangerGhost = `${button} text-danger hover:bg-danger-soft`

export const inputClass =
  'block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/70'

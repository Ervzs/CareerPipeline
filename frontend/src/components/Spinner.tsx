export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-10 text-ink-soft">
      <span
        aria-hidden
        className="size-5 animate-spin rounded-full border-2 border-line border-t-signal"
      />
      <span className="text-sm">{label}…</span>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { StageBars } from '../components/dashboard/StageBars'
import { WeeklyBars } from '../components/dashboard/WeeklyBars'
import { Spinner } from '../components/Spinner'
import { btnPrimary, btnSecondary } from '../components/styles'
import { useDashboard } from '../lib/queries'
import type { Dashboard } from '../lib/types'

function responseCaption({ responded, applied, baseline_stage }: Dashboard['response_rate']) {
  if (applied === 0) return 'Give your applications a date applied to see this.'
  const past = baseline_stage ? `past ${baseline_stage}` : 'further'
  return `${responded} of ${applied} applications moved ${past}.`
}

export default function DashboardPage() {
  const dashboard = useDashboard()

  if (dashboard.isPending) return <Spinner label="Loading your numbers" />

  if (dashboard.isError) {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">Couldn't load the dashboard</h1>
        <p className="mt-2 text-ink-soft">Check your connection, then try again.</p>
        <button
          type="button"
          className={`${btnSecondary} mt-4`}
          onClick={() => void dashboard.refetch()}
        >
          Try again
        </button>
      </main>
    )
  }

  const { totals, stages, weeks, response_rate: response } = dashboard.data

  if (totals.applications === 0) {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">Nothing to chart yet</h1>
        <p className="mt-2 text-ink-soft">
          Add a few applications and this page will show where they stand.
        </p>
        <Link to="/" className={`${btnPrimary} mt-4`}>
          Go to the board
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <dl className="mt-5 grid grid-cols-1 gap-x-10 gap-y-4 border-y border-line py-5 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-ink-soft">Applications</dt>
          <dd className="font-display text-3xl font-bold">{totals.applications}</dd>
          <dd className="text-sm text-ink-soft">
            {totals.applications - totals.applied} not sent yet
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">Applied</dt>
          <dd className="font-display text-3xl font-bold">{totals.applied}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">Response rate</dt>
          <dd className="font-display text-3xl font-bold">
            {response.rate === null ? '–' : `${Math.round(response.rate * 100)}%`}
          </dd>
          <dd className="text-sm text-ink-soft">{responseCaption(response)}</dd>
        </div>
      </dl>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="per-stage">
          <h2 id="per-stage" className="mb-4 text-lg font-bold">
            Applications per stage
          </h2>
          <StageBars stages={stages} />
        </section>
        <section aria-labelledby="per-week">
          <h2 id="per-week" className="mb-4 text-lg font-bold">
            Applications per week
          </h2>
          <WeeklyBars weeks={weeks} />
          <p className="mt-2 text-sm text-ink-soft">The last 12 weeks, by date applied.</p>
        </section>
      </div>
    </main>
  )
}

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { json, renderWithProviders } from '../test/utils'
import DashboardPage from './DashboardPage'

const fetchMock = vi.fn<typeof fetch>()

const weeks = (counts: number[]) =>
  counts.map((count, i) => ({
    week_start: new Date(2026, 5, 15 + i * 7).toISOString().slice(0, 10),
    count,
  }))

const dashboard = (overrides = {}) => ({
  totals: { applications: 7, applied: 5 },
  stages: [
    { stage: 1, name: 'Wishlist', order: 0, count: 2 },
    { stage: 2, name: 'Applied', order: 1, count: 3 },
    { stage: 3, name: 'Interviewing', order: 2, count: 2 },
    { stage: 4, name: 'Offer', order: 3, count: 0 },
  ],
  weeks: weeks([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 3, 1]),
  response_rate: { baseline_stage: 'Applied', responded: 2, applied: 5, rate: 0.4 },
  ...overrides,
})

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

test('shows totals, the response rate and what it means', async () => {
  fetchMock.mockResolvedValue(json(200, dashboard()))
  renderWithProviders(<DashboardPage />)

  expect(screen.getByRole('status')).toHaveTextContent('Loading your numbers')
  expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  expect(screen.getByText('40%')).toBeInTheDocument()
  expect(screen.getByText('2 of 5 applications moved past Applied.')).toBeInTheDocument()
  expect(screen.getByText('2 not sent yet')).toBeInTheDocument()
})

test('lists every stage, including empty ones, with its count', async () => {
  fetchMock.mockResolvedValue(json(200, dashboard()))
  renderWithProviders(<DashboardPage />)

  const list = await screen.findByRole('list', { name: 'Applications per stage' })
  const rows = within(list).getAllByRole('listitem')
  expect(rows.map((row) => row.textContent)).toEqual([
    'Wishlist2',
    'Applied3',
    'Interviewing2',
    'Offer0',
  ])
})

test('draws twelve weekly bars with accessible labels', async () => {
  fetchMock.mockResolvedValue(json(200, dashboard()))
  renderWithProviders(<DashboardPage />)

  const list = await screen.findByRole('list', { name: 'Applications per week' })
  const bars = within(list).getAllByRole('listitem')
  expect(bars).toHaveLength(12)
  expect(bars[10]).toHaveAccessibleName(/^3 applications, week of /)
})

test('with nothing applied yet the rate is a dash and explains what to do', async () => {
  fetchMock.mockResolvedValue(
    json(
      200,
      dashboard({
        totals: { applications: 2, applied: 0 },
        response_rate: { baseline_stage: 'Applied', responded: 0, applied: 0, rate: null },
      }),
    ),
  )
  renderWithProviders(<DashboardPage />)

  expect(await screen.findByText('–')).toBeInTheDocument()
  expect(screen.getByText('Give your applications a date applied to see this.')).toBeInTheDocument()
})

test('an account with no applications gets an invitation instead of empty charts', async () => {
  fetchMock.mockResolvedValue(
    json(
      200,
      dashboard({
        totals: { applications: 0, applied: 0 },
        response_rate: { baseline_stage: 'Applied', responded: 0, applied: 0, rate: null },
      }),
    ),
  )
  renderWithProviders(<DashboardPage />)

  expect(await screen.findByText('Nothing to chart yet')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to the board' })).toHaveAttribute('href', '/')
  expect(screen.queryByRole('list', { name: 'Applications per stage' })).not.toBeInTheDocument()
})

test('a failed load can be retried', async () => {
  fetchMock.mockResolvedValue(json(500))
  renderWithProviders(<DashboardPage />)
  expect(await screen.findByText("Couldn't load the dashboard")).toBeInTheDocument()

  fetchMock.mockResolvedValue(json(200, dashboard()))
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
})

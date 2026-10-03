import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { json, makeApplication, makeStage, renderWithProviders } from '../test/utils'
import BoardPage from './BoardPage'

const fetchMock = vi.fn<typeof fetch>()

const stages = [makeStage(1, 'Wishlist', 0), makeStage(2, 'Applied', 1), makeStage(3, 'Offer', 2)]

function serve(applications: unknown[]) {
  fetchMock.mockImplementation(async (url) =>
    String(url).endsWith('/api/stages/') ? json(200, stages) : json(200, applications),
  )
}

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

test('shows a loading state, then one column per stage with its cards in order', async () => {
  serve([
    makeApplication({ id: 1, stage: 2, position: 0, job_title: 'First' }),
    makeApplication({ id: 2, stage: 2, position: 1, job_title: 'Second' }),
    makeApplication({ id: 3, stage: 3, job_title: 'Offer job' }),
  ])

  renderWithProviders(<BoardPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading your pipeline')

  const applied = await screen.findByRole('region', { name: 'Applied' })
  const titles = within(applied)
    .getAllByRole('button')
    .map((card) => within(card).getByText(/First|Second/).textContent)
  expect(titles).toEqual(['First', 'Second'])
  expect(within(applied).getByLabelText('2 applications')).toBeInTheDocument()
  expect(screen.getAllByRole('region')).toHaveLength(3)
})

test('empty columns invite the user to add something', async () => {
  serve([makeApplication({ id: 1, stage: 2 })])

  renderWithProviders(<BoardPage />)

  const wishlist = await screen.findByRole('region', { name: 'Wishlist' })
  expect(within(wishlist).getByText('No applications here yet')).toBeInTheDocument()
})

test('a board with no applications at all explains what to do', async () => {
  serve([])

  renderWithProviders(<BoardPage />)

  expect(await screen.findByText(/No applications yet/)).toBeInTheDocument()
  expect(screen.getAllByText('No applications here yet')).toHaveLength(3)
})

test('a failed load shows an error and can be retried', async () => {
  fetchMock.mockResolvedValue(json(500))
  renderWithProviders(<BoardPage />)
  expect(await screen.findByText("Couldn't load your pipeline")).toBeInTheDocument()

  serve([])
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('region', { name: 'Wishlist' })).toBeInTheDocument()
})

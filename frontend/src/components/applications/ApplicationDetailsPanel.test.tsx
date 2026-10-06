import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { json, makeApplication, makeStage, renderWithProviders } from '../../test/utils'
import { ApplicationDetailsPanel } from './ApplicationDetailsPanel'

const fetchMock = vi.fn<typeof fetch>()
const stages = [makeStage(1, 'Wishlist', 0), makeStage(2, 'Applied', 1)]

const full = makeApplication({
  id: 5,
  stage: 2,
  job_title: 'Backend Engineer',
  job_description: 'Build APIs.\nWork with the team.',
  listing_url: 'https://jobs.acme.test/backend',
  date_applied: '2026-02-01',
  company_detail: {
    id: 1,
    name: 'Acme',
    website: 'https://acme.test',
    notes: 'Remote friendly.',
  },
}) as never

// Requests that change data (the panel also GETs the activity list when it opens).
const changes = () =>
  fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET')

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async () => json(200, []))
})
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

test('shows the application details and the linked company notes', () => {
  renderWithProviders(
    <ApplicationDetailsPanel application={full} stages={stages} onClose={() => {}} />,
  )

  const panel = screen.getByRole('complementary', { name: 'Application details' })
  expect(within(panel).getByRole('heading', { name: 'Backend Engineer' })).toBeInTheDocument()
  expect(within(panel).getByText('Applied')).toBeInTheDocument()
  expect(within(panel).getByText(/Feb 1, 2026|1 Feb 2026|2026/)).toBeInTheDocument()
  expect(within(panel).getByText(/Build APIs\./)).toBeInTheDocument()
  expect(within(panel).getByText('Remote friendly.')).toBeInTheDocument()

  const listing = within(panel).getByRole('link', { name: /jobs\.acme\.test/ })
  expect(listing).toHaveAttribute('href', 'https://jobs.acme.test/backend')
  expect(listing).toHaveAttribute('target', '_blank')
  expect(listing).toHaveAttribute('rel', expect.stringContaining('noopener'))
})

test('empty fields explain what to do instead of showing blanks', () => {
  const bare = makeApplication({ id: 6, stage: 1 }) as never
  renderWithProviders(
    <ApplicationDetailsPanel application={bare} stages={stages} onClose={() => {}} />,
  )

  expect(screen.getByText('Not applied yet')).toBeInTheDocument()
  expect(screen.getByText(/No description yet/)).toBeInTheDocument()
  expect(screen.getByText('No notes about this company yet.')).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

test('hides the company section when there is no company', () => {
  const noCompany = makeApplication({ id: 8, company: null, company_detail: null }) as never
  renderWithProviders(
    <ApplicationDetailsPanel application={noCompany} stages={stages} onClose={() => {}} />,
  )

  expect(screen.queryByText(/About /)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit company' })).not.toBeInTheDocument()
})

test('never renders a javascript: listing URL as a link', () => {
  const evil = makeApplication({ id: 7, listing_url: 'javascript:alert(1)' }) as never
  renderWithProviders(
    <ApplicationDetailsPanel application={evil} stages={stages} onClose={() => {}} />,
  )

  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByText('Invalid link')).toBeInTheDocument()
})

test('delete asks for confirmation, then deletes and closes', async () => {
  const onClose = vi.fn()
  renderWithProviders(
    <ApplicationDetailsPanel application={full} stages={stages} onClose={onClose} />,
  )

  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(changes()).toHaveLength(0) // nothing is sent before confirming
  fetchMock.mockResolvedValueOnce(json(204))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))

  await waitFor(() => expect(onClose).toHaveBeenCalled())
  const [[url, init]] = changes()
  expect(init?.method).toBe('DELETE')
  expect(String(url)).toMatch(/\/api\/applications\/5\/$/)
})

test('choosing "Keep it" cancels the delete', async () => {
  renderWithProviders(
    <ApplicationDetailsPanel application={full} stages={stages} onClose={() => {}} />,
  )

  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))

  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(changes()).toHaveLength(0)
})

test('Edit opens the form and Edit company opens the company form', async () => {
  renderWithProviders(
    <ApplicationDetailsPanel application={full} stages={stages} onClose={() => {}} />,
  )

  await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
  expect(await screen.findByRole('dialog', { name: 'Edit application' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

  await userEvent.click(screen.getByRole('button', { name: 'Edit company' }))
  expect(await screen.findByRole('dialog', { name: 'Edit Acme' })).toBeInTheDocument()
  expect(screen.getByLabelText('Notes')).toHaveValue('Remote friendly.')
})

test('Escape closes the panel', async () => {
  const onClose = vi.fn()
  renderWithProviders(
    <ApplicationDetailsPanel application={full} stages={stages} onClose={onClose} />,
  )

  screen.getByRole('complementary').focus()
  await userEvent.keyboard('{Escape}')

  expect(onClose).toHaveBeenCalled()
})

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { json, renderWithProviders } from '../../test/utils'
import { ActivityTimeline } from './ActivityTimeline'

const fetchMock = vi.fn<typeof fetch>()

const activity = (id: number, overrides = {}) => ({
  id,
  application: 5,
  kind: 'call',
  note: `note ${id}`,
  occurred_at: '2026-03-04T10:30:00Z',
  created_at: '2026-03-04T10:31:00Z',
  ...overrides,
})

const changes = () =>
  fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET')
const sentBody = (method: string) => {
  const call = changes().find(([, init]) => init?.method === method)
  return call ? JSON.parse(String(call[1]!.body)) : undefined
}
const urlOf = (method: string) => String(changes().find(([, init]) => init?.method === method)![0])

let notes: ReturnType<typeof activity>[] = []

beforeEach(() => {
  notes = []
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async (_url, init) => {
    if (init?.method === 'POST') return json(201, activity(99))
    if (init?.method === 'PATCH') return json(200, activity(1))
    if (init?.method === 'DELETE') return json(204)
    return json(200, notes)
  })
})
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

test('lists notes in the order the API returns them (newest first) with kind and note', async () => {
  notes = [
    activity(2, { kind: 'interview', note: 'Technical round' }),
    activity(1, { kind: 'follow_up', note: 'Sent a thank-you email' }),
  ]
  renderWithProviders(<ActivityTimeline applicationId={5} />)

  const list = await screen.findByRole('list', { name: 'Activity' })
  const entries = within(list).getAllByRole('listitem')
  expect(entries).toHaveLength(2)
  expect(entries[0]).toHaveTextContent('Interview')
  expect(entries[0]).toHaveTextContent('Technical round')
  expect(entries[1]).toHaveTextContent('Follow-up')
  expect(entries[1]).toHaveTextContent('Sent a thank-you email')
})

test('an application without notes invites the user to log one', async () => {
  renderWithProviders(<ActivityTimeline applicationId={5} />)

  expect(await screen.findByText(/No activity yet/)).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Activity' })).not.toBeInTheDocument()
})

test('adds a note with its type, time and text', async () => {
  renderWithProviders(<ActivityTimeline applicationId={5} />)
  await screen.findByText(/No activity yet/)

  await userEvent.click(screen.getByRole('button', { name: 'Add note' }))
  await userEvent.selectOptions(screen.getByLabelText('Type'), 'Interview')
  await userEvent.type(screen.getByLabelText('Note'), 'Panel interview with the team')
  await userEvent.click(screen.getByRole('button', { name: 'Add note' }))

  await waitFor(() => expect(sentBody('POST')).toBeDefined())
  expect(sentBody('POST')).toMatchObject({
    kind: 'interview',
    note: 'Panel interview with the team',
  })
  expect(Number.isNaN(Date.parse(sentBody('POST').occurred_at))).toBe(false)
  expect(urlOf('POST')).toMatch(/\/api\/applications\/5\/activities\/$/)
  await waitFor(() => expect(screen.queryByLabelText('Note')).not.toBeInTheDocument())
})

test('shows the API message when the note is empty and keeps the form open', async () => {
  renderWithProviders(<ActivityTimeline applicationId={5} />)
  await screen.findByText(/No activity yet/)
  await userEvent.click(screen.getByRole('button', { name: 'Add note' }))
  fetchMock.mockResolvedValueOnce(
    json(400, {
      error: {
        code: 'validation_error',
        message: 'Invalid input.',
        details: { note: ['This field may not be blank.'] },
      },
    }),
  )

  await userEvent.click(screen.getByRole('button', { name: 'Add note' }))

  expect(await screen.findByText('This field may not be blank.')).toBeInTheDocument()
  expect(screen.getByLabelText('Note')).toBeInTheDocument()
})

test('edits a note', async () => {
  notes = [activity(1, { kind: 'call', note: 'Left a voicemail' })]
  renderWithProviders(<ActivityTimeline applicationId={5} />)

  await userEvent.click(await screen.findByRole('button', { name: 'Edit call note' }))
  const field = screen.getByLabelText('Note')
  expect(field).toHaveValue('Left a voicemail')
  await userEvent.clear(field)
  await userEvent.type(field, 'Spoke to them')
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }))

  await waitFor(() => expect(sentBody('PATCH')).toBeDefined())
  expect(sentBody('PATCH')).toMatchObject({ kind: 'call', note: 'Spoke to them' })
  expect(urlOf('PATCH')).toMatch(/\/api\/activities\/1\/$/)
})

test('deleting asks first, and "Keep it" cancels', async () => {
  notes = [activity(1)]
  renderWithProviders(<ActivityTimeline applicationId={5} />)

  await userEvent.click(await screen.findByRole('button', { name: 'Delete call note' }))
  expect(screen.getByText('Delete this note?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))

  expect(screen.getByRole('button', { name: 'Delete call note' })).toBeInTheDocument()
  expect(changes()).toHaveLength(0)
})

test('confirming deletes the note', async () => {
  notes = [activity(1)]
  renderWithProviders(<ActivityTimeline applicationId={5} />)

  await userEvent.click(await screen.findByRole('button', { name: 'Delete call note' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))

  await waitFor(() => expect(changes()).toHaveLength(1))
  expect(urlOf('DELETE')).toMatch(/\/api\/activities\/1\/$/)
})

test('a failed load can be retried', async () => {
  fetchMock.mockResolvedValue(json(500))
  renderWithProviders(<ActivityTimeline applicationId={5} />)
  expect(await screen.findByText(/Couldn't load the activity/)).toBeInTheDocument()

  notes = [activity(1, { note: 'Back again' })]
  fetchMock.mockImplementation(async () => json(200, notes))
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('Back again')).toBeInTheDocument()
})

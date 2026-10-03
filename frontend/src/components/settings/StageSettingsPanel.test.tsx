import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { json, makeStage, renderWithProviders } from '../../test/utils'
import { StageSettingsPanel } from './StageSettingsPanel'

const fetchMock = vi.fn<typeof fetch>()
let stages = [makeStage(1, 'Wishlist', 0), makeStage(2, 'Applied', 1)]

const apiError = (code: string, message: string, details = {}) => ({
  error: { code, message, details },
})
const requests = () =>
  fetchMock.mock.calls.map(
    ([url, init]) => `${init?.method ?? 'GET'} ${String(url).replace(/^.*\/api/, '')}`,
  )

beforeEach(() => {
  stages = [makeStage(1, 'Wishlist', 0), makeStage(2, 'Applied', 1)]
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async (url, init) => {
    const path = String(url)
    if (init?.method === 'POST' && path.endsWith('/api/stages/')) {
      const { name } = JSON.parse(String(init.body))
      stages = [...stages, makeStage(9, name, stages.length)]
      return json(201, stages.at(-1))
    }
    return json(200, stages)
  })
})
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

const open = async () => {
  renderWithProviders(<StageSettingsPanel onClose={() => {}} />)
  return screen.findByRole('list', { name: 'Stages' })
}

test('lists the stages in order', async () => {
  const list = await open()
  expect(
    within(list)
      .getAllByRole('listitem')
      .map((li) => li.textContent),
  ).toEqual([expect.stringContaining('Wishlist'), expect.stringContaining('Applied')])
})

test('adds a stage and clears the input', async () => {
  await open()

  await userEvent.type(screen.getByLabelText('New stage'), 'Phone screen')
  await userEvent.click(screen.getByRole('button', { name: 'Add stage' }))

  expect(await screen.findByRole('button', { name: 'Rename Phone screen' })).toBeInTheDocument()
  expect(screen.getByLabelText('New stage')).toHaveValue('')
  expect(requests()).toContain('POST /stages/')
})

test('shows the server message when the name is already used', async () => {
  await open()
  fetchMock.mockResolvedValueOnce(
    json(
      400,
      apiError('validation_error', 'Invalid input.', {
        name: ['You already have a stage with this name.'],
      }),
    ),
  )

  await userEvent.type(screen.getByLabelText('New stage'), 'applied')
  await userEvent.click(screen.getByRole('button', { name: 'Add stage' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'You already have a stage with this name.',
  )
})

test('renames a stage', async () => {
  await open()

  await userEvent.click(screen.getByRole('button', { name: 'Rename Applied' }))
  const input = screen.getByLabelText('Name for Applied')
  await userEvent.clear(input)
  await userEvent.type(input, 'Submitted')
  stages = [stages[0], makeStage(2, 'Submitted', 1)]
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Submitted')).toBeInTheDocument()
  expect(requests()).toContain('PATCH /stages/2/')
})

test('deleting a stage that still has applications shows the blocked-delete message', async () => {
  await open()
  fetchMock.mockResolvedValueOnce(
    json(
      409,
      apiError(
        'stage_not_empty',
        'This stage still contains applications. Move them to another stage first.',
      ),
    ),
  )

  await userEvent.click(screen.getByRole('button', { name: 'Delete Applied' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Move them to another stage first.')
  expect(screen.getByText('Applied')).toBeInTheDocument()
})

test('deleting an empty stage removes it', async () => {
  await open()
  fetchMock.mockResolvedValueOnce(json(204))
  stages = [stages[0]]

  await userEvent.click(screen.getByRole('button', { name: 'Delete Applied' }))

  await waitFor(() => expect(screen.queryByText('Applied')).not.toBeInTheDocument())
  expect(requests()).toContain('DELETE /stages/2/')
})

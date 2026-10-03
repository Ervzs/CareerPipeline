import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { json, makeApplication, renderWithProviders } from '../../test/utils'
import { CompaniesDialog } from './CompaniesDialog'

const fetchMock = vi.fn<typeof fetch>()
const companies = [
  { id: 1, name: 'Acme', website: '', notes: '' },
  { id: 2, name: 'Globex', website: '', notes: '' },
]

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async (url) =>
    String(url).endsWith('/api/companies/')
      ? json(200, companies)
      : json(200, [makeApplication({ id: 1, company: 1 }), makeApplication({ id: 2, company: 1 })]),
  )
})
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

test('lists companies with their application counts', async () => {
  renderWithProviders(<CompaniesDialog onClose={() => {}} />)

  expect(await screen.findByText('2 applications')).toBeInTheDocument()
  expect(screen.getByText('0 applications')).toBeInTheDocument()
})

test('a company with applications cannot be deleted and the server message is shown', async () => {
  renderWithProviders(<CompaniesDialog onClose={() => {}} />)
  await screen.findByText('2 applications')
  fetchMock.mockResolvedValueOnce(
    json(409, {
      error: {
        code: 'company_in_use',
        message: 'This company still has applications. Delete or reassign them first.',
        details: {},
      },
    }),
  )

  await userEvent.click(screen.getByRole('button', { name: 'Delete Acme' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Delete or reassign them first.')
  expect(screen.getByText('Acme')).toBeInTheDocument()
})

test('edits a company', async () => {
  renderWithProviders(<CompaniesDialog onClose={() => {}} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Globex' }))

  await userEvent.type(screen.getByLabelText('Notes'), 'Great culture')
  await userEvent.click(screen.getByRole('button', { name: 'Save company' }))

  await waitFor(() => {
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(String(patch[0])).toMatch(/\/api\/companies\/2\/$/)
    expect(JSON.parse(String(patch[1]!.body))).toMatchObject({
      name: 'Globex',
      notes: 'Great culture',
    })
  })
})

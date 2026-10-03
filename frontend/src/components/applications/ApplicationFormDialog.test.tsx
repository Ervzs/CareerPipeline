import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { json, makeApplication, makeStage, renderWithProviders } from '../../test/utils'
import { ApplicationFormDialog } from './ApplicationFormDialog'

const fetchMock = vi.fn<typeof fetch>()
const stages = [makeStage(1, 'Wishlist', 0), makeStage(2, 'Applied', 1)]
const companies = [{ id: 7, name: 'Acme', website: '', notes: '' }]

const sent = (method: string) => {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === method)
  return call ? JSON.parse(String(call[1]!.body)) : undefined
}

function serve(companyList = companies) {
  fetchMock.mockImplementation(async (url, init) => {
    if (init?.method === 'POST') return json(201, makeApplication())
    if (init?.method === 'PATCH') return json(200, makeApplication())
    return String(url).endsWith('/api/companies/') ? json(200, companyList) : json(200, [])
  })
}

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

test('creates an application for an existing company', async () => {
  serve()
  const onClose = vi.fn()
  renderWithProviders(
    <ApplicationFormDialog stages={stages} defaultStageId={2} onClose={onClose} />,
  )

  await userEvent.type(screen.getByLabelText('Job title'), 'Backend Engineer')
  await userEvent.selectOptions(await screen.findByLabelText('Company'), 'Acme')
  await userEvent.type(screen.getByLabelText('Date applied'), '2026-03-04')
  await userEvent.click(screen.getByRole('button', { name: 'Add application' }))

  await waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(sent('POST')).toMatchObject({
    company: 7,
    stage: 2,
    job_title: 'Backend Engineer',
    date_applied: '2026-03-04',
  })
  expect(sent('POST')).not.toHaveProperty('company_name')
})

test('creates a new company in the same request', async () => {
  serve()
  const onClose = vi.fn()
  renderWithProviders(<ApplicationFormDialog stages={stages} onClose={onClose} />)

  await userEvent.type(screen.getByLabelText('Job title'), 'SRE')
  await userEvent.selectOptions(await screen.findByLabelText('Company'), 'New company…')
  await userEvent.type(screen.getByLabelText('New company name'), 'Globex')
  await userEvent.click(screen.getByRole('button', { name: 'Add application' }))

  await waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(sent('POST')).toMatchObject({ company_name: 'Globex', stage: 1, date_applied: null })
  expect(sent('POST')).not.toHaveProperty('company')
})

test('with no saved companies it asks for a new company name straight away', async () => {
  serve([])
  renderWithProviders(<ApplicationFormDialog stages={stages} onClose={() => {}} />)

  expect(await screen.findByLabelText('New company name')).toBeInTheDocument()
})

test('shows field errors from the API and keeps the dialog open', async () => {
  serve()
  const onClose = vi.fn()
  renderWithProviders(<ApplicationFormDialog stages={stages} onClose={onClose} />)
  await screen.findByRole('option', { name: 'Acme' })
  fetchMock.mockResolvedValueOnce(
    json(400, {
      error: {
        code: 'validation_error',
        message: 'Invalid input.',
        details: { job_title: ['This field may not be blank.'], company: ['Pick a company.'] },
      },
    }),
  )

  await userEvent.click(screen.getByRole('button', { name: 'Add application' }))

  expect(await screen.findByText('This field may not be blank.')).toBeInTheDocument()
  expect(screen.getByText('Pick a company.')).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('edits an existing application with its values prefilled', async () => {
  serve()
  const application = makeApplication({
    id: 5,
    company: 7,
    job_title: 'Old title',
    date_applied: '2026-02-01',
    listing_url: 'https://acme.test/job',
  }) as never
  const onClose = vi.fn()
  renderWithProviders(
    <ApplicationFormDialog stages={stages} application={application} onClose={onClose} />,
  )

  const title = screen.getByLabelText('Job title')
  expect(title).toHaveValue('Old title')
  expect(screen.getByLabelText('Date applied')).toHaveValue('2026-02-01')
  expect(screen.queryByLabelText('Stage')).not.toBeInTheDocument()

  await userEvent.clear(title)
  await userEvent.type(title, 'New title')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(sent('PATCH')).toMatchObject({ company: 7, job_title: 'New title' })
  const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
  expect(String(patch[0])).toMatch(/\/api\/applications\/5\/$/)
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../components/toast/ToastProvider'

export const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status })

export function renderWithProviders(ui: ReactElement, route = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    ),
  }
}

export const makeStage = (id: number, name: string, order: number) => ({ id, name, order })

export const makeApplication = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  company: 1,
  company_detail: { id: 1, name: 'Acme', website: '', notes: '' },
  stage: 1,
  job_title: 'Engineer',
  job_description: '',
  listing_url: '',
  date_applied: null,
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

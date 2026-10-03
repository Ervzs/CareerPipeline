import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { ToastProvider } from './components/toast/ToastProvider'
import { setAccessToken } from './lib/api'

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status })
const fetchMock = vi.fn<typeof fetch>()

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken(null)
})
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

test('a logged-out visitor on a protected route lands on the login page', async () => {
  fetchMock.mockResolvedValue(json(401)) // silent refresh fails

  renderAt('/')

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
})

test('the demo button signs in and shows the board', async () => {
  fetchMock.mockResolvedValueOnce(json(401)) // silent refresh on load
  renderAt('/login')
  fetchMock.mockImplementation(async (url) => {
    const path = String(url)
    if (path.endsWith('/api/auth/login/')) return json(200, { access: 'demo-token' })
    if (path.endsWith('/api/auth/me/'))
      return json(200, { id: 9, email: 'demo@careerpipeline.dev' })
    return json(200, [])
  })

  await userEvent.click(await screen.findByRole('button', { name: 'Try the demo' }))

  expect(await screen.findByRole('heading', { name: 'Your pipeline' })).toBeInTheDocument()
  expect(screen.getByText('demo@careerpipeline.dev')).toBeInTheDocument()
})

test('wrong credentials show an error and stay on the login page', async () => {
  fetchMock.mockResolvedValueOnce(json(401))
  renderAt('/login')
  await userEvent.type(await screen.findByLabelText('Email'), 'a@b.test')
  await userEvent.type(screen.getByLabelText('Password'), 'wrong')

  fetchMock.mockResolvedValueOnce(
    json(401, { error: { code: 'no_active_account', message: 'No account.', details: {} } }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
  expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
})

test('registration shows the password rules returned by the API', async () => {
  fetchMock.mockResolvedValueOnce(json(401))
  renderAt('/register')
  await userEvent.type(await screen.findByLabelText('Email'), 'new@b.test')
  await userEvent.type(screen.getByLabelText('Password'), 'short')

  fetchMock.mockResolvedValueOnce(
    json(400, {
      error: {
        code: 'validation_error',
        message: 'Invalid input.',
        details: { password: ['This password is too short.', 'This password is too common.'] },
      },
    }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByText(/too short\. This password is too common/)).toBeInTheDocument()
})

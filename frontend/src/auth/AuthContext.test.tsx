import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getAccessToken, setAccessToken } from '../lib/api'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status })
const fetchMock = vi.fn<typeof fetch>()

function Probe() {
  const { status, user, login, logout } = useAuth()
  return (
    <div>
      <p>status: {status}</p>
      <p>user: {user?.email ?? 'none'}</p>
      <button onClick={() => login('a@b.test', 'pw')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  )
}

const renderProbe = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
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

test('a reload restores the session through the refresh cookie', async () => {
  fetchMock
    .mockResolvedValueOnce(json(200, { access: 'token-1' })) // refresh
    .mockResolvedValueOnce(json(200, { id: 1, email: 'me@example.com' })) // me

  renderProbe()
  expect(screen.getByText('status: loading')).toBeInTheDocument()

  await waitFor(() => expect(screen.getByText('status: authenticated')).toBeInTheDocument())
  expect(screen.getByText('user: me@example.com')).toBeInTheDocument()
  expect(getAccessToken()).toBe('token-1')
})

test('without a valid cookie the visitor is anonymous', async () => {
  fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'x', message: 'x', details: {} } }))

  renderProbe()

  await waitFor(() => expect(screen.getByText('status: anonymous')).toBeInTheDocument())
  expect(getAccessToken()).toBeNull()
})

test('login stores the access token in memory and loads the user', async () => {
  fetchMock.mockResolvedValueOnce(json(401)) // initial silent refresh fails
  renderProbe()
  await waitFor(() => expect(screen.getByText('status: anonymous')).toBeInTheDocument())

  fetchMock
    .mockResolvedValueOnce(json(200, { access: 'token-2' })) // login
    .mockResolvedValueOnce(json(200, { id: 2, email: 'a@b.test' })) // me
  await userEvent.click(screen.getByText('login'))

  await waitFor(() => expect(screen.getByText('user: a@b.test')).toBeInTheDocument())
  expect(getAccessToken()).toBe('token-2')
})

test('logout clears the token and the user even if the request fails', async () => {
  fetchMock
    .mockResolvedValueOnce(json(200, { access: 'token-1' }))
    .mockResolvedValueOnce(json(200, { id: 1, email: 'me@example.com' }))
  renderProbe()
  await waitFor(() => expect(screen.getByText('status: authenticated')).toBeInTheDocument())

  fetchMock.mockRejectedValueOnce(new Error('network down'))
  await userEvent.click(screen.getByText('logout'))

  await waitFor(() => expect(screen.getByText('status: anonymous')).toBeInTheDocument())
  expect(getAccessToken()).toBeNull()
})

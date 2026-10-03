import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api, ApiError, getAccessToken, setAccessToken, setSessionExpiredHandler } from './api'

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status })

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken(null)
  setSessionExpiredHandler(null)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

const calls = () => fetchMock.mock.calls.map(([url]) => String(url).replace(/^.*\/api/, '/api'))

test('sends the access token and the cookie credentials', async () => {
  setAccessToken('abc')
  fetchMock.mockResolvedValueOnce(json(200, [{ id: 1 }]))

  expect(await api('/api/stages/')).toEqual([{ id: 1 }])

  const init = fetchMock.mock.calls[0][1]!
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc')
  expect(init.credentials).toBe('include')
})

test('on 401 it refreshes once and retries with the new token', async () => {
  setAccessToken('expired')
  fetchMock
    .mockResolvedValueOnce(
      json(401, { error: { code: 'token_not_valid', message: 'x', details: {} } }),
    )
    .mockResolvedValueOnce(json(200, { access: 'fresh' }))
    .mockResolvedValueOnce(json(200, { ok: true }))

  expect(await api('/api/stages/')).toEqual({ ok: true })

  expect(calls()).toEqual(['/api/stages/', '/api/auth/refresh/', '/api/stages/'])
  expect(getAccessToken()).toBe('fresh')
  const retryHeaders = fetchMock.mock.calls[2][1]!.headers as Record<string, string>
  expect(retryHeaders.Authorization).toBe('Bearer fresh')
})

test('parallel 401s share a single refresh request', async () => {
  setAccessToken('expired')
  fetchMock.mockImplementation(async (url, init) => {
    if (String(url).endsWith('/api/auth/refresh/')) return json(200, { access: 'fresh' })
    const { Authorization } = init!.headers as Record<string, string>
    return Authorization === 'Bearer expired' ? json(401) : json(200, {})
  })

  await Promise.all([api('/api/stages/'), api('/api/companies/'), api('/api/applications/')])

  expect(calls().filter((c) => c === '/api/auth/refresh/')).toHaveLength(1)
})

test('when refresh fails it signals session expiry and throws the 401', async () => {
  const expired = vi.fn()
  setSessionExpiredHandler(expired)
  setAccessToken('expired')
  fetchMock
    .mockResolvedValueOnce(
      json(401, { error: { code: 'not_authenticated', message: 'Nope', details: {} } }),
    )
    .mockResolvedValueOnce(
      json(401, { error: { code: 'no_refresh_cookie', message: 'x', details: {} } }),
    )

  await expect(api('/api/stages/')).rejects.toMatchObject({ status: 401 })

  expect(expired).toHaveBeenCalledOnce()
  expect(getAccessToken()).toBeNull()
})

test('skipAuthRetry never triggers a refresh (used by login)', async () => {
  fetchMock.mockResolvedValueOnce(
    json(401, { error: { code: 'no_active_account', message: 'Wrong credentials.', details: {} } }),
  )

  await expect(
    api('/api/auth/login/', { method: 'POST', body: {}, skipAuthRetry: true }),
  ).rejects.toThrow('Wrong credentials.')

  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('parses the error envelope including field errors', async () => {
  fetchMock.mockResolvedValueOnce(
    json(400, {
      error: {
        code: 'validation_error',
        message: 'Invalid input.',
        details: { email: ['Already used.'] },
      },
    }),
  )

  const error = await api('/api/auth/register/', { method: 'POST', body: {} }).catch((e) => e)

  expect(error).toBeInstanceOf(ApiError)
  expect(error.code).toBe('validation_error')
  expect(error.fieldError('email')).toBe('Already used.')
})

test('204 responses resolve to undefined', async () => {
  setAccessToken('abc')
  fetchMock.mockResolvedValueOnce(json(204))
  expect(await api('/api/stages/1/', { method: 'DELETE' })).toBeUndefined()
})

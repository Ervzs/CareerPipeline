import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ToastProvider } from '../components/toast/ToastProvider'
import { json, makeApplication } from '../test/utils'
import { groupByStage } from './board'
import { queryKeys, useMoveApplication } from './queries'
import type { Application } from './types'

const fetchMock = vi.fn<typeof fetch>()

const app = (id: number, stage: number, position: number) =>
  makeApplication({ id, stage, position }) as unknown as Application
const initial = () => [app(1, 1, 0), app(2, 1, 1), app(3, 2, 0)]

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(queryKeys.applications, initial())
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
  const hook = renderHook(() => useMoveApplication(), { wrapper })
  const cached = () => queryClient.getQueryData<Application[]>(queryKeys.applications)!
  const ids = (stage: number) =>
    groupByStage(cached())
      .get(stage)
      ?.map((a) => a.id)
  return { ...hook, cached, ids }
}

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

test('applies the move to the board immediately, before the server answers', async () => {
  let release: (value: Response) => void = () => {}
  fetchMock.mockImplementation(
    (url) =>
      new Promise((resolve) => {
        // the move request hangs until released; the follow-up refetch answers right away
        if (String(url).includes('/move/')) release = resolve
        else resolve(json(200, initial()))
      }),
  )
  const { result, ids } = setup()

  act(() => result.current.mutate({ id: 1, stage: 2, position: 0 }))

  await waitFor(() => expect(ids(2)).toEqual([1, 3])) // moved while the request is still pending
  expect(ids(1)).toEqual([2])
  expect(result.current.isPending).toBe(true)

  release(json(200, makeApplication({ id: 1, stage: 2 })))
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
})

test('rolls the board back and tells the user when the server rejects the move', async () => {
  fetchMock.mockImplementation(async (url) =>
    String(url).includes('/move/')
      ? json(404, { error: { code: 'not_found', message: 'Not found.', details: {} } })
      : json(200, initial()),
  )
  const { result, ids } = setup()

  act(() => result.current.mutate({ id: 1, stage: 2, position: 0 }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent("Couldn't move that application, so it went back.")
  expect(alert).toHaveTextContent('Not found.')
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(ids(1)).toEqual([1, 2])
  expect(ids(2)).toEqual([3])
})

test('rolls back on a network failure too', async () => {
  fetchMock.mockImplementation(async (url) => {
    if (String(url).includes('/move/')) throw new TypeError('Failed to fetch')
    return json(200, initial())
  })
  const { result, ids } = setup()

  act(() => result.current.mutate({ id: 2, stage: 2, position: 1 }))

  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(ids(1)).toEqual([1, 2])
  expect(ids(2)).toEqual([3])
})

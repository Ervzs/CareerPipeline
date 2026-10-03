import { expect, test } from 'vitest'
import { formatDateTime, fromDateTimeInput, toDateTimeInput } from './format'

test('a timestamp survives the round trip through a datetime-local input', () => {
  const iso = '2026-03-04T10:30:00.000Z'
  const input = toDateTimeInput(iso)

  expect(input).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  expect(fromDateTimeInput(input)).toBe(iso)
})

test('the input value is in local time', () => {
  const local = new Date(2026, 0, 5, 9, 7) // 5 Jan 2026, 09:07 local
  expect(toDateTimeInput(local.toISOString())).toBe('2026-01-05T09:07')
})

test('formatDateTime produces a readable date with a time', () => {
  const text = formatDateTime(new Date(2026, 2, 4, 14, 5).toISOString())
  expect(text).toContain('2026')
  expect(text).toMatch(/\d{1,2}:05/)
})

import { expect, test } from 'vitest'
import { appliedLabel } from './format'

const now = new Date(2026, 5, 15, 14, 30) // 15 June 2026, afternoon

test.each([
  [null, 'Not applied yet'],
  ['2026-06-15', 'Applied today'],
  ['2026-06-14', 'Applied yesterday'],
  ['2026-06-05', 'Applied 10 days ago'],
  ['2026-05-16', 'Applied 30 days ago'],
])('appliedLabel(%s)', (date, expected) => {
  expect(appliedLabel(date, now)).toBe(expected)
})

test('older dates show the calendar date', () => {
  expect(appliedLabel('2026-01-02', now)).toMatch(/^Applied .*2026/)
})

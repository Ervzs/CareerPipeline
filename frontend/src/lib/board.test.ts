import { expect, test } from 'vitest'
import { groupByStage, moveApplication } from './board'
import { makeApplication } from '../test/utils'
import type { Application } from './types'

const app = (id: number, stage: number, position: number) =>
  makeApplication({ id, stage, position, job_title: `job-${id}` }) as unknown as Application

// Column 1: a1 a2 a3 · Column 2: b1 b2 · Column 3: empty
const board = () => [app(1, 1, 0), app(2, 1, 1), app(3, 1, 2), app(4, 2, 0), app(5, 2, 1)]

/** [id, position] pairs for a stage, in board order. */
const column = (apps: Application[], stage: number) =>
  groupByStage(apps)
    .get(stage)
    ?.map((a) => [a.id, a.position]) ?? []

test('groupByStage sorts each column by position', () => {
  const groups = groupByStage([app(2, 1, 1), app(1, 1, 0), app(3, 2, 0)])
  expect(groups.get(1)?.map((a) => a.id)).toEqual([1, 2])
  expect(groups.get(2)?.map((a) => a.id)).toEqual([3])
})

test('moves a card down inside its column', () => {
  const result = moveApplication(board(), 1, 1, 2)
  expect(column(result, 1)).toEqual([
    [2, 0],
    [3, 1],
    [1, 2],
  ])
})

test('moves a card up inside its column', () => {
  const result = moveApplication(board(), 3, 1, 0)
  expect(column(result, 1)).toEqual([
    [3, 0],
    [1, 1],
    [2, 2],
  ])
})

test('moves a card to another column and re-sequences both', () => {
  const result = moveApplication(board(), 2, 2, 1)
  expect(column(result, 1)).toEqual([
    [1, 0],
    [3, 1],
  ])
  expect(column(result, 2)).toEqual([
    [4, 0],
    [2, 1],
    [5, 2],
  ])
  expect(result.find((a) => a.id === 2)?.stage).toBe(2)
})

test('moves into an empty column', () => {
  const result = moveApplication(board(), 5, 3, 0)
  expect(column(result, 3)).toEqual([[5, 0]])
  expect(column(result, 2)).toEqual([[4, 0]])
})

test('clamps an out-of-range position to the end, like the server', () => {
  const result = moveApplication(board(), 1, 2, 99)
  expect(column(result, 2)).toEqual([
    [4, 0],
    [5, 1],
    [1, 2],
  ])
})

test('does not mutate its input and keeps every card', () => {
  const original = board()
  const snapshot = JSON.stringify(original)
  const result = moveApplication(original, 1, 2, 0)
  expect(JSON.stringify(original)).toBe(snapshot)
  expect(result).toHaveLength(original.length)
})

test('an unknown id changes nothing', () => {
  const original = board()
  expect(moveApplication(original, 999, 1, 0)).toBe(original)
})

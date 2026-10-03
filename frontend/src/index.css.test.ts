import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

// Regression guard: Tailwind 4 drops @theme variables it never sees written out in full.
// The stage colours are built from an index at runtime (`--color-stage-${n}`), so without
// `static` the fifth stage lost its colour (an invisible bar on the dashboard).
test('theme variables are all emitted, including the dynamically chosen stage colours', () => {
  const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8')
  expect(css).toMatch(/@theme static\s*\{/)
  for (let i = 0; i < 5; i++) expect(css).toContain(`--color-stage-${i}:`)
})

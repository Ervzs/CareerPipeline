const PALETTE_SIZE = 5

/** Line colour for a stage, by its left-to-right index (cycles for custom stage counts). */
export const stageColor = (index: number) => `var(--color-stage-${index % PALETTE_SIZE})`

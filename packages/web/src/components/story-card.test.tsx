// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import StoryCard from './story-card'

describe('StoryCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the full seed as the preview when it is a short single sentence', () => {
    render(
      <StoryCard
        title="The Dragon Who Lost His Fire"
        status="ready"
        createdAt="2026-03-01T10:00:00Z"
        seed="A dragon loses his fire and must find a way to get it back."
      />,
    )

    expect(
      screen.getByText('A dragon loses his fire and must find a way to get it back.'),
    ).toBeInTheDocument()
  })

  it('renders a truncated preview with an ellipsis when the seed is long', () => {
    const longSeed =
      'A dragon who has lost his fire wanders through an enchanted forest looking for a way to get it back before winter arrives, meeting many strange creatures along the way.'

    render(
      <StoryCard title="The Dragon Who Lost His Fire" status="ready" createdAt="2026-03-01T10:00:00Z" seed={longSeed} />,
    )

    const preview = screen.getByText(/…$/)

    expect(preview.textContent).not.toBe(longSeed)
    expect(preview.textContent!.length).toBeLessThan(longSeed.length)
  })

  it('renders no preview when the story has no seed', () => {
    render(<StoryCard title="An Old Tale" status="archived" createdAt="2025-12-01T00:00:00Z" />)

    expect(screen.queryByText(/…$/)).not.toBeInTheDocument()
    expect(screen.getByText('An Old Tale')).toBeInTheDocument()
  })
})

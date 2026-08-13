// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('renders an outline favorite star when favorite is false', () => {
    render(
      <StoryCard
        title="The Dragon Who Lost His Fire"
        status="ready"
        createdAt="2026-03-01T10:00:00Z"
        favorite={false}
        onToggleFavorite={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Добавить в избранное' })).toBeInTheDocument()
  })

  it('renders a filled favorite star when favorite is true', () => {
    render(
      <StoryCard
        title="The Dragon Who Lost His Fire"
        status="ready"
        createdAt="2026-03-01T10:00:00Z"
        favorite
        onToggleFavorite={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Убрать из избранного' })).toBeInTheDocument()
  })

  it('does not render a favorite star when onToggleFavorite is not passed', () => {
    render(
      <StoryCard title="The Dragon Who Lost His Fire" status="ready" createdAt="2026-03-01T10:00:00Z" />,
    )

    expect(screen.queryByRole('button', { name: 'Добавить в избранное' })).not.toBeInTheDocument()
  })

  it('calls onToggleFavorite and not onTitleClick when the star is clicked', () => {
    const onToggleFavorite = vi.fn()
    const onTitleClick = vi.fn()

    render(
      <StoryCard
        title="The Dragon Who Lost His Fire"
        status="ready"
        createdAt="2026-03-01T10:00:00Z"
        favorite={false}
        onToggleFavorite={onToggleFavorite}
        onTitleClick={onTitleClick}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Добавить в избранное' }))

    expect(onToggleFavorite).toHaveBeenCalledTimes(1)
    expect(onTitleClick).not.toHaveBeenCalled()
  })
})

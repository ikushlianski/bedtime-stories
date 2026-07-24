// Backport of lib.es2022.intl.d.ts's Intl.Segmenter, since packages/web's tsconfig `lib`
// predates ES2022 (CLAUDE.md reserves tsconfig edits for dependency installs). Delete this
// file the day `lib` is bumped to ES2022+ — the real definitions will collide with these.
export {}

declare global {
  namespace Intl {
    type SegmenterGranularity = 'grapheme' | 'word' | 'sentence'

    interface SegmenterOptions {
      granularity?: SegmenterGranularity
      localeMatcher?: 'lookup' | 'best fit'
    }

    interface ResolvedSegmenterOptions {
      granularity: SegmenterGranularity
      locale: string
    }

    interface SegmentData {
      segment: string
      index: number
      input: string
      isWordLike?: boolean
    }

    interface Segments {
      containing(codeUnitIndex?: number): SegmentData | undefined
      [Symbol.iterator](): IterableIterator<SegmentData>
    }

    class Segmenter {
      constructor(locales?: string | string[], options?: SegmenterOptions)
      resolvedOptions(): ResolvedSegmenterOptions
      segment(input: string): Segments
    }
  }
}

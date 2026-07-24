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
      containing(codeUnitIndex?: number): SegmentData
      [Symbol.iterator](): IterableIterator<SegmentData>
    }

    class Segmenter {
      constructor(locales?: string | string[], options?: SegmenterOptions)
      resolvedOptions(): ResolvedSegmenterOptions
      segment(input: string): Segments
    }
  }
}

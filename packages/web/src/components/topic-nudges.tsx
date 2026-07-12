import { useSearchParams } from 'react-router-dom'
import { computeTopicNudges, type TopicNudgeInput } from '@bedtime/core/pipeline/topic-nudges'
import { synthesizeSeedFromTopics } from '@bedtime/core/pipeline/topic-derivers'
import type { Topic } from '../lib/api'

interface TopicNudgesProps {
  topics: Topic[]
  universeId: number | null
}

export function TopicNudges({ topics, universeId }: TopicNudgesProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const inputs: TopicNudgeInput[] = topics.map((t) => ({
    id: t.id,
    title: t.title,
    note: t.note,
    universeId: t.universeId,
    usedCount: t.usedCount,
  }))

  const candidates = computeTopicNudges(inputs)

  if (candidates.length === 0) return null

  const byId = new Map(topics.map((t) => [t.id, t]))

  function openCreateModal(topicIds: number[]) {
    const clusterTopics = topicIds
      .map((id) => byId.get(id))
      .filter((t): t is Topic => t !== undefined)
      .map((t) => ({ title: t.title, note: t.note }))

    const seed = synthesizeSeedFromTopics(clusterTopics)

    const next = new URLSearchParams(searchParams)
    next.set('modal', 'create')
    next.set('seed', seed)

    if (universeId !== null) {
      next.set('groupId', String(universeId))
    } else {
      next.delete('groupId')
    }

    setSearchParams(next)
  }

  return (
    <div className="space-y-3">
      {candidates.map((candidate) => (
        <div
          key={candidate.keyword}
          className="rounded-box border border-secondary/30 bg-secondary/5 p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-base-content">
              У тебя {candidate.count} тем про «{candidate.keyword}» — собрать из них историю?
            </p>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => openCreateModal(candidate.topicIds)}
            >
              Собрать историю
            </button>
          </div>
          <p className="mt-2 text-xs text-base-content/60">{candidate.titles.join(' · ')}</p>
        </div>
      ))}
    </div>
  )
}

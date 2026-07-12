import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, type CreateStoryInput } from '../lib/api'
import CreateStoryModal from './create-story-modal'
import { AddExampleStoryModal } from './add-example-story-modal'

export function GlobalStoryModals() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const modalParam = searchParams.get('modal')
  const seedFromUrl = searchParams.get('seed')
  const groupIdFromUrl = searchParams.get('groupId')

  const showCreate = modalParam === 'create' || seedFromUrl !== null
  const showExample = modalParam === 'example'

  function closeModal() {
    const next = new URLSearchParams(searchParams)
    next.delete('modal')
    next.delete('seed')
    next.delete('groupId')
    setSearchParams(next, { replace: true })
  }

  async function handleCreateStory(input: CreateStoryInput) {
    const created = await api.stories.create(input)

    closeModal()

    if ('seed' in input) {
      try {
        await api.pipeline.run(created.id, input.seed)
      } catch (runError) {
        console.warn(`Failed to start pipeline for story ${created.id}:`, runError)
      }
    }

    navigate(`/stories/${created.id}/pipeline`)
  }

  return (
    <>
      <CreateStoryModal
        open={showCreate}
        initialSeed={seedFromUrl ?? ''}
        initialGroupId={groupIdFromUrl ? parseInt(groupIdFromUrl, 10) : null}
        onClose={closeModal}
        onSubmit={handleCreateStory}
        onSeriesCreated={() => navigate('/drafts')}
      />

      <AddExampleStoryModal open={showExample} onClose={closeModal} />
    </>
  )
}

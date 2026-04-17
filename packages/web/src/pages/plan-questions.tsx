import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export function PlanQuestionsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    navigate(`/stories/${id}/pipeline`, { replace: true })
  }, [id, navigate])

  return null
}

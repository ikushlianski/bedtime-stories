type StoryFilterValue = 'all' | 'draft' | 'proofreading' | 'ready' | 'read' | 'archived'

interface StoryFilterTabsProps {
  value: StoryFilterValue
  onChange: (value: StoryFilterValue) => void
}

const filterTabs: Array<{ label: string; value: StoryFilterValue }> = [
  { label: 'Все', value: 'all' },
  { label: 'Черновик', value: 'draft' },
  { label: 'На вычитке', value: 'proofreading' },
  { label: 'Готово', value: 'ready' },
  { label: 'Прочитано', value: 'read' },
  { label: 'Архив', value: 'archived' },
]

function StoryFilterTabs({ value, onChange }: StoryFilterTabsProps) {
  return (
    <div className="join flex max-w-full overflow-x-auto">
      {filterTabs.map((tab) => (
        <button
          key={tab.value}
          className={`btn join-item btn-sm whitespace-nowrap focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${value === tab.value ? 'btn-secondary' : 'btn-outline'}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default StoryFilterTabs

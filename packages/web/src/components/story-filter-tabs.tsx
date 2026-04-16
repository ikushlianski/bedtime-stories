type StoryFilterValue = 'all' | 'draft' | 'ready' | 'read' | 'archived'

interface StoryFilterTabsProps {
  value: StoryFilterValue
  onChange: (value: StoryFilterValue) => void
}

const filterTabs: Array<{ label: string; value: StoryFilterValue }> = [
  { label: 'Все', value: 'all' },
  { label: 'Черновик', value: 'draft' },
  { label: 'Готово', value: 'ready' },
  { label: 'Прочитано', value: 'read' },
  { label: 'Архив', value: 'archived' },
]

function StoryFilterTabs({ value, onChange }: StoryFilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filterTabs.map((tab) => (
        <button
          key={tab.value}
          className={`btn btn-sm sm:btn-md focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${value === tab.value ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default StoryFilterTabs

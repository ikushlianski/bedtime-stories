type StoryFilterValue = 'all' | 'draft' | 'ready' | 'read' | 'archived'

interface StoryFilterTabsProps {
  value: StoryFilterValue
  onChange: (value: StoryFilterValue) => void
}

const filterTabs: Array<{ label: string; value: StoryFilterValue }> = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Ready', value: 'ready' },
  { label: 'Read', value: 'read' },
  { label: 'Archived', value: 'archived' },
]

function StoryFilterTabs({ value, onChange }: StoryFilterTabsProps) {
  return (
    <div className="join flex flex-wrap">
      {filterTabs.map((tab) => (
        <button
          key={tab.value}
          className={`btn join-item btn-sm sm:btn-md ${value === tab.value ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default StoryFilterTabs

interface StarRatingProps {
  value: number | null
  onChange: (v: number) => void
  name: string
}

function StarRating({ value, onChange, name }: StarRatingProps) {
  return (
    <div className="rating rating-lg gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <input
          key={star}
          type="radio"
          name={name}
          className="mask mask-star-2 bg-warning"
          aria-label={`${star} из 5`}
          checked={value === star}
          onChange={() => onChange(star)}
        />
      ))}
    </div>
  )
}

export default StarRating

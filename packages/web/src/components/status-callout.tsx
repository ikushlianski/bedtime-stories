interface StatusCalloutProps {
  tone?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  message: string
}

function StatusCallout({ tone = 'info', title, message }: StatusCalloutProps) {
  return (
    <div className={`alert alert-${tone}`}>
      <div>
        {title && <h3 className="font-semibold">{title}</h3>}
        <p className="text-sm">{message}</p>
      </div>
    </div>
  )
}

export default StatusCallout

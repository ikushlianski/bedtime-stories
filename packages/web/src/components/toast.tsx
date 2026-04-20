interface ToastProps {
  message: string | null
}

function Toast({ message }: ToastProps) {
  if (!message) return null

  return (
    <div className="toast toast-end toast-bottom z-50">
      <div className="alert alert-success py-2 text-sm shadow-lg">
        <span>{message}</span>
      </div>
    </div>
  )
}

export default Toast

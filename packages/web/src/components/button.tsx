import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost'
  size?: 'sm'
  loading?: boolean
}

export function Button({ variant, size, loading = false, disabled, children, className = '', ...props }: ButtonProps) {
  const base = 'btn'
  const variantClass = variant === 'ghost' ? 'btn-ghost' : 'btn-primary'
  const sizeClass = size === 'sm' ? 'btn-sm' : ''
  const loadingClass = loading ? 'loading' : ''

  return (
    <button
      className={[base, variantClass, sizeClass, loadingClass, className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {children}
    </button>
  )
}

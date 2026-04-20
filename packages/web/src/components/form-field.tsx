import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}

function FormField({ label, hint, error, required, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-base-content">
        {label}
        {required && <span className="ml-0.5 text-error">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-base-content/50">{hint}</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}

export default FormField

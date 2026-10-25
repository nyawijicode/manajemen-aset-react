import { forwardRef, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const CONTROL =
  'block w-full rounded-lg border bg-white px-3 text-base text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus:ring-red-600/20'

interface FieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, required, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800">
        {label}
        {required ? (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (wajib)</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs leading-5 text-slate-500">{hint}</p> : null}
      {error ? (
        <p className="text-xs font-medium leading-5 text-red-700">{error}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL, 'min-h-11 border-slate-300', className)} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(CONTROL, 'min-h-11 border-slate-300 pr-9', className)} {...props}>
        {children}
      </select>
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(CONTROL, 'min-h-28 border-slate-300 py-2.5', className)} {...props} />
  },
)

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...props },
  ref,
) {
  const checkboxId = id ?? props.name
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        ref={ref}
        id={checkboxId}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-400 text-primary-700 focus:ring-primary-600"
        {...props}
      />
      <label htmlFor={checkboxId} className="text-sm leading-6 text-slate-700">
        <span className="font-medium text-slate-800">{label}</span>
        {description ? <span className="block text-xs text-slate-500">{description}</span> : null}
      </label>
    </div>
  )
})

import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Select({ className, options, value, onChange, ariaLabel }) {
  return (
    <div className={cn('relative', className)}>
      <select
        aria-label={ariaLabel}
        className="h-10 w-full appearance-none rounded-md border border-stone-300 bg-white px-3 pr-9 text-sm text-stone-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
        value={value}
        onChange={onChange}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
    </div>
  )
}

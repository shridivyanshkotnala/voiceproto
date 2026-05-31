import { Sparkles } from 'lucide-react'
import { Badge } from './ui/badge'

export function Header() {
  return (
    <header className="border-b border-stone-200 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-stone-900 sm:text-xl">
            Pratham AI Assistant
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            AI Powered Jewellery Business Assistant
          </p>
        </div>
        <Badge className="gap-1.5 bg-emerald-50 text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Online
          <Sparkles className="size-3.5" />
        </Badge>
      </div>
    </header>
  )
}

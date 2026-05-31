import { cn } from '../lib/utils'

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MessageBubble({ role, content, timestamp, loading = false }) {
  const user = role === 'user'

  return (
    <div className={cn('flex w-full', user ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[75%]',
          user
            ? 'rounded-br-md bg-stone-900 text-white'
            : 'rounded-bl-md border border-stone-200 bg-stone-50 text-stone-800',
        )}
      >
        <p className={cn('whitespace-pre-wrap leading-relaxed', loading && 'animate-pulse')}>
          {content}
        </p>
        <p
          className={cn(
            'mt-2 text-[11px]',
            user ? 'text-stone-300' : 'text-stone-500',
          )}
        >
          {formatTime(timestamp)}
        </p>
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'

export function ChatWindow({ messages, loading }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div className="flex-1 overflow-y-auto bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
          />
        ))}

        {loading ? (
          <MessageBubble
            role="assistant"
            content="AI is thinking..."
            timestamp={new Date().toISOString()}
            loading
          />
        ) : null}

        <div ref={endRef} />
      </div>
    </div>
  )
}

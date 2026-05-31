import { SendHorizontal } from 'lucide-react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

export function ChatInput({ value, onChange, onSend, loading, onVoiceClick }) {
  async function submit() {
    if (!value.trim() || loading) {
      return
    }

    await onSend(value)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-stone-200 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl items-end gap-2">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask a question..."
          className="max-h-32 min-h-10 resize-y"
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onVoiceClick}
          aria-label="Start voice input"
        >
          🎤
        </Button>

        <Button
          type="button"
          onClick={submit}
          disabled={!value.trim() || loading}
          aria-label="Send message"
          className="min-w-20"
        >
          <SendHorizontal className="size-4" />
          Send
        </Button>
      </div>
    </div>
  )
}

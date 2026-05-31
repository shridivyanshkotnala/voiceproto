import { useDispatch, useSelector } from 'react-redux'
import { setSelectedVoiceProfile } from '../features/voice/voiceSlice'
import { Select } from './ui/select'

const voiceOptions = [
  { label: 'Professional Female', value: 'PROFESSIONAL_FEMALE' },
  { label: 'Luxury Female', value: 'LUXURY_FEMALE' },
  { label: 'Friendly Female', value: 'FRIENDLY_FEMALE' },
]

export function VoiceSelector() {
  const dispatch = useDispatch()
  const voiceProfile = useSelector((state) => state.voice.selectedVoiceProfile)

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
        Voice Profile
      </label>
      <Select
        ariaLabel="Voice Profile"
        value={voiceProfile}
        options={voiceOptions}
        onChange={(event) =>
          dispatch(setSelectedVoiceProfile(event.target.value))
        }
      />
    </div>
  )
}

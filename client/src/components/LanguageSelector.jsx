import { useDispatch, useSelector } from 'react-redux'
import { setResponseStyle } from '../store/settingsSlice'
import { Select } from './ui/select'

const languageOptions = [
  { label: 'English', value: 'english' },
  { label: 'Hinglish', value: 'hinglish' },
]

export function LanguageSelector() {
  const dispatch = useDispatch()
  const responseStyle = useSelector((state) => state.settings.responseStyle)

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
        Response Style
      </label>
      <Select
        ariaLabel="Response Style"
        value={responseStyle}
        options={languageOptions}
        onChange={(event) => dispatch(setResponseStyle(event.target.value))}
      />
    </div>
  )
}

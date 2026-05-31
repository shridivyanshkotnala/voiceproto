import { useDispatch } from 'react-redux'
import { useAnalyzeLanguageMutation } from './languageApi'
import { setLanguageProfile } from './languageSlice'

export function useLanguageProfile() {
  const dispatch = useDispatch()
  const [analyzeLanguage, state] = useAnalyzeLanguageMutation()

  const analyze = async (message) => {
    const response = await analyzeLanguage({ message }).unwrap()
    if (response?.data) {
      dispatch(setLanguageProfile(response.data))
    }
    return response?.data
  }

  return {
    analyze,
    ...state,
  }
}

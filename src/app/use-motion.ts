import { useReducedMotion } from 'framer-motion'
import { usePreferences } from './preferences-store'
import { reduceEffect } from '../lib/preferences'
export function useAtlasReducedMotion() {
  const system = useReducedMotion()
  const preference = usePreferences((state) => state.preferences.motion)
  return reduceEffect(preference, system === true)
}

import { useCallback, useEffect, useState } from 'react'
import { loadJSON, saveJSON } from '@/lib/storage'

/** State mirrored into versioned localStorage. Read once on mount, written on change. */
export function useLocalStorage<T>(name: string, initial: T) {
  const [value, setValue] = useState<T>(() => loadJSON<T>(name) ?? initial)

  useEffect(() => {
    saveJSON(name, value)
  }, [name, value])

  const reset = useCallback(() => setValue(initial), [initial])

  return [value, setValue, reset] as const
}

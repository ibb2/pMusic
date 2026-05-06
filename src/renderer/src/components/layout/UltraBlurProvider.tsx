import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type UltraBlurContextType = {
  ultraBlurUrl: string | null
  setUltraBlurUrl: (url: string | null, sourceId: string) => void
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

const UltraBlurContext = createContext<UltraBlurContextType>({
  ultraBlurUrl: null,
  setUltraBlurUrl: () => {},
  enabled: true,
  setEnabled: () => {},
})

export function UltraBlurProvider({ children }: { children: React.ReactNode }) {
  const [ultraBlurUrl, setUltraBlurUrlRaw] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(true)
  const currentSourceRef = useRef<string | null>(null)

  const setUltraBlurUrl = useCallback((url: string | null, sourceId: string) => {
    if (url === null) {
      if (currentSourceRef.current === sourceId) {
        setUltraBlurUrlRaw(null)
        currentSourceRef.current = null
      }
      return
    }
    currentSourceRef.current = sourceId
    setUltraBlurUrlRaw(url)
  }, [])

  useEffect(() => {
    window.api.settings
      .getPlayback()
      .then((settings) => {
        setEnabled(settings.enableUltraBlur !== false)
      })
      .catch(() => {
        setEnabled(true)
      })
  }, [])

  return (
    <UltraBlurContext.Provider
      value={{ ultraBlurUrl, setUltraBlurUrl, enabled, setEnabled }}
    >
      {children}
    </UltraBlurContext.Provider>
  )
}

export function useUltraBlur() {
  return useContext(UltraBlurContext)
}

export function usePageUltraBlur(sourceId: string) {
  const { setUltraBlurUrl, enabled, ultraBlurUrl } = useUltraBlur()

  const setBlur = useCallback((url: string | null) => {
    setUltraBlurUrl(url, sourceId)
  }, [setUltraBlurUrl, sourceId])

  useEffect(() => {
    return () => {
      setBlur(null)
    }
  }, [sourceId, setBlur])

  return { setBlur, enabled, ultraBlurUrl }
}
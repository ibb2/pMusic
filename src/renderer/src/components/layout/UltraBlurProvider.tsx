import React, { createContext, useContext, useEffect, useState } from 'react'

type UltraBlurContextType = {
  ultraBlurUrl: string | null
  setUltraBlurUrl: (url: string | null) => void
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
  const [ultraBlurUrl, setUltraBlurUrl] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(true)

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

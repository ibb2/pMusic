import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type UltraBlurValue =
  | string
  | {
      light: string;
      dark: string;
    };

type UltraBlurContextType = {
  ultraBlur: UltraBlurValue | null;
  setUltraBlur: (blur: UltraBlurValue | null, sourceId: string) => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

const UltraBlurContext = createContext<UltraBlurContextType>({
  ultraBlur: null,
  setUltraBlur: () => {},
  enabled: true,
  setEnabled: () => {},
});

export function UltraBlurProvider({ children }: { children: React.ReactNode }) {
  const [ultraBlur, setUltraBlurRaw] = useState<UltraBlurValue | null>(null);
  const [enabled, setEnabled] = useState(true);
  const currentSourceRef = useRef<string | null>(null);

  const setUltraBlur = useCallback(
    (blur: UltraBlurValue | null, sourceId: string) => {
      if (blur === null) {
        if (currentSourceRef.current === sourceId) {
          setUltraBlurRaw(null);
          currentSourceRef.current = null;
        }
        return;
      }
      currentSourceRef.current = sourceId;
      setUltraBlurRaw(blur);
    },
    [],
  );

  useEffect(() => {
    window.api.settings
      .getPlayback()
      .then((settings) => {
        setEnabled(settings.enableUltraBlur !== false);
      })
      .catch(() => {
        setEnabled(true);
      });
  }, []);

  return (
    <UltraBlurContext.Provider
      value={{ ultraBlur, setUltraBlur, enabled, setEnabled }}
    >
      {children}
    </UltraBlurContext.Provider>
  );
}

export function useUltraBlur() {
  return useContext(UltraBlurContext);
}

export function usePageUltraBlur(sourceId: string) {
  const { setUltraBlur, enabled, ultraBlur } = useUltraBlur();

  const setBlur = useCallback(
    (blur: UltraBlurValue | null) => {
      setUltraBlur(blur, sourceId);
    },
    [setUltraBlur, sourceId],
  );

  useEffect(() => {
    return () => {
      setBlur(null);
    };
  }, [sourceId, setBlur]);

  return { setBlur, enabled, ultraBlur };
}

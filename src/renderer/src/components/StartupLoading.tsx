import type { ReactElement, ReactNode } from "react";

export function StartupLoading({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return <>{children}</>;
}

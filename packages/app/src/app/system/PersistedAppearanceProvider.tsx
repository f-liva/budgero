import type { ReactNode } from 'react';
import { DialogBackgroundBlurProvider } from '@shared/contexts/DialogBackgroundBlurContext';
import { HideZeroAmountsProvider } from '@shared/contexts/HideZeroAmountsContext';
import { useDialogBackgroundBlur, useHideZeroAmounts } from '@shared/hooks/useUserPreferences';

export function PersistedAppearanceProvider({ children }: { children: ReactNode }) {
  const { data: dialogBackgroundBlur = true } = useDialogBackgroundBlur();
  const { data: hideZeroAmounts = false } = useHideZeroAmounts();

  return (
    <DialogBackgroundBlurProvider enabled={dialogBackgroundBlur}>
      <HideZeroAmountsProvider enabled={hideZeroAmounts}>{children}</HideZeroAmountsProvider>
    </DialogBackgroundBlurProvider>
  );
}

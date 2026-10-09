'use client';

import { useEffect, type MouseEvent } from 'react';

/**
 * The two ways out of a dialog that people try first: the Escape key, and a
 * click on the dark area around it. Several of ours offered neither, so the
 * only way out was finding the right button.
 *
 * Returns props for the backdrop element. The click only counts when it lands
 * on the backdrop itself, never on a bubbled click from inside the dialog, and
 * it is `mousedown` so a text selection dragged out of the dialog does not
 * close it.
 */
export function useModalDismiss(onClose: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return {
    onMouseDown: (event: MouseEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
  };
}

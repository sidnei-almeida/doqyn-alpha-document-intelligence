import { createContext } from 'react';
import type { SelectableKind } from '../utils/marqueeSelectionUtils';

export type MarqueeRegistryApi = {
  register: (id: string, kind: SelectableKind, element: HTMLElement | null) => void;
};

export const MarqueeRegistryContext = createContext<MarqueeRegistryApi | null>(null);

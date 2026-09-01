import { createContext } from 'react';
import type { TourStep } from './tourTypes';

export type TourContextValue = {
  open: boolean;
  /** Roteiro já filtrado pelo que esta pessoa pode ver. */
  steps: TourStep[];
  index: number;
  step: TourStep | null;
  start: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
};

export const TourContext = createContext<TourContextValue | null>(null);

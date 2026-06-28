import { createContext } from 'react';
import type { ConfirmOptions } from './confirmTypes';

export type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);

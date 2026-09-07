import { useContext } from 'react';
import { TourContext } from './tourContext';

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour precisa estar dentro de TourProvider');
  }
  return context;
}

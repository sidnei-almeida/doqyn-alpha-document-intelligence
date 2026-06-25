import { useEffect, useState } from 'react';

const MIN_PROGRESS = 10;
const MAX_PROGRESS = 85;
const TICK_MS = 400;

export function useSemiDeterminateProgress(isActive: boolean, isComplete: boolean): number {
  const [progress, setProgress] = useState(MIN_PROGRESS);

  useEffect(() => {
    if (!isActive) {
      setProgress(MIN_PROGRESS);
      return;
    }

    if (isComplete) {
      setProgress(100);
      return;
    }

    setProgress(MIN_PROGRESS);
    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= MAX_PROGRESS) return current;
        const increment = current < 40 ? 4 : current < 65 ? 2.5 : 1.2;
        return Math.min(MAX_PROGRESS, current + increment);
      });
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, [isActive, isComplete]);

  return progress;
}

export function useSimulatedStepIndex(isActive: boolean, isComplete: boolean): number {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setStepIndex(0);
      return;
    }

    if (isComplete) {
      setStepIndex(5);
      return;
    }

    setStepIndex(0);
    const interval = window.setInterval(() => {
      setStepIndex((current) => (current >= 4 ? current : current + 1));
    }, 1100);

    return () => window.clearInterval(interval);
  }, [isActive, isComplete]);

  return stepIndex;
}

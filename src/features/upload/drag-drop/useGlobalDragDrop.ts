import { useEffect, useRef, useState } from 'react';

function dragEventHasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

/**
 * Detecta drag de arquivos sobre a janela inteira.
 * O contador de enter/leave evita flicker ao atravessar elementos filhos.
 */
export function useGlobalDragDrop(onDropFiles: (files: File[]) => void) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const onDropRef = useRef(onDropFiles);
  onDropRef.current = onDropFiles;

  useEffect(() => {
    const handleDragEnter = (event: DragEvent) => {
      if (!dragEventHasFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDragging(true);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!dragEventHasFiles(event)) return;
      event.preventDefault();
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!dragEventHasFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDrop = (event: DragEvent) => {
      if (!dragEventHasFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) {
        onDropRef.current(files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  return { isDragging };
}

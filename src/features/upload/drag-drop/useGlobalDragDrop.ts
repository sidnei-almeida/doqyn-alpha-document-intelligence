import { useEffect, useRef, useState } from 'react';

/**
 * Marca uma área que trata o próprio drop de arquivos.
 *
 * O ouvinte global fica na `window`, e o drop de uma área interna sobe até lá:
 * as duas mãos pegavam o mesmo arquivo e a fila recebia o envio duas vezes. Sem
 * essa marca cada área precisaria lembrar de chamar `stopPropagation`, e a
 * próxima que alguém escrever esquece — o global é que tem de saber ceder.
 */
export const FILE_DROPZONE_ATTRIBUTE = 'data-file-dropzone';

/** Atributo pronto para espalhar no elemento: `<div {...fileDropzoneProps}>`. */
export const fileDropzoneProps = { [FILE_DROPZONE_ATTRIBUTE]: '' } as const;

function landedOnLocalDropzone(event: DragEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(`[${FILE_DROPZONE_ATTRIBUTE}]`));
}

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
      // Área própria assume a vez: sem isso os dois avisos de "solte aqui"
      // aparecem sobrepostos, o da janela por cima do da Biblioteca.
      if (landedOnLocalDropzone(event)) return;
      dragDepthRef.current += 1;
      setIsDragging(true);
    };

    // Sem `preventDefault` no dragover o navegador abre o arquivo numa aba nova.
    // Vale para toda a janela, inclusive sobre as áreas próprias.
    const handleDragOver = (event: DragEvent) => {
      if (!dragEventHasFiles(event)) return;
      event.preventDefault();
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!dragEventHasFiles(event)) return;
      event.preventDefault();
      if (landedOnLocalDropzone(event)) return;
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
      // O envio é de quem recebeu o arquivo. A janela só cobre o que sobra —
      // sidebar, cabeçalho, o vazio ao redor do conteúdo.
      if (landedOnLocalDropzone(event)) return;
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

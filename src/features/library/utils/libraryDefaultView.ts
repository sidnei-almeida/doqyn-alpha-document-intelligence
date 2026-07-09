export type LibraryDefaultView = 'grid' | 'list';

export const LIBRARY_DEFAULT_VIEW_KEY = 'doqyn.library.defaultView';

export function getLibraryDefaultView(): LibraryDefaultView {
  try {
    const raw = localStorage.getItem(LIBRARY_DEFAULT_VIEW_KEY);
    return raw === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function setLibraryDefaultView(view: LibraryDefaultView): void {
  try {
    localStorage.setItem(LIBRARY_DEFAULT_VIEW_KEY, view);
  } catch {
    // ignore
  }
}

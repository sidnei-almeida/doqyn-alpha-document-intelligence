export function RouteLoadingFallback() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
      aria-label="Carregando módulo"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-doqyn-border border-t-doqyn-primary" />
      <p className="text-sm text-doqyn-muted">Carregando módulo...</p>
    </div>
  );
}

export function withAuthHeaders(
  headers?: HeadersInit,
  options?: { json?: boolean; hasBody?: boolean },
): HeadersInit {
  const merged = new Headers(headers);

  const shouldSetJsonContentType =
    options?.json !== false &&
    (options?.hasBody ?? false) &&
    !merged.has('Content-Type');

  if (shouldSetJsonContentType) {
    merged.set('Content-Type', 'application/json');
  }

  return merged;
}

export function shouldSetJsonContentType(init?: RequestInit): boolean {
  const isFormData = init?.body instanceof FormData;
  const hasBody = init?.body !== undefined && init?.body !== null;
  return hasBody && !isFormData;
}

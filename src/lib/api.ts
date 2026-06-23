const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro na requisição' }));
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  health: () => request<{ status: string; timestamp: string; environment: string }>('/health'),

  documents: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      return request<{ documents: unknown[]; total: number }>(`/documents${query}`);
    },
    get: (id: string) => request<{ document: unknown }>(`/documents?id=${id}`),
    upload: (formData: FormData) =>
      fetch(`${API_BASE}/documents/upload`, { method: 'POST', body: formData }).then(async (res) => {
        if (!res.ok) {
          const error = await res.json().catch(() => ({ message: 'Erro no envio' }));
          throw new Error(error.message);
        }
        return res.json();
      }),
  },

  audit: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      return request<{ events: unknown[]; total: number }>(`/audit${query}`);
    },
  },
};

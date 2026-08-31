/**
 * Onde o passe de confirmação mora entre uma tela e outra.
 *
 * `sessionStorage`, e não estado de rota: recarregar a página com o ticket só no `location.state`
 * apagaria o passe e deixaria a pessoa presa numa tela que não consegue reenviar nada. E não
 * `localStorage`: o passe vale por 30 minutos e não deve sobreviver ao fechamento da aba, muito
 * menos ficar num computador compartilhado depois que alguém foi embora.
 */
const TICKET_KEY = 'doqyn.email-verification-ticket';

export function storeVerificationTicket(ticket: string): void {
  try {
    window.sessionStorage.setItem(TICKET_KEY, ticket);
  } catch {
    // Navegador com armazenamento bloqueado: a tela ainda funciona pelo `location.state`.
  }
}

export function readVerificationTicket(): string | null {
  try {
    return window.sessionStorage.getItem(TICKET_KEY);
  } catch {
    return null;
  }
}

export function clearVerificationTicket(): void {
  try {
    window.sessionStorage.removeItem(TICKET_KEY);
  } catch {
    // Nada a limpar se nem escrever foi possível.
  }
}

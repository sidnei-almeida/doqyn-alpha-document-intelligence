/**
 * Marca de "já viu o tour", por usuário e por navegador.
 *
 * Fica no `localStorage` pelo mesmo motivo do tema e da sidebar recolhida: é
 * estado de aparelho, não de conta. Se a pessoa entra de outra máquina, ver o
 * tour de novo é o comportamento certo — a máquina nova é que é desconhecida.
 *
 * A chave leva o id do usuário porque a mesma máquina é compartilhada em
 * recepção, financeiro e cartório; sem isso o segundo usuário nunca veria nada.
 */
const KEY_PREFIX = 'doqyn.tour.seen';

function storageKey(userId: string): string {
  return `${KEY_PREFIX}.${userId}`;
}

export function hasSeenTour(userId: string | null | undefined): boolean {
  if (!userId) return true; // Sem usuário resolvido ainda: não dispara nada.
  try {
    return localStorage.getItem(storageKey(userId)) === 'true';
  } catch {
    // Navegador com armazenamento bloqueado: não insista a cada carregamento.
    return true;
  }
}

export function markTourSeen(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    localStorage.setItem(storageKey(userId), 'true');
  } catch {
    // ignore
  }
}

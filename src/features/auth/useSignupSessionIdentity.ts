import { useEffect, useState } from 'react';
import { getCurrentSession, SessionApiError } from '@/auth/sessionApi';

export type SignupSessionIdentity =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | {
      status: 'authenticated';
      email: string;
      firstName: string;
      lastName: string;
    };

/**
 * Identidade da sessão nas telas de cadastro.
 *
 * Não dá para usar o `user` do AuthProvider aqui: nas rotas públicas ele chama `clearSession()`
 * de propósito (`AuthProvider.tsx`), então `user` é sempre nulo mesmo havendo sessão válida. O
 * servidor, por outro lado, decide o modo do cadastro pelo cookie — e quando os dois discordam
 * o formulário pede uma senha que o backend descarta, deixando a conta sem credencial e o
 * usuário convencido de que cadastrou uma senha que nunca existiu.
 *
 * Quem acabou de entrar por OAuth e ainda não tem espaço de trabalho recebe 403 com
 * `partialUser`: é sessão de verdade, e conta como autenticado para esta decisão.
 */
export function useSignupSessionIdentity(): SignupSessionIdentity {
  const [identity, setIdentity] = useState<SignupSessionIdentity>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const session = await getCurrentSession();
        if (!active) return;
        setIdentity({
          status: 'authenticated',
          email: session.user.email ?? '',
          firstName: session.user.firstName ?? '',
          lastName: session.user.lastName ?? '',
        });
      } catch (error) {
        if (!active) return;

        const partial = error instanceof SessionApiError ? error.partialUser : undefined;
        if (partial?.email) {
          setIdentity({
            status: 'authenticated',
            email: partial.email,
            firstName: partial.firstName ?? '',
            lastName: partial.lastName ?? '',
          });
          return;
        }

        setIdentity({ status: 'anonymous' });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return identity;
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('login demo e robustez de auth', () => {
  it('LoginPage redireciona para /biblioteca após login', () => {
    const login = readSrc('pages/Login.tsx');
    assert.ok(login.includes("|| '/biblioteca'"));
    assert.equal(login.includes("|| '/upload'"), false);
  });

  it('login doqyn_auth chama /auth/login com credentials include', () => {
    const api = readSrc('features/auth/authApi.ts');
    assert.ok(api.includes('doqynLoginRequest'));
    assert.ok(api.includes("credentials: 'include'"));
    assert.ok(api.includes('doqynMeRequest'));
  });

  it('AuthProvider não exige avatar para autenticar', () => {
    const provider = readSrc('auth/AuthProvider.tsx');
    assert.ok(provider.includes('isAuthenticated = Boolean(user)'));
    assert.equal(provider.includes('avatarUrl') && provider.includes('isAuthenticated'), false);
  });

  it('ProtectedRoute aguarda isLoading antes de redirecionar', () => {
    const route = readSrc('features/auth/ProtectedRoute.tsx');
    assert.ok(route.includes('isLoading'));
    assert.ok(route.includes('Verificando acesso'));
  });

  it('useProfileMe só busca com sessão e não lança erro fatal', () => {
    const hook = readSrc('features/profile/hooks/useProfile.ts');
    assert.ok(hook.includes('isAuthenticated'));
    assert.ok(hook.includes('retry: false'));
    assert.ok(hook.includes('throwOnError: false'));
  });

  it('UserAvatar renderiza sem avatarUrl obrigatório', () => {
    const avatar = readSrc('components/ui/UserAvatar.tsx');
    assert.ok(avatar.includes('avatarUrl'));
    assert.ok(avatar.includes('initials') || avatar.includes('getInitials'));
  });

  it('mapMeSession trata campos opcionais de avatar', () => {
    const mapper = readSrc('auth/mapMeSession.ts');
    assert.ok(mapper.includes('avatarVersion'));
    assert.ok(mapper.includes('avatarUrl'));
    assert.ok(mapper.includes('avatarStatus'));
  });

  it('HeaderUserMenu renderiza sem exigir avatar', () => {
    const menu = readSrc('components/layout/HeaderUserMenu.tsx');
    assert.ok(menu.includes('UserAvatar'));
    assert.ok(menu.includes('user?.email'));
  });

  it('PublicRoute redireciona autenticado para biblioteca', () => {
    const route = readSrc('features/auth/ProtectedRoute.tsx');
    assert.ok(route.includes('Navigate to="/biblioteca"'));
  });
});

describe('demo seed constants auth-service', () => {
  const authRoot = join(__dirname, '..', '..', 'doqyn-auth-service');

  it('demo seed define o admin da empresa demo e a senha DevDoqyn@123', () => {
    const constants = readFileSync(
      join(authRoot, 'src/demo/demoSeed.constants.ts'),
      'utf8',
    );
    // A conta `admin.global@doqyn.dev` foi substituída: carregava o papel administrativo de
    // plataforma e, por isso, nunca exercitava as regras de governança que o produto vende.
    assert.ok(constants.includes('rafael.mendes@doqyn.dev'));
    assert.ok(constants.includes('DevDoqyn@123'));
    assert.ok(constants.includes("DEMO_COMPANY_TENANT_ID = 'company_dev'"));
    // Nenhum papel de plataforma nas contas demo — se voltar, o seed recria o que a fase removeu.
    // (O e-mail antigo ainda aparece no comentário histórico do arquivo, de propósito.)
    assert.equal(constants.includes("'doqyn_admin'"), false);
  });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { getOAuthStartUrl } from '../src/auth/oauthLogin.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('OAuth login frontend', () => {
  it('LoginPage mostra botões Google e Microsoft', () => {
    const source = readSrc('pages/Login.tsx');
    assert.ok(source.includes('Continuar com Google'));
    assert.ok(source.includes('Continuar com Microsoft'));
    // O portão é a lista que o auth-service devolve: botão que aparece tem credencial atrás.
    assert.ok(source.includes('enabledProviders.length > 0'));
  });

  it('redirect OAuth aponta para /oauth/*/start', () => {
    assert.equal(getOAuthStartUrl('google', '/upload'), '/oauth/google/start?returnUrl=%2Fupload');
    assert.equal(getOAuthStartUrl('microsoft'), '/oauth/microsoft/start');
  });

  it('OAuthCallbackPage chama refreshUser e redireciona para biblioteca por padrão', () => {
    const source = readSrc('pages/OAuthCallbackPage.tsx');
    assert.ok(source.includes('refreshUser'));
    assert.ok(source.includes('/onboarding'));
    assert.ok(source.includes('/biblioteca'));
    assert.equal(source.includes("'/upload'"), false);
  });

  it('OnboardingPage oferece caminhos CPF e CNPJ, e não mais o pedido de acesso', () => {
    const source = readSrc('pages/OnboardingPage.tsx');
    const access = readSrc('features/access-choice/AccessChoicePage.tsx');
    assert.ok(source.includes('OnboardingPage'));
    assert.ok(access.includes('/criar-acesso-cpf'));
    assert.ok(access.includes('/criar-empresa'));
    // Entrar numa empresa que já existe depende de convite, não de um pedido em fila.
    assert.equal(access.includes('/solicitar-acesso'), false);
  });

  it('vite proxy encaminha /oauth para auth-service', () => {
    const source = readFileSync(join(__dirname, '..', 'vite.config.ts'), 'utf8');
    assert.ok(source.includes("'/oauth'"));
  });

  it('não expõe tokens OAuth no frontend', () => {
    const login = readSrc('pages/Login.tsx');
    const callback = readSrc('pages/OAuthCallbackPage.tsx');
    assert.equal(login.includes('id_token'), false);
    assert.equal(callback.includes('access_token'), false);
  });
});

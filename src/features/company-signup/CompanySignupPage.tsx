import { Building2, Shield } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { DoqynLogo } from '@/components/brand';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/features/auth/useAuth';
import { submitCompanySignup } from './api/companySignupApi';

const TERMS_TEXT =
  'Declaro que li e aceito os termos de uso e política de privacidade do DOQYN para criação do ambiente corporativo.';

const CHECKBOX_CLASS =
  'mt-0.5 h-4 w-4 shrink-0 rounded border-doqyn-border-strong bg-doqyn-bg accent-doqyn-text';

export function CompanySignupPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    if (!termsAccepted) {
      setError('É necessário aceitar os termos.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await submitCompanySignup({
        companyName,
        taxId,
        firstName,
        lastName,
        email,
        whatsapp,
        password,
        confirmPassword,
        termsAccepted,
      });

      toast.success(result.message ?? 'Empresa cadastrada com sucesso.');
      await refreshUser();
      navigate('/upload', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao cadastrar empresa.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-doqyn-bg px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-lg flow-enter">
        <div className="mb-8 flex flex-col items-center text-center">
          <DoqynLogo size="lg" align="center" showSubtitle subtitle="Cadastrar empresa" />
          <p className="mt-4 max-w-md text-sm text-doqyn-muted">
            Use esta opção se sua empresa ainda não possui um ambiente no DOQYN.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6"
        >
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-doqyn-text">
            <Building2 className="h-4 w-4" strokeWidth={1.5} />
            Dados da empresa
          </div>

          <div className="space-y-4">
            <Input
              id="companyName"
              label="Nome da empresa"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
            <Input
              id="taxId"
              label="CNPJ"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="00.000.000/0000-00"
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="firstName"
                label="Nome do responsável"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <Input
                id="lastName"
                label="Sobrenome"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            <Input
              id="email"
              label="E-mail corporativo"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="whatsapp"
              label="WhatsApp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
            />
            <Input
              id="password"
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <Input
              id="confirmPassword"
              label="Confirmar senha"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-doqyn-border-subtle bg-doqyn-bg px-3 py-3">
              <input
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                required
              />
              <span className="text-sm leading-relaxed text-doqyn-muted">{TERMS_TEXT}</span>
            </label>
          </div>

          {error && <p className="form-error mt-4 text-center">{error}</p>}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-doqyn-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/acesso" className="text-center text-sm text-doqyn-muted hover:text-doqyn-text">
              Voltar
            </Link>
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {submitting ? 'Cadastrando...' : 'Cadastrar empresa'}
            </Button>
          </div>
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-doqyn-subtle">
          <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
          Ambiente corporativo seguro
        </p>
      </div>
    </main>
  );
}

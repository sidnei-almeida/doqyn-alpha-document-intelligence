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

describe('design system DOQYN', () => {
  it('tokens.css define superfícies, bordas, espaçamento e status semânticos', () => {
    const source = readSrc('styles/tokens.css');
    assert.ok(source.includes('--bg-surface-hover'));
    assert.ok(source.includes('--border-default'));
    assert.ok(source.includes('--space-4'));
    assert.ok(source.includes('--radius-lg'));
    assert.ok(source.includes('--status-pending-dot'));
    assert.ok(source.includes('--field-height'));
    assert.ok(source.includes('--icon-button-size'));
  });

  it('Badge é rótulo de registro em canto reto, não pílula', () => {
    const source = readSrc('components/ui/Badge.tsx');
    // A base é canto reto: etiqueta é rótulo de registro, não pílula de produto de consumo.
    assert.ok(source.includes('rounded-[2px]'));
    assert.ok(source.includes('font-mono'));
    assert.ok(source.includes('uppercase'));

    // Pílula existe numa variante só, e é a exceção que a marca prevê: o selo de atestação.
    // Ele também é o único em latão — e latão nunca preenche, só contorna, que é o que o separa
    // do amarelo de alerta.
    const pillLines = source.split('\n').filter((line) => line.includes('rounded-full'));
    assert.equal(pillLines.length, 1);
    assert.ok(pillLines[0].includes('seal:'));
    assert.ok(pillLines[0].includes('border border-[var(--seal)]'));
    assert.equal(pillLines[0].includes('bg-'), false);
    assert.ok(source.includes('pending:'));
    assert.ok(source.includes('xs:'));
    assert.ok(source.includes('brand:'));
  });

  it('semântica de status centralizada em statusSemantics.ts', () => {
    const source = readSrc('lib/statusSemantics.ts');
    assert.ok(source.includes('getDocumentStatusBadge'));
    assert.ok(source.includes('getMemberStatusBadge'));
    assert.ok(source.includes("pending: 'pending'"));
  });

  it('IconButton tem hit area mínima de 32px e tooltip temático', () => {
    const source = readSrc('components/ui/IconButton.tsx');
    const tooltip = readSrc('components/ui/Tooltip.tsx');
    assert.ok(source.includes('h-icon-btn'));
    assert.ok(source.includes('w-icon-btn'));
    assert.ok(source.includes('<Tooltip label={label}>'));
    assert.equal(source.includes('title={label}'), false);
    assert.ok(source.includes('aria-label={label}'));
    assert.ok(tooltip.includes('doqyn-tooltip'));
    assert.ok(tooltip.includes('createPortal'));
  });

  it('Button converte title nativo em Tooltip temático', () => {
    const source = readSrc('components/ui/Button.tsx');
    assert.ok(source.includes('<Tooltip label={title}>'));
    assert.ok(source.includes('if (title)'));
  });

  it('WorkspaceRefreshButton usa Tooltip temático em vez de title nativo', () => {
    const source = readSrc('components/layout/WorkspaceRefreshButton.tsx');
    assert.ok(source.includes('<Tooltip label={label}>'));
    assert.equal(source.includes('title={label}'), false);
    assert.equal(source.includes('title='), false);
  });

  it('SegmentedIconToggle exibe tooltip temático por opção', () => {
    const source = readSrc('components/ui/SegmentedIconToggle.tsx');
    assert.ok(source.includes('<Tooltip'));
    assert.equal(source.includes('title='), false);
  });

  it('viewer de documentos usa palco e overlay temáticos', () => {
    const shell = readSrc('features/documents/viewer/DocumentViewerShell.tsx');
    const pdf = readSrc('features/documents/viewer/PdfPagesViewer.tsx');
    const image = readSrc('features/documents/viewer/ImageViewer.tsx');
    const globals = readSrc('styles/globals.css');
    assert.ok(shell.includes('viewer-overlay-scrim'));
    assert.equal(shell.includes('bg-black/'), false);
    assert.ok(pdf.includes('viewer-canvas-stage'));
    assert.equal(pdf.includes('#0b0d10'), false);
    assert.ok(image.includes('viewer-canvas-stage'));
    assert.ok(globals.includes('.viewer-canvas-stage'));
    assert.ok(globals.includes('--overlay-scrim'));
  });

  it('Input, Select e DateInput compartilham fieldControlClass', () => {
    const fieldStyles = readSrc('components/ui/fieldStyles.ts');
    const input = readSrc('components/ui/Input.tsx');
    const select = readSrc('components/ui/Select.tsx');
    const date = readSrc('components/ui/DateInput.tsx');

    assert.ok(fieldStyles.includes('fieldControlClass'));
    assert.ok(input.includes('fieldControlClass'));
    assert.ok(select.includes('fieldControlClass'));
    // `DateInput` virou invólucro fino de `DateField`, que abre o calendário do produto em
    // vez do calendário do navegador — a anatomia do campo mora lá agora.
    assert.ok(date.includes('DateField'));
    assert.ok(readSrc('components/ui/DateField.tsx').includes('calendar_today'));

  });

  it('Card expõe MetricCard e ContentCard', () => {
    const source = readSrc('components/ui/Card.tsx');
    assert.ok(source.includes('export function MetricCard'));
    assert.ok(source.includes('export function ContentCard'));
    assert.ok(source.includes('cardVariants'));
  });

  it('EmptyState é reutilizado por DataTable e AuditEmptyState', () => {
    const empty = readSrc('components/ui/EmptyState.tsx');
    const table = readSrc('components/ui/DataTable.tsx');
    const audit = readSrc('features/audit/components/AuditEmptyState.tsx');

    assert.ok(empty.includes('role="status"'));
    assert.ok(table.includes('EmptyState'));
    assert.ok(audit.includes('EmptyState'));
  });

  it('filtros de data usam DateInput em vez de input nativo cru', () => {
    const documents = readSrc('features/documents/DocumentsPage.tsx');
    const audit = readSrc('features/audit/components/AuditFilters.tsx');
    const tracking = readSrc('features/tracking/components/TrackingFilters.tsx');

    // O que importa é não ser `<input type="date">` cru; `DateInput` e `DateField` são a
    // mesma peça, o primeiro sendo o invólucro com API de input.
    for (const source of [documents, audit, tracking]) {
      assert.ok(source.includes('DateInput') || source.includes('DateField'));
      assert.equal(source.includes("type=\"date\""), false);
    }
    assert.equal(documents.includes('type="date"'), false);
    assert.equal(audit.includes('type="date"'), false);
  });

  it('botões primary e + Novo usam tokens índigo premium (legível em dark/light)', () => {
    const source = readSrc('components/ui/buttonVariants.ts');
    const newMenu = readSrc('features/library/components/NewButtonMenu.tsx');
    const tokens = readSrc('styles/tokens.css');
    const globals = readSrc('styles/globals.css');
    assert.ok(source.includes('primary:'));
    assert.ok(source.includes('action:'));
    assert.ok(source.includes('bg-doqyn-new-button'));
    assert.ok(source.includes('text-doqyn-new-button-text'));
    assert.ok(source.includes('outline:'));
    assert.ok(newMenu.includes('sidebar-new-button'));
    assert.ok(newMenu.includes('sidebar-new-menu__item'));
    assert.ok(tokens.includes('--new-button-bg:'));
    assert.ok(tokens.includes('--new-button-text:'));
    assert.ok(tokens.includes('--shadow-new-button: none'));
    assert.ok(tokens.includes('--new-menu-item-hover'));
    assert.ok(globals.includes('.sidebar-new-button:hover'));
    assert.ok(globals.includes('.sidebar-new-button[aria-expanded'));
  });

  it('miniaturas usam manifest autenticado com fallback para ícone', () => {
    const hook = readSrc('features/documents/preview/useDocumentThumbnail.ts');
    const utils = readSrc('features/documents/preview/documentThumbnailUtils.ts');
    const utilsLegacy = readSrc('components/ui/fileTypeUtils.ts');
    assert.ok(hook.includes('fetchPreviewManifest'));
    assert.ok(hook.includes('fetchPreviewAssetBlob'));
    assert.ok(hook.includes('ensureThumbnailObjectUrl'));
    assert.ok(utils.includes('resolveThumbnailAssetUrl'));
    assert.ok(utilsLegacy.includes('resolveFileTypeVisual'));
    assert.ok(utilsLegacy.includes("'pdf'"));
  });

  it('export central em components/ui/index.ts', () => {
    const source = readSrc('components/ui/index.ts');
    assert.ok(source.includes('IconButton'));
    assert.ok(source.includes('DateInput'));
    assert.ok(source.includes('MetricCard'));
    assert.ok(source.includes('fieldControlClass'));
    assert.ok(source.includes('FileTypeIcon'));
    assert.ok(source.includes('ToolbarSelect'));
    assert.ok(source.includes('Checkbox'));
    assert.ok(source.includes('Radio'));
  });

  it('Checkbox e Radio usam input oculto e indicador temático', () => {
    const checkbox = readSrc('components/ui/Checkbox.tsx');
    const radio = readSrc('components/ui/Radio.tsx');
    assert.ok(checkbox.includes('peer sr-only'));
    assert.ok(radio.includes('peer sr-only'));
    assert.ok(checkbox.includes('doqyn-primary'));
    assert.ok(radio.includes('doqyn-primary'));
  });

  it('ToolbarSelect e Select usam popover temático em vez de select nativo', () => {
    const toolbarSelect = readSrc('components/ui/ToolbarSelect.tsx');
    const select = readSrc('components/ui/Select.tsx');
    const item = readSrc('components/ui/DropdownMenuItem.tsx');
    const styles = readSrc('components/ui/dropdownMenuStyles.ts');
    assert.ok(toolbarSelect.includes('AnchoredPopover'));
    assert.ok(toolbarSelect.includes('DropdownMenuItem'));
    assert.equal(toolbarSelect.includes('<select'), false);
    assert.ok(select.includes('AnchoredPopover'));
    assert.ok(select.includes('DropdownMenuItem'));
    assert.equal(select.includes('<select'), false);
    // O item escolhido marca com régua de acento à esquerda, não com bloco preenchido.
    assert.ok(styles.includes('before:bg-doqyn-accent-active'));
    assert.ok(styles.includes('hover:bg-doqyn-hover/50'));
    assert.ok(item.includes('dropdownMenuItemSelectedClass'));
  });

  it('tokens.css define a paleta grafite/verdigris no claro e a hierarquia no escuro', () => {
    const source = readSrc('styles/tokens.css');
    assert.ok(source.includes('--accent-hover:'));
    assert.ok(source.includes('--shadow-elevation-1:'));
    assert.ok(source.includes('--shadow-elevation-2:'));
    assert.ok(source.includes('--color-background: #ffffff'));
    assert.ok(source.includes('--color-surface: #f5f7f8'));
    // Verdigris substituiu o azul do Google como acento: ele significa "interativo", e
    // nenhum estado de status pode usá-lo.
    assert.ok(source.includes('--color-primary: #0e6e6a'));
    // O fundo escuro é grafite, não o cinza do Material.
    assert.ok(source.includes('--bg-chrome: #0b0e10'));
    assert.ok(source.includes('--bg-surface: #161b20'));
    assert.ok(source.includes('--viewer-page-bg:'));
    assert.equal(source.includes('#faf7f1'), false);
  });

  it('bordas dark mode têm contraste maior que superfície', () => {
    const source = readSrc('styles/tokens.css');
    const borderMatch = source.match(
      /\[data-theme='dark'\][\s\S]*?--border-default:\s*(#[0-9a-f]+)/,
    );
    const surfaceMatch = source.match(/\[data-theme='dark'\][\s\S]*?--bg-surface:\s*(#[0-9a-f]+)/);
    assert.ok(borderMatch && surfaceMatch);

    const border = parseInt(borderMatch[1].slice(1), 16);
    const surface = parseInt(surfaceMatch[1].slice(1), 16);
    assert.ok(border > surface, 'borda deve ser mais clara que o fundo do card em dark mode');
  });

  it('tipografia centralizada em tokens.css, auto-hospedada', () => {
    const tokens = readSrc('styles/tokens.css');
    const globals = readSrc('styles/globals.css');
    const tailwind = readFileSync(join(__dirname, '..', 'tailwind.config.js'), 'utf8');
    const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

    assert.ok(tokens.includes('--font-display:'));
    assert.ok(tokens.includes('--font-body:'));
    assert.ok(tokens.includes('--text-h1:'));
    assert.ok(tokens.includes('--text-display:'));
    assert.ok(tokens.includes('--color-text-primary: var(--text-primary)'));
    assert.ok(globals.includes('.type-eyebrow'));
    assert.ok(globals.includes('.type-display'));
    assert.ok(globals.includes('.type-h1'));
    assert.ok(globals.includes('.type-h2'));
    assert.ok(globals.includes('.type-body'));
    assert.ok(globals.includes('.type-label'));
    assert.ok(globals.includes('.type-caption'));
    assert.ok(tailwind.includes("sans: ['var(--font-body)']"));
    assert.ok(tailwind.includes("display: ['var(--font-display)']"));
    // As fontes deixaram de vir do Google Fonts por `<link>` e passaram a ser auto-hospedadas
    // via `@fontsource`, declaradas em `tokens.css`.
    assert.equal(html.includes('fonts.googleapis.com'), false);
    assert.ok(tokens.includes("--font-body: 'Inter Variable'"));
    assert.ok(tokens.includes("--font-serif: 'Newsreader Variable'"));

    // A afirmação era o inverso disto: guardava que as fontes NÃO fossem auto-hospedadas,
    // porque vinham do Google por `<link>`. Auto-hospedar tira uma dependência de rede de
    // terceiro do caminho crítico e faz o app carregar igual sem sair da própria origem.
    assert.ok(globals.includes('@fontsource-variable/inter'));
    assert.ok(globals.includes('@fontsource-variable/newsreader'));
  });

  it('primitivos de UI usam classes semânticas de tipografia', () => {
    const table = readSrc('components/ui/DataTable.tsx');
    const badge = readSrc('components/ui/Badge.tsx');
    const buttons = readSrc('components/ui/buttonVariants.ts');
    const header = readSrc('components/layout/WorkspacePageHeader.tsx');

    assert.ok(table.includes('type-label'));
    assert.ok(badge.includes('font-mono'));
    assert.ok(buttons.includes('font-display'));
    assert.ok(buttons.includes('text-label'));
    assert.ok(header.includes('workspace-page-title'));
    assert.ok(header.includes('workspace-page-eyebrow'));
  });

  it('ícones unificados em Material Symbols Sharp via Icon', () => {
    const icon = readSrc('components/ui/Icon.tsx');
    const globals = readSrc('styles/globals.css');
    const sidebar = readSrc('components/layout/SidebarNavItem.tsx');
    const folderCard = readSrc('features/library/components/ExplorerFolderCard.tsx');
    const tokens = readSrc('styles/tokens.css');
    const packageJson = readFileSync(join(__dirname, '..', 'package.json'), 'utf8');

    // Sharp, não Rounded: a variante arredondada contradiz o canto de 4px do sistema.
    assert.ok(icon.includes('material-symbols-sharp'));
    assert.equal(icon.includes('material-symbols-rounded'), false);
    assert.ok(globals.includes("material-symbols/sharp.css"));
    assert.ok(sidebar.includes('name={item.icon}'));
    assert.ok(sidebar.includes('filled={isActive}'));
    assert.ok(folderCard.includes('name="folder"'));
    assert.ok(folderCard.includes('filled'));
    assert.ok(tokens.includes('--color-cat-contratos'));
    assert.ok(packageJson.includes('material-symbols'));
    assert.equal(packageJson.includes('lucide-react'), false);
  });

  it('toasts usam snackbar Material sem bordas coloridas', () => {
    const toaster = readSrc('components/ui/AppToaster.tsx');
    const globals = readSrc('styles/globals.css');
    const tokens = readSrc('styles/tokens.css');

    assert.ok(toaster.includes('position="bottom-center"'));
    assert.ok(toaster.includes('closeButton={false}'));
    assert.ok(toaster.includes('unstyled: true'));
    assert.ok(toaster.includes('app-toast'));
    assert.ok(globals.includes('.app-toast'));
    assert.ok(globals.includes('border: none'));
    assert.ok(tokens.includes('--toast-bg'));
    assert.ok(tokens.includes('--toast-shadow'));
  });
});

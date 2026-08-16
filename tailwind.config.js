/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        doqyn: {
          bg: 'color-mix(in srgb, var(--bg-app) calc(<alpha-value> * 100%), transparent)',
          chrome: 'color-mix(in srgb, var(--bg-chrome) calc(<alpha-value> * 100%), transparent)',
          shell: 'color-mix(in srgb, var(--bg-shell) calc(<alpha-value> * 100%), transparent)',
          canvas: 'color-mix(in srgb, var(--bg-canvas) calc(<alpha-value> * 100%), transparent)',
          'thumbnail-chrome':
            'color-mix(in srgb, var(--bg-thumbnail-chrome) calc(<alpha-value> * 100%), transparent)',
          sidebar: 'color-mix(in srgb, var(--bg-sidebar) calc(<alpha-value> * 100%), transparent)',
          surface: 'color-mix(in srgb, var(--bg-surface) calc(<alpha-value> * 100%), transparent)',
          'surface-hover':
            'color-mix(in srgb, var(--bg-surface-hover) calc(<alpha-value> * 100%), transparent)',
          panel: 'color-mix(in srgb, var(--bg-surface) calc(<alpha-value> * 100%), transparent)',
          card: 'color-mix(in srgb, var(--bg-surface-2) calc(<alpha-value> * 100%), transparent)',
          panelSoft:
            'color-mix(in srgb, var(--bg-surface-3) calc(<alpha-value> * 100%), transparent)',
          overlay:
            'color-mix(in srgb, var(--bg-surface-2) calc(<alpha-value> * 100%), transparent)',
          border:
            'color-mix(in srgb, var(--border-default) calc(<alpha-value> * 100%), transparent)',
          'border-subtle':
            'color-mix(in srgb, var(--border-subtle) calc(<alpha-value> * 100%), transparent)',
          'border-strong':
            'color-mix(in srgb, var(--border-strong) calc(<alpha-value> * 100%), transparent)',
          text: 'color-mix(in srgb, var(--text-primary) calc(<alpha-value> * 100%), transparent)',
          foreground:
            'color-mix(in srgb, var(--text-primary) calc(<alpha-value> * 100%), transparent)',
          muted:
            'color-mix(in srgb, var(--text-secondary) calc(<alpha-value> * 100%), transparent)',
          subtle:
            'color-mix(in srgb, var(--text-tertiary) calc(<alpha-value> * 100%), transparent)',
          disabled:
            'color-mix(in srgb, var(--text-disabled) calc(<alpha-value> * 100%), transparent)',
          hint: 'color-mix(in srgb, var(--text-hint) calc(<alpha-value> * 100%), transparent)',
          action:
            'color-mix(in srgb, var(--accent-active) calc(<alpha-value> * 100%), transparent)',
          actionHover:
            'color-mix(in srgb, var(--accent-hover) calc(<alpha-value> * 100%), transparent)',
          primary:
            'color-mix(in srgb, var(--accent-active) calc(<alpha-value> * 100%), transparent)',
          'primary-hover':
            'color-mix(in srgb, var(--accent-hover) calc(<alpha-value> * 100%), transparent)',
          'primary-soft':
            'color-mix(in srgb, var(--accent-active-bg) calc(<alpha-value> * 100%), transparent)',
          'primary-bg':
            'color-mix(in srgb, var(--accent-active-bg) calc(<alpha-value> * 100%), transparent)',
          success:
            'color-mix(in srgb, var(--status-ok-text) calc(<alpha-value> * 100%), transparent)',
          'success-bg':
            'color-mix(in srgb, var(--status-ok-bg) calc(<alpha-value> * 100%), transparent)',
          'success-border':
            'color-mix(in srgb, var(--status-ok-border) calc(<alpha-value> * 100%), transparent)',
          'success-dot':
            'color-mix(in srgb, var(--status-ok-dot) calc(<alpha-value> * 100%), transparent)',
          warning:
            'color-mix(in srgb, var(--status-warn-text) calc(<alpha-value> * 100%), transparent)',
          'warning-bg':
            'color-mix(in srgb, var(--status-warn-bg) calc(<alpha-value> * 100%), transparent)',
          'warning-border':
            'color-mix(in srgb, var(--status-warn-border) calc(<alpha-value> * 100%), transparent)',
          'warning-dot':
            'color-mix(in srgb, var(--status-warn-dot) calc(<alpha-value> * 100%), transparent)',
          danger:
            'color-mix(in srgb, var(--status-danger-text) calc(<alpha-value> * 100%), transparent)',
          'danger-bg':
            'color-mix(in srgb, var(--status-danger-bg) calc(<alpha-value> * 100%), transparent)',
          'danger-border':
            'color-mix(in srgb, var(--status-danger-border) calc(<alpha-value> * 100%), transparent)',
          'danger-dot':
            'color-mix(in srgb, var(--status-danger-dot) calc(<alpha-value> * 100%), transparent)',
          pending:
            'color-mix(in srgb, var(--status-pending-text) calc(<alpha-value> * 100%), transparent)',
          'pending-bg':
            'color-mix(in srgb, var(--status-pending-bg) calc(<alpha-value> * 100%), transparent)',
          'pending-border':
            'color-mix(in srgb, var(--status-pending-border) calc(<alpha-value> * 100%), transparent)',
          'pending-dot':
            'color-mix(in srgb, var(--status-pending-dot) calc(<alpha-value> * 100%), transparent)',
          info: 'color-mix(in srgb, var(--status-info-text) calc(<alpha-value> * 100%), transparent)',
          'info-bg':
            'color-mix(in srgb, var(--status-info-bg) calc(<alpha-value> * 100%), transparent)',
          'info-border':
            'color-mix(in srgb, var(--status-info-border) calc(<alpha-value> * 100%), transparent)',
          'info-dot':
            'color-mix(in srgb, var(--status-info-dot) calc(<alpha-value> * 100%), transparent)',
          neutral:
            'color-mix(in srgb, var(--status-neutral-text) calc(<alpha-value> * 100%), transparent)',
          'neutral-bg':
            'color-mix(in srgb, var(--status-neutral-bg) calc(<alpha-value> * 100%), transparent)',
          'neutral-border':
            'color-mix(in srgb, var(--status-neutral-border) calc(<alpha-value> * 100%), transparent)',
          'neutral-dot':
            'color-mix(in srgb, var(--status-neutral-dot) calc(<alpha-value> * 100%), transparent)',
          hover: 'color-mix(in srgb, var(--overlay-hover) calc(<alpha-value> * 100%), transparent)',
          active:
            'color-mix(in srgb, var(--overlay-active) calc(<alpha-value> * 100%), transparent)',
          logo: 'color-mix(in srgb, var(--logo-text) calc(<alpha-value> * 100%), transparent)',
          'logo-muted':
            'color-mix(in srgb, var(--logo-muted) calc(<alpha-value> * 100%), transparent)',
          'accent-active':
            'color-mix(in srgb, var(--accent-active) calc(<alpha-value> * 100%), transparent)',
          'accent-active-bg':
            'color-mix(in srgb, var(--accent-active-bg) calc(<alpha-value> * 100%), transparent)',
          'accent-hover':
            'color-mix(in srgb, var(--accent-hover) calc(<alpha-value> * 100%), transparent)',
          'on-accent':
            'color-mix(in srgb, var(--text-on-accent) calc(<alpha-value> * 100%), transparent)',
          selected:
            'color-mix(in srgb, var(--bg-selected) calc(<alpha-value> * 100%), transparent)',
          'sidebar-selected':
            'color-mix(in srgb, var(--sidebar-selected-bg) calc(<alpha-value> * 100%), transparent)',
          'sidebar-selected-border':
            'color-mix(in srgb, var(--sidebar-selected-border) calc(<alpha-value> * 100%), transparent)',
          'sidebar-selected-text':
            'color-mix(in srgb, var(--sidebar-selected-text) calc(<alpha-value> * 100%), transparent)',
          'sidebar-selected-icon':
            'color-mix(in srgb, var(--sidebar-selected-icon) calc(<alpha-value> * 100%), transparent)',
          'sidebar-item-hover':
            'color-mix(in srgb, var(--sidebar-item-hover-bg) calc(<alpha-value> * 100%), transparent)',
          'new-button':
            'color-mix(in srgb, var(--new-button-bg) calc(<alpha-value> * 100%), transparent)',
          'new-button-hover':
            'color-mix(in srgb, var(--new-button-bg-hover) calc(<alpha-value> * 100%), transparent)',
          'new-button-active':
            'color-mix(in srgb, var(--new-button-bg-active) calc(<alpha-value> * 100%), transparent)',
          'new-button-text':
            'color-mix(in srgb, var(--new-button-text) calc(<alpha-value> * 100%), transparent)',
          'new-button-border':
            'color-mix(in srgb, var(--new-button-border) calc(<alpha-value> * 100%), transparent)',
          'new-menu':
            'color-mix(in srgb, var(--new-menu-bg) calc(<alpha-value> * 100%), transparent)',
          'new-menu-icon':
            'color-mix(in srgb, var(--new-menu-icon) calc(<alpha-value> * 100%), transparent)',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        logo: ['var(--font-display)'],
        mono: ['var(--font-family-mono)'],
      },
      fontSize: {
        eyebrow: [
          'var(--text-eyebrow)',
          {
            lineHeight: 'var(--leading-eyebrow)',
            letterSpacing: 'var(--tracking-eyebrow)',
            fontWeight: 'var(--weight-eyebrow)',
          },
        ],
        display: [
          'var(--text-display)',
          {
            lineHeight: 'var(--leading-display)',
            letterSpacing: 'var(--tracking-display)',
            fontWeight: 'var(--weight-display)',
          },
        ],
        h1: [
          'var(--text-h1)',
          {
            lineHeight: 'var(--leading-h1)',
            letterSpacing: 'var(--tracking-h1)',
            fontWeight: 'var(--weight-h1)',
          },
        ],
        h2: [
          'var(--text-h2)',
          {
            lineHeight: 'var(--leading-h2)',
            letterSpacing: 'var(--tracking-h2)',
            fontWeight: 'var(--weight-h2)',
          },
        ],
        body: [
          'var(--text-body)',
          { lineHeight: 'var(--leading-body)', fontWeight: 'var(--weight-body)' },
        ],
        label: [
          'var(--text-label)',
          {
            lineHeight: 'var(--leading-label)',
            letterSpacing: 'var(--tracking-label)',
            fontWeight: 'var(--weight-label)',
          },
        ],
        caption: [
          'var(--text-caption)',
          { lineHeight: 'var(--leading-caption)', fontWeight: 'var(--weight-caption)' },
        ],
        micro: [
          'var(--text-micro)',
          { lineHeight: 'var(--leading-micro)', fontWeight: 'var(--weight-micro)' },
        ],
        xs: ['var(--text-caption)', { lineHeight: 'var(--leading-caption)' }],
        sm: ['var(--text-body)', { lineHeight: 'var(--leading-body)' }],
        base: ['var(--text-body)', { lineHeight: 'var(--leading-body)' }],
        lg: ['var(--text-h2)', { lineHeight: 'var(--leading-h2)' }],
        xl: ['var(--text-h1)', { lineHeight: 'var(--leading-h1)' }],
        '2xl': ['var(--text-display)', { lineHeight: 'var(--leading-display)' }],
      },
      // Degraus fora da escala padrão do Tailwind já usados nas telas.
      // Sem eles o modificador é descartado em silêncio e a classe não gera regra.
      opacity: {
        8: '0.08',
        12: '0.12',
        15: '0.15',
        35: '0.35',
        45: '0.45',
        55: '0.55',
      },
      fontWeight: {
        normal: 'var(--weight-body)',
        medium: 'var(--weight-label)',
        semibold: 'var(--weight-h2)',
        bold: '700',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        shell: 'var(--radius-shell)',
        workspace: 'var(--radius-workspace)',
        'new-button': 'var(--radius-new-button)',
      },
      spacing: {
        field: 'var(--field-height)',
        'icon-btn': 'var(--icon-button-size)',
      },
      height: {
        field: 'var(--field-height)',
        'icon-btn': 'var(--icon-button-size)',
      },
      width: {
        'icon-btn': 'var(--icon-button-size)',
      },
      minHeight: {
        field: 'var(--field-height)',
        'icon-btn': 'var(--icon-button-size)',
      },
      minWidth: {
        'icon-btn': 'var(--icon-button-size)',
      },
      boxShadow: {
        card: 'none',
        modal: 'var(--shadow-modal)',
        dropdown: 'var(--shadow-dropdown)',
        sm: 'var(--shadow-sm)',
        shell: 'var(--shadow-shell)',
        'card-hover': 'var(--shadow-card-hover)',
        'action-glow': 'var(--shadow-action-glow)',
        'elevation-1': 'var(--shadow-elevation-1)',
        'elevation-2': 'var(--shadow-elevation-2)',
        'sticky-footer': 'var(--shadow-sticky-footer)',
        'new-button': 'var(--shadow-new-button)',
        'new-button-hover': 'var(--shadow-new-button-hover)',
      },
    },
  },
  plugins: [],
};

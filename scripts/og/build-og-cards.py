"""
Desenha os cartões de link (Open Graph) do DOQYN.

Todo texto vira contorno antes de sair daqui. O cartão é rasterizado no servidor e por
robôs de rede social, onde nenhuma fonte da marca está instalada — deixar `font-family` no
SVG faria o wordmark cair numa serifada genérica sem aviso nenhum. Contorno é o único jeito
de o arquivo carregar a própria tipografia.

As fontes saem de node_modules (@fontsource-variable), então o resultado acompanha a versão
que o app usa. Rode com as dependências instaladas:

    python3 scripts/og/build-og-cards.py     # gera os .svg
    node scripts/og/build-og-cards.mjs       # rasteriza para .png

Requer fontTools e brotli (para ler woff2): pip install fonttools brotli
"""

import os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, 'public', 'og')

NEWSREADER = os.path.join(
    ROOT, 'node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2'
)
GEIST_MONO = os.path.join(
    ROOT, 'node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2'
)

# Paleta travada no kit de marca. Latão não entra: ele é exclusivo de atestação, e um
# documento à espera de assinatura ainda não atestou nada.
BG = '#0b0e10'        # grafite, --bg-chrome
ACCENT = '#35A69F'    # verdigris
INK = '#E6E9EC'
MUTED = '#8A949C'
HAIRLINE = '#232a31'

WIDTH, HEIGHT = 1200, 630
MARGIN = 88
MARK_SIZE = 52


def load(path, weight):
    font = TTFont(path)
    if 'fvar' in font:
        font = instantiateVariableFont(font, {'wght': weight}, inplace=False, updateFontNames=False)
    return font


def text_paths(font, text, size, tracking_em=0.0):
    """Converte uma linha em <path>. Sem shaping: latim sem ligadura, avanço simples basta."""
    upm = font['head'].unitsPerEm
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font['hmtx']
    scale = size / upm
    x = 0.0
    parts = []
    for char in text:
        name = cmap.get(ord(char))
        if name is None:
            raise SystemExit(f'glifo ausente na fonte: {char!r}')
        if char != ' ':
            pen = SVGPathPen(glyphs)
            glyphs[name].draw(pen)
            commands = pen.getCommands()
            if commands:
                parts.append(
                    f'<path transform="translate({x:.2f} 0) '
                    f'scale({scale:.5f} {-scale:.5f})" d="{commands}"/>'
                )
        x += hmtx[name][0] * scale + tracking_em * size
    return ''.join(parts)


def mark(x, y, size, color):
    """O Selo — mesmo desenho de src/components/brand/DoqynMark.tsx, na escala grande."""
    return (
        f'<g transform="translate({x} {y}) scale({size / 48:.5f})" fill="none" stroke="{color}">'
        '<circle cx="22" cy="22" r="15" stroke-width="3"/>'
        '<circle cx="22" cy="22" r="10" stroke-width="1.6" opacity="0.5"/>'
        '<path d="M25.5 25.5 L38 38" stroke-width="4.6" stroke-linecap="round"/>'
        '</g>'
    )


def build_card(title, newsreader_medium, newsreader_regular, geist_mono):
    wordmark = text_paths(newsreader_medium, 'DOQYN', 34, tracking_em=0.30)
    heading = text_paths(newsreader_regular, title, 66)
    footer = text_paths(geist_mono, 'APP.DOQYN.COM', 20, tracking_em=0.14)

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">
  <rect width="{WIDTH}" height="{HEIGHT}" fill="{BG}"/>
  <rect x="0" y="0" width="{WIDTH}" height="{HEIGHT}" fill="none" stroke="{HAIRLINE}" stroke-width="2"/>
  {mark(MARGIN, MARGIN - 6, MARK_SIZE, ACCENT)}
  <g transform="translate({MARGIN + MARK_SIZE + 22} {MARGIN + MARK_SIZE * 0.72:.0f})" fill="{INK}">{wordmark}</g>
  <g transform="translate({MARGIN} {HEIGHT / 2 + 40:.0f})" fill="{INK}">{heading}</g>
  <rect x="{MARGIN}" y="{HEIGHT / 2 + 78:.0f}" width="132" height="2" fill="{ACCENT}"/>
  <g transform="translate({MARGIN} {HEIGHT - MARGIN + 8})" fill="{MUTED}">{footer}</g>
</svg>'''


CARDS = {
    'portal-card-sign': 'Documento para assinar',
    'portal-card-share': 'Documento compartilhado',
    'portal-card': 'Documento',
}


def main():
    newsreader_medium = load(NEWSREADER, 500)
    newsreader_regular = load(NEWSREADER, 400)
    geist_mono = load(GEIST_MONO, 500)

    os.makedirs(OUT_DIR, exist_ok=True)
    for name, title in CARDS.items():
        svg = build_card(title, newsreader_medium, newsreader_regular, geist_mono)
        path = os.path.join(OUT_DIR, f'{name}.svg')
        with open(path, 'w') as handle:
            handle.write(svg)
        print(f'{name}.svg  ({title})')


if __name__ == '__main__':
    main()

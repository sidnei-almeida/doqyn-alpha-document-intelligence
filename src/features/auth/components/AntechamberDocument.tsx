import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { DoqynMark } from '@/components/brand/DoqynMark';

/**
 * O painel da antessala — o DOQYN lendo um documento atrás do outro.
 *
 * Não é ilustração nem foto de banco de imagem: é o produto. A página tem
 * proporção A4, aparece na cor real dela (o kit proíbe escurecer documento), o
 * conteúdo se escreve, uma varredura desce lendo, e cada extração assenta
 * quando a varredura passa pela linha de onde ela saiu.
 *
 * Três tipos passam pelo mesmo quadro — contrato, desenho técnico e tabela —,
 * porque é isso que o app aceita, e um contrato sozinho contaria só um terço da
 * história.
 *
 * **O laço não fere a regra "nada pisca", e o que o protege é o ritmo.** Cada
 * documento fica quase oito segundos parado depois de lido, e a troca é por
 * esmaecimento. Quem está digitando a senha vê, de canto de olho, uma página
 * sendo lida devagar — não um letreiro alternando.
 *
 * A proporção **não** muda entre eles, mesmo que desenho técnico costume ser
 * paisagem: trocar o formato no meio do laço faria o painel saltar atrás do
 * formulário, e o salto é justamente o movimento que a regra veta. A variedade
 * vem do conteúdo.
 */

/** Cada extração assenta no instante em que a varredura cruza a linha dela. */
type Anno = { top: string; label: string; value: string; delay: number };

type DocumentSpec = {
  id: string;
  eyebrow: string;
  title: string;
  /** O selo do pé: contrato termina assinado, desenho aprovado, tabela conferida. */
  stamp: string;
  hash: string;
  body: React.ReactNode;
  annotations: Anno[];
};

/**
 * O tempo de um documento no quadro, em milissegundos.
 *
 * É o mesmo número da animação `auth-doc-life` em `globals.css`. Se divergirem,
 * a página some antes da troca ou salta depois dela.
 */
const DOCUMENT_MS = 8400;

/** A página é montada em blocos com cláusula nomeada, não como um bloco único
 *  de tarja cinza: é a cláusula que dá sentido ao fio da extração que sai dali.
 *  Larguras irregulares de propósito — bloco retangular perfeito lê como
 *  placeholder, não como texto. */
type Block = { clause?: string; lines: number[] };

const CONTRACT_BLOCKS: Block[] = [
  { lines: [92, 88, 96, 64] },
  { clause: 'Cláusula 1ª — Do objeto', lines: [94, 90, 96, 71] },
  { clause: 'Cláusula 4ª — Da vigência', lines: [88, 96, 90, 62] },
  { clause: 'Cláusula 7ª — Do preço e do pagamento', lines: [92, 86, 94, 68] },
  { clause: 'Cláusula 9ª — Do foro', lines: [90, 54] },
];

function ContractBody() {
  return (
    <div className="mt-5 flex flex-1 flex-col gap-4" aria-hidden>
      {CONTRACT_BLOCKS.map((block, b) => (
        <div key={b} className="flex flex-col gap-[6px]">
          {block.clause ? (
            <span
              className="auth-write mb-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-[#A4AEB4]"
              style={{ animationDelay: `${640 + b * 190}ms` }}
            >
              {block.clause}
            </span>
          ) : null}
          {block.lines.map((width, i) => (
            <span
              key={i}
              className="auth-line block h-[4px] rounded-[1px] bg-[#DFE4E7]"
              style={{ width: `${width}%`, animationDelay: `${680 + b * 190 + i * 46}ms` }}
            />
          ))}
        </div>
      ))}

      {/* Bloco de assinaturas: é a âncora real do fio "Assinatura", e é o
          que dá peso ao pé da página. Contrato termina assinado. */}
      <div className="mt-auto grid grid-cols-2 gap-5 pb-5">
        {['Nortis Engenharia', 'Vetor Log'].map((party, i) => (
          <div
            key={party}
            className="auth-write flex flex-col gap-1.5"
            style={{ animationDelay: `${2280 + i * 110}ms` }}
          >
            <span className="h-[26px] border-b border-[#C9D1D6]" />
            <span className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#8B979E]">
              {party}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Planta baixa com cotas e carimbo.
 *
 * Em SVG, e não em blocos como o contrato: desenho técnico é geometria, e
 * imitá-lo com tarjas cinzas leria como texto borrado. As cotas existem porque
 * são elas que justificam o fio "Área" — extração de desenho sai da cota, não
 * do parágrafo.
 */
function DrawingBody() {
  return (
    <div className="mt-5 flex flex-1 flex-col" aria-hidden>
      <svg
        viewBox="0 0 200 240"
        className="auth-write w-full flex-1"
        style={{ animationDelay: '660ms' }}
        fill="none"
      >
        {/* perímetro */}
        <rect x="26" y="26" width="150" height="150" stroke="#C2CBD1" strokeWidth="1.6" />
        {/* divisórias internas */}
        <path d="M26 96 H112 M112 26 V176 M112 130 H176" stroke="#D5DCE0" strokeWidth="1.1" />
        {/* aberturas */}
        <path d="M62 96 h20 M112 60 v18 M112 148 v16" stroke="#FBFCFC" strokeWidth="2.4" />
        {/* hachura de área molhada */}
        <path
          d="M120 138 l14 -14 M128 146 l14 -14 M136 154 l14 -14 M144 162 l14 -14"
          stroke="#E4E9EC"
          strokeWidth="1"
        />
        {/* cota horizontal */}
        <path d="M26 194 H176 M26 190 v8 M176 190 v8" stroke="#B7C1C8" strokeWidth="0.9" />
        <text
          x="101"
          y="188"
          textAnchor="middle"
          fontSize="7"
          fill="#8B979E"
          fontFamily="monospace"
        >
          12,00
        </text>
        {/* cota vertical */}
        <path d="M12 26 V176 M8 26 h8 M8 176 h8" stroke="#B7C1C8" strokeWidth="0.9" />
        <text
          x="10"
          y="101"
          textAnchor="middle"
          fontSize="7"
          fill="#8B979E"
          fontFamily="monospace"
          transform="rotate(-90 10 101)"
        >
          12,35
        </text>
        {/* carimbo */}
        <rect x="112" y="206" width="64" height="26" stroke="#D5DCE0" strokeWidth="1" />
        <path d="M112 218 H176 M144 218 V232" stroke="#E4E9EC" strokeWidth="0.9" />
        <text x="116" y="215" fontSize="6" fill="#A4AEB4" fontFamily="monospace">
          PAV. TÉRREO
        </text>
      </svg>
    </div>
  );
}

/**
 * Planilha de medição.
 *
 * Colunas de largura desigual e a última alinhada à direita, porque é a de
 * valor: tabela com todas as colunas iguais lê como grade decorativa, não como
 * dado. A linha de total é o que ancora o fio "Total".
 */
const TABLE_ROWS: Array<[number, number, number]> = [
  [46, 22, 30],
  [58, 18, 26],
  [40, 26, 32],
  [52, 20, 28],
  [44, 24, 30],
  [61, 17, 24],
  [38, 27, 33],
  [50, 21, 29],
  [55, 19, 27],
  [42, 25, 31],
  [49, 23, 28],
  [63, 16, 25],
  [37, 28, 34],
  [54, 20, 26],
  [47, 22, 31],
  [59, 18, 27],
  [41, 26, 29],
  [51, 21, 33],
  [45, 24, 26],
  [57, 19, 30],
];

function TableBody() {
  return (
    <div className="mt-5 flex flex-1 flex-col" aria-hidden>
      {/* cabeçalho */}
      <div
        className="auth-write flex items-end gap-3 border-b border-[#C9D1D6] pb-2"
        style={{ animationDelay: '640ms' }}
      >
        {['Item', 'Qtd.', 'Valor'].map((head, i) => (
          <span
            key={head}
            className={`font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#8B979E] ${
              i === 0 ? 'flex-1' : i === 1 ? 'w-9 text-right' : 'w-14 text-right'
            }`}
          >
            {head}
          </span>
        ))}
      </div>

      <div className="flex flex-col">
        {TABLE_ROWS.map((row, r) => (
          <div key={r} className="flex items-center gap-3 border-b border-[#F0F3F5] py-[5px]">
            <span className="flex-1">
              <span
                className="auth-line block h-[4px] rounded-[1px] bg-[#DFE4E7]"
                style={{ width: `${row[0]}%`, animationDelay: `${700 + r * 42}ms` }}
              />
            </span>
            <span className="flex w-9 justify-end">
              <span
                className="auth-line block h-[4px] rounded-[1px] bg-[#E4E9EC]"
                style={{ width: `${row[1]}px`, animationDelay: `${714 + r * 42}ms` }}
              />
            </span>
            <span className="flex w-14 justify-end">
              <span
                className="auth-line block h-[4px] rounded-[1px] bg-[#DFE4E7]"
                style={{ width: `${row[2]}px`, animationDelay: `${728 + r * 42}ms` }}
              />
            </span>
          </div>
        ))}
      </div>

      {/* a linha de total: é a âncora do fio "Total", e o que fecha a planilha */}
      <div
        className="auth-write mt-auto flex items-center justify-between border-t border-[#C9D1D6] pb-5 pt-2.5"
        style={{ animationDelay: '2280ms' }}
      >
        <span className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#8B979E]">
          Total do período
        </span>
        <span className="font-mono text-[10px] text-[#14181B]">1.284.900,00</span>
      </div>
    </div>
  );
}

const DOCUMENTS: DocumentSpec[] = [
  {
    id: 'contrato',
    eyebrow: 'Contrato de prestação de serviços',
    title: 'Nortis Engenharia',
    stamp: 'Assinado',
    hash: 'sha 9f2c·41ab',
    body: <ContractBody />,
    annotations: [
      { top: '22%', label: 'Partes', value: 'Nortis Engenharia · Vetor Log', delay: 1500 },
      { top: '42%', label: 'Vigência', value: '24 meses · 12 ago 2028', delay: 1960 },
      { top: '80%', label: 'Assinatura', value: '12 ago 2026', delay: 2380 },
    ],
  },
  {
    id: 'desenho',
    eyebrow: 'Projeto arquitetônico · planta baixa',
    title: 'Residência Vila Marta',
    stamp: 'Aprovado',
    hash: 'sha 4d17·b8e2',
    body: <DrawingBody />,
    annotations: [
      { top: '26%', label: 'Escala', value: '1:50 · A4', delay: 1500 },
      { top: '52%', label: 'Área', value: '148,20 m²', delay: 1960 },
      { top: '78%', label: 'Revisão', value: 'R03 · 04 ago 2026', delay: 2380 },
    ],
  },
  {
    id: 'tabela',
    eyebrow: 'Planilha de medição · agosto',
    title: 'Vetor Log — Frota',
    stamp: 'Conferido',
    hash: 'sha 71ac·9f30',
    body: <TableBody />,
    annotations: [
      { top: '24%', label: 'Competência', value: 'ago 2026', delay: 1500 },
      { top: '50%', label: 'Linhas', value: '148 itens', delay: 1960 },
      { top: '82%', label: 'Total', value: 'R$ 1.284.900,00', delay: 2380 },
    ],
  },
];

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function AntechamberDocument() {
  const location = useLocation();
  // A leitura se repete a cada navegação — trocar de tela é ato deliberado, e
  // um pulso por gesto não é o movimento ocioso que a regra "nada pisca" veta.
  const first = useRef(true);
  const isFirst = first.current;
  first.current = false;

  const [index, setIndex] = useState(0);

  /**
   * O laço não roda para quem pediu menos movimento.
   *
   * O CSS já anula as animações nesse modo, mas o temporizador não é CSS: sem
   * este desvio, a página trocaria de documento em silêncio a cada oito
   * segundos — movimento sem aviso, que é pior que a animação recusada.
   */
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % DOCUMENTS.length),
      DOCUMENT_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  const doc = DOCUMENTS[index];

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden px-8">
      {/* o par página + extrações é centrado como um conjunto só; centrar apenas
          a página deixaria a massa visual pendendo para a direita */}
      <div className="flex items-stretch">
        {/* A chave é o documento: trocá-la remonta a folha inteira, e é o que
            faz o texto se escrever e a varredura descer de novo a cada tipo. */}
        <div key={doc.id} className="auth-doc flex items-stretch">
          <div className="relative w-[min(46vh,464px)]">
            {/* a página, em proporção A4 */}
            <div className="auth-page relative flex aspect-[1/1.414] flex-col overflow-hidden rounded-[3px] bg-[#FBFCFC] px-8 py-7 shadow-[0_2px_8px_rgba(0,0,0,.45),0_28px_70px_-12px_rgba(0,0,0,.6)]">
              <span className="absolute inset-y-0 left-[22px] w-px bg-[#EBEFF1]" aria-hidden />

              <p className="auth-write font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#8B979E] [animation-delay:420ms]">
                {doc.eyebrow}
              </p>
              <p className="auth-write mt-1.5 font-serif text-[17px] font-medium leading-tight text-[#14181B] [animation-delay:540ms]">
                {doc.title}
              </p>

              {doc.body}

              <div className="auth-write flex items-center justify-between border-t border-[#EDF0F2] pt-4 [animation-delay:2600ms]">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#8B979E]">
                  {doc.hash}
                </span>
                {/* latão: contorno, nunca preenchimento */}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7C6220] px-2.5 py-[3px] font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#7C6220]">
                  <DoqynMark size={9} />
                  {doc.stamp}
                </span>
              </div>

              {/* a varredura: desce uma vez por documento, lendo */}
              <span
                key={`${location.pathname}-${doc.id}`}
                className="auth-scan pointer-events-none absolute inset-x-0 top-0 h-[38%]"
                style={{ animationDelay: isFirst && index === 0 ? '1.16s' : '0.18s' }}
                aria-hidden
              />
            </div>
          </div>

          {/* o que a IA leu, saindo da página */}
          {/* estica junto com a página: as porcentagens de topo precisam medir
              contra a altura real da A4, senão o fio aponta para a cláusula errada */}
          <div className="relative hidden w-[184px] shrink-0 xl:block">
            {doc.annotations.map((anno) => (
              <div
                key={anno.label}
                className="auth-anno absolute flex items-center gap-3"
                style={{ top: anno.top, animationDelay: `${anno.delay}ms` }}
              >
                <span className="h-px w-10 bg-doqyn-accent-active/55" />
                <span className="flex flex-col whitespace-nowrap">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-doqyn-accent-active">
                    {anno.label}
                  </span>
                  <span className="text-micro text-doqyn-muted">{anno.value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

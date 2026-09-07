import { useRef, useState } from 'react';
import type { AnimationEvent } from 'react';
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
 * Sete tipos passam pelo mesmo quadro: contrato, habilitação, desenho técnico,
 * planilha, conta de luz, nota fiscal e uma folha digitalizada. É isso que o app
 * aceita, e um contrato sozinho contaria um sétimo da história.
 *
 * Dois deles são de pessoa física, e estão aí por uma razão que não é decorativa:
 * quem chega nesta tela ainda não escolheu entre abrir uma empresa e guardar os
 * próprios papéis. Um painel só de contrato e nota fiscal responde essa pergunta
 * antes de ela ser feita, e responde errado. A habilitação vem em segundo lugar
 * no laço de propósito: quem olha o login por quinze segundos vê dois documentos,
 * e um deles precisa ser de pessoa.
 *
 * A digitalizada existe por um motivo próprio: é o único caso em que a leitura
 * não é trivial, e é justamente o que o OCR faz. Mostrar só documento nascido
 * digital esconderia a parte difícil do produto.
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

/**
 * Nota fiscal eletrônica.
 *
 * O que a identifica não é o texto, é a chave de 44 dígitos e o código de
 * barras — e são eles que justificam o fio "Chave". Os dígitos vão em grupos de
 * quatro porque é assim que a chave é impressa e conferida; um bloco corrido de
 * 44 números leria como ruído.
 */
const BARCODE = [
  3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 1, 2, 3, 2, 1, 1, 2, 3, 1, 2, 1, 3, 1, 1, 2, 2, 3, 1, 1, 2, 1, 3, 2,
  1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2,
];

const INVOICE_ROWS: Array<[string, number]> = [
  ['Transporte rodoviário — rota SP/PR', 78],
  ['Armazenagem — 12 dias', 62],
  ['Seguro de carga', 54],
  ['Coleta em domicílio', 47],
  ['Pedágio — eixo suspenso', 39],
  ['Reentrega autorizada', 44],
  ['Manuseio de carga paletizada', 66],
  ['Escolta armada — trecho 2', 58],
  ['Ad valorem sobre a mercadoria', 71],
  ['Taxa de emissão', 41],
];

/** O bloco de tributos: é o que faz a folha ler como nota, e não como recibo. */
const INVOICE_TAXES: Array<[string, string]> = [
  ['ICMS 12%', '5.846,44'],
  ['PIS 1,65%', '803,89'],
  ['COFINS 7,6%', '3.702,75'],
];

function InvoiceBody() {
  return (
    <div className="mt-5 flex flex-1 flex-col gap-4" aria-hidden>
      {/* A chave vem no alto, como na nota impressa: é o primeiro campo que
          quem confere procura. */}
      <div
        className="auth-write flex flex-col gap-1 border-y border-[#EDF0F2] py-2"
        style={{ animationDelay: '620ms' }}
      >
        <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-[#A4AEB4]">
          Chave de acesso
        </span>
        <span className="font-mono text-[8px] leading-relaxed tracking-[0.06em] text-[#5A6B75]">
          3526 0842 7719 0001 8955 0010 0000 4127 1904 8853 2610
        </span>
      </div>

      <div className="auth-write flex items-end gap-[2px]" style={{ animationDelay: '760ms' }}>
        {BARCODE.map((weight, i) => (
          <span
            key={i}
            className="block h-8 bg-[#14181B]"
            style={{ width: `${weight}px`, opacity: i % 2 ? 0.15 : 0.82 }}
          />
        ))}
      </div>

      <div className="flex flex-col">
        {INVOICE_ROWS.map(([label, width], r) => (
          <div key={label} className="flex items-center gap-3 border-b border-[#F0F3F5] py-[6px]">
            <span
              className="auth-write flex-1 font-mono text-[7.5px] text-[#8B979E]"
              style={{ animationDelay: `${900 + r * 90}ms` }}
            >
              {label}
            </span>
            <span className="flex w-14 justify-end">
              <span
                className="auth-line block h-[4px] rounded-[1px] bg-[#DFE4E7]"
                style={{ width: `${width}px`, animationDelay: `${930 + r * 90}ms` }}
              />
            </span>
          </div>
        ))}
      </div>

      {/* Onde a nota impressa põe "dados adicionais" — é o que fecha o vão entre
          os itens e os tributos, e o que uma nota real nunca deixa em branco. */}
      <div
        className="auth-write mt-auto flex flex-col gap-[6px] border-t border-[#F0F3F5] pt-2.5"
        style={{ animationDelay: '2040ms' }}
      >
        <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-[#A4AEB4]">
          Informações complementares
        </span>
        <span className="auth-line block h-[3px] w-[86%] rounded-[1px] bg-[#E4E9EC]" />
        <span className="auth-line block h-[3px] w-[64%] rounded-[1px] bg-[#E4E9EC]" />
      </div>

      <div className="auth-write flex flex-col gap-[5px] pt-2" style={{ animationDelay: '2140ms' }}>
        {INVOICE_TAXES.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between">
            <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-[#A4AEB4]">
              {label}
            </span>
            <span className="font-mono text-[7.5px] text-[#8B979E]">{value}</span>
          </div>
        ))}
      </div>

      <div
        className="auth-write flex items-center justify-between border-t border-[#C9D1D6] pb-5 pt-2.5"
        style={{ animationDelay: '2280ms' }}
      >
        <span className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#8B979E]">
          Valor total da nota
        </span>
        <span className="font-mono text-[10px] text-[#14181B]">48.720,35</span>
      </div>
    </div>
  );
}

/**
 * Folha digitalizada, e o único documento do laço que chega torto.
 *
 * Ele endireita **uma vez**, quando a varredura termina de passar — é o que o
 * OCR faz antes de ler, e é a única parte da história que um documento nascido
 * digital não conta. O movimento é de menos de um grau e não se repete: a regra
 * que veta piscar veta o vaivém, não o gesto único que assenta.
 *
 * O texto vem com opacidade irregular de propósito. Digitalização não entrega
 * cinza uniforme, e uma folha limpa demais aqui contaria a parte fácil.
 */
/**
 * Ata em três parágrafos, como o papel entrega: bloco de abertura, deliberação e
 * fecho. Linha corrida do alto ao pé leria como tarja, não como texto lido.
 *
 * As opacidades são irregulares de propósito — digitalização não devolve cinza
 * uniforme, e uma folha limpa demais aqui contaria a parte fácil.
 */
const SCAN_PARAGRAPHS: Array<Array<[number, number]>> = [
  [
    [96, 0.9],
    [88, 0.62],
    [94, 0.86],
    [91, 0.55],
    [71, 0.78],
  ],
  [
    [92, 0.8],
    [96, 0.58],
    [86, 0.9],
    [93, 0.64],
    [89, 0.84],
    [95, 0.6],
    [64, 0.72],
  ],
  [
    [93, 0.84],
    [90, 0.6],
    [94, 0.88],
    [87, 0.66],
    [91, 0.8],
    [58, 0.7],
  ],
  [
    [95, 0.76],
    [89, 0.9],
    [92, 0.6],
    [94, 0.7],
    [88, 0.86],
    [76, 0.82],
  ],
  [
    [93, 0.62],
    [96, 0.88],
    [90, 0.72],
    [85, 0.9],
    [92, 0.58],
    [69, 0.8],
  ],
  [
    [91, 0.86],
    [95, 0.64],
    [88, 0.78],
    [93, 0.9],
    [54, 0.68],
  ],
];

function ScannedBody() {
  let step = 0;
  return (
    <div className="mt-5 flex flex-1 flex-col" aria-hidden>
      <div className="auth-deskew flex flex-1 flex-col gap-3.5">
        {SCAN_PARAGRAPHS.map((paragraph, p) => (
          <div key={p} className="flex flex-col gap-[7px]">
            {paragraph.map(([width, opacity], i) => {
              step += 1;
              return (
                <span
                  key={i}
                  className="auth-line block h-[4px] rounded-[1px] bg-[#C2CBD1]"
                  style={{
                    width: `${width}%`,
                    opacity,
                    animationDelay: `${660 + step * 44}ms`,
                  }}
                />
              );
            })}
          </div>
        ))}

        {/* A rubrica: é o que prova que a folha veio do papel, e a âncora do
            fio "Reconhecimento". */}
        <svg
          viewBox="0 0 120 34"
          className="auth-write mb-5 mt-auto w-[120px]"
          style={{ animationDelay: '2280ms' }}
          fill="none"
        >
          <path
            d="M4 26c8-14 14 6 20-6s10 12 17 2 12 6 19-8 12 10 20 2"
            stroke="#5A6B75"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.75"
          />
        </svg>
      </div>
    </div>
  );
}

/* ── Documentos de pessoa física ───────────────────────────────────────────
   O acervo de uma pessoa não é feito de contrato e nota fiscal. É feito do que
   ela precisa provar: quem é, onde mora, quanto ganha. Por isso os dois que
   entram aqui são de porte — a habilitação e a conta de luz —, e não versões
   menores dos documentos de empresa.

   Os dois chegam pela mesma porta: fotografados ou digitalizados, nunca
   nascidos digitais. É por isso que ambos usam `auth-deskew` e vivem dentro de
   um recorte com borda: o que a página mostra não é a carteira, é a folha em
   que a carteira foi copiada. Tentar desenhar a carteira em tamanho de carteira
   quebraria a proporção A4 que o laço inteiro depende de manter.

   A fidelidade é baixa de propósito, como no resto do painel: campos nomeados e
   tarjas, sem retrato, sem selo e sem brasão. O que precisa ser reconhecível é
   o *tipo* de documento, não o documento. --------------------------------- */

const LICENSE_FRONT: Array<[string, number]> = [
  ['Nome', 88],
  ['Doc. identidade · órgão emissor · UF', 70],
  ['CPF', 52],
  ['Data de nascimento', 44],
];

const LICENSE_BACK: Array<[string, number]> = [
  ['Filiação', 86],
  ['Local de nascimento', 64],
  ['Observações', 74],
];

/** A moldura de uma cópia: borda fina, papel um tom abaixo da folha. */
const LICENSE_CARD =
  'flex flex-1 flex-col gap-2.5 border border-[#DFE4E7] bg-[#F7F9FA] p-3.5';

function LicenseFields({ fields, from }: { fields: Array<[string, number]>; from: number }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
      {fields.map(([label, width], i) => (
        <div key={label} className="flex flex-col gap-[3px]">
          <span
            className="auth-write block font-mono text-[6px] uppercase tracking-[0.14em] text-[#A4AEB4]"
            style={{ animationDelay: `${from + i * 80}ms` }}
          >
            {label}
          </span>
          <span
            className="auth-line block h-[4px] rounded-[1px] bg-[#C2CBD1]"
            style={{ width: `${width}%`, animationDelay: `${from + 30 + i * 80}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

function LicenseBody() {
  return (
    <div className="mt-4 flex flex-1 flex-col" aria-hidden>
      <div className="auth-deskew flex flex-1 flex-col gap-2 pb-4">
        {/* Frente e verso na mesma folha. Não é licença de desenho: é o que
            qualquer pessoa faz ao digitalizar um documento de bolso, e é o que
            preenche uma A4 sem inventar conteúdo que a carteira não tem. */}
        <span className="font-mono text-[6px] uppercase tracking-[0.16em] text-[#B3BCC2]">
          Frente
        </span>
        <div className={LICENSE_CARD}>
          <div className="flex gap-3">
            {/* Lugar do retrato, e fica vazio: desenhar um rosto aqui faria a
                peça parecer um documento de verdade, e ela não é nem precisa
                ser. O painel só precisa que o tipo seja reconhecível. */}
            <div className="h-[72px] w-[54px] shrink-0 border border-[#DFE4E7] bg-[#EDF0F2]" />
            <LicenseFields fields={LICENSE_FRONT} from={700} />
          </div>

          {/* Os três campos que a extração devolve vêm escritos, não em tarja:
              é neles que os fios da direita se prendem. */}
          <div className="mt-auto flex items-start justify-between gap-3 border-t border-[#E4E9EC] pt-2.5">
            {[
              ['Categoria', 'AB'],
              ['Nº registro', '0421 8873 990'],
              ['1ª habilitação', '11 fev 2009'],
            ].map(([label, value], i) => (
              <div key={label} className="flex flex-col gap-[3px]">
                <span className="font-mono text-[6px] uppercase tracking-[0.14em] text-[#A4AEB4]">
                  {label}
                </span>
                <span
                  className="auth-write block font-mono text-[7.5px] text-[#5A6B75]"
                  style={{ animationDelay: `${1180 + i * 90}ms` }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <span className="mt-1 font-mono text-[6px] uppercase tracking-[0.16em] text-[#B3BCC2]">
          Verso
        </span>
        <div className={LICENSE_CARD}>
          <LicenseFields fields={LICENSE_BACK} from={1520} />

          <div className="mt-auto flex items-end justify-between gap-3 border-t border-[#E4E9EC] pt-2.5">
            <div className="flex flex-col gap-[3px]">
              <span className="font-mono text-[6px] uppercase tracking-[0.14em] text-[#A4AEB4]">
                Validade
              </span>
              <span
                className="auth-write block font-mono text-[9px] text-[#14181B]"
                style={{ animationDelay: '2280ms' }}
              >
                04 mar 2031
              </span>
            </div>

            {/* A assinatura do portador, que é o que fecha o verso. */}
            <svg
              viewBox="0 0 96 26"
              className="auth-write w-[96px]"
              style={{ animationDelay: '2360ms' }}
              fill="none"
            >
              <path
                d="M3 20c6-11 11 5 16-5s8 9 13 1 10 5 15-6 10 8 16 1"
                stroke="#5A6B75"
                strokeWidth="1.3"
                strokeLinecap="round"
                opacity="0.7"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Doze meses de consumo. O desenho de uma conta de luz é este gráfico, e é o
 *  que a distingue de qualquer outro comprovante à primeira vista. */
const CONSUMPTION: number[] = [52, 61, 47, 39, 44, 58, 71, 66, 49, 43, 55, 63];

/** O que a conta precisa demonstrar por lei, e o que preenche o pé da folha. */
const BILL_TARIFF: Array<[string, string]> = [
  ['Energia elétrica', '104,18'],
  ['Distribuição', '41,92'],
  ['Encargos setoriais', '12,60'],
  ['ICMS · PIS · COFINS', '28,74'],
];

const BILL_ROWS: Array<[string, string]> = [
  ['Consumo do mês', '214 kWh'],
  ['Bandeira tarifária', 'Verde'],
  ['Leitura anterior', '02 ago 2026'],
  ['Próxima leitura', '02 out 2026'],
];

function UtilityBillBody() {
  return (
    <div className="mt-5 flex flex-1 flex-col gap-4" aria-hidden>
      {/* Titular e endereço no alto: numa conta de luz é o bloco que faz dela um
          comprovante de endereço, e é exatamente o que a extração vai buscar. */}
      <div
        className="auth-write flex flex-col gap-1 border-y border-[#EDF0F2] py-2"
        style={{ animationDelay: '620ms' }}
      >
        <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-[#A4AEB4]">
          Titular · unidade consumidora
        </span>
        <span className="font-mono text-[8px] leading-relaxed text-[#5A6B75]">
          Helena Prado Vasconcelos
        </span>
        <span className="font-mono text-[7.5px] leading-relaxed text-[#8B979E]">
          R. das Laranjeiras, 418 · ap. 72 · Santa Cecília · São Paulo · SP
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span
          className="auth-write font-mono text-[6.5px] uppercase tracking-[0.14em] text-[#A4AEB4]"
          style={{ animationDelay: '820ms' }}
        >
          Consumo em kWh · 12 meses
        </span>
        <div className="flex h-[68px] items-end gap-[5px] border-b border-[#EDF0F2] pb-1">
          {CONSUMPTION.map((height, i) => (
            <span
              key={i}
              className="auth-line block w-[7px]"
              style={{
                height: `${height}%`,
                // A última coluna é a do mês que está sendo cobrado: vem cheia
                // porque é o número que a conta está afirmando. As outras são o
                // histórico, e histórico é referência, não afirmação.
                backgroundColor: i === CONSUMPTION.length - 1 ? '#8B979E' : '#D6DDE1',
                animationDelay: `${880 + i * 34}ms`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        {BILL_ROWS.map(([label, value], r) => (
          <div key={label} className="flex items-center justify-between border-b border-[#F0F3F5] py-[6px]">
            <span
              className="auth-write font-mono text-[7.5px] text-[#8B979E]"
              style={{ animationDelay: `${1340 + r * 90}ms` }}
            >
              {label}
            </span>
            <span
              className="auth-write font-mono text-[7.5px] text-[#5A6B75]"
              style={{ animationDelay: `${1370 + r * 90}ms` }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-[5px] pt-1">
        <span
          className="auth-write font-mono text-[6.5px] uppercase tracking-[0.14em] text-[#A4AEB4]"
          style={{ animationDelay: '1700ms' }}
        >
          Composição da tarifa
        </span>
        {BILL_TARIFF.map(([label, value], i) => (
          <div key={label} className="flex items-center justify-between">
            <span
              className="auth-write font-mono text-[7px] text-[#A4AEB4]"
              style={{ animationDelay: `${1740 + i * 70}ms` }}
            >
              {label}
            </span>
            <span
              className="auth-write font-mono text-[7px] text-[#8B979E]"
              style={{ animationDelay: `${1760 + i * 70}ms` }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      <div
        className="auth-write flex items-center justify-between border-t border-[#C9D1D6] pt-2.5"
        style={{ animationDelay: '1980ms' }}
      >
        <span className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#8B979E]">
          Total a pagar · venc. 18 set
        </span>
        <span className="font-mono text-[10px] text-[#14181B]">187,44</span>
      </div>

      <div className="auth-write flex items-end gap-[2px] pb-5" style={{ animationDelay: '2060ms' }}>
        {BARCODE.map((weight, i) => (
          <span
            key={i}
            className="block h-6 bg-[#14181B]"
            style={{ width: `${weight}px`, opacity: i % 2 ? 0.15 : 0.82 }}
          />
        ))}
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
      { top: '7%', label: 'Classificação', value: 'Contratos', delay: 1280 },
      { top: '22%', label: 'Partes', value: 'Nortis Engenharia · Vetor Log', delay: 1500 },
      { top: '42%', label: 'Vigência', value: '24 meses · 12 ago 2028', delay: 1960 },
      { top: '80%', label: 'Assinatura', value: '12 ago 2026', delay: 2380 },
    ],
  },
  {
    id: 'habilitacao',
    eyebrow: 'Documento pessoal · digitalizado',
    title: 'Carteira de habilitação',
    stamp: 'Verificado',
    hash: 'sha 8c31·5d70',
    body: <LicenseBody />,
    annotations: [
      { top: '7%', label: 'Classificação', value: 'Documentos pessoais', delay: 1280 },
      { top: '20%', label: 'Titular', value: 'Helena P. Vasconcelos', delay: 1560 },
      { top: '46%', label: 'Registro', value: '0421 8873 990 · cat. AB', delay: 1960 },
      { top: '85%', label: 'Validade', value: '04 mar 2031', delay: 2380 },
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
      { top: '7%', label: 'Classificação', value: 'Projetos', delay: 1280 },
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
      { top: '7%', label: 'Classificação', value: 'Financeiro', delay: 1280 },
      { top: '24%', label: 'Competência', value: 'ago 2026', delay: 1500 },
      { top: '50%', label: 'Linhas', value: '148 itens', delay: 1960 },
      { top: '82%', label: 'Total', value: 'R$ 1.284.900,00', delay: 2380 },
    ],
  },
  {
    id: 'comprovante',
    eyebrow: 'Conta de energia · comprovante de endereço',
    title: 'Helena Prado Vasconcelos',
    stamp: 'Conferido',
    hash: 'sha b5e9·0c24',
    body: <UtilityBillBody />,
    annotations: [
      { top: '7%', label: 'Classificação', value: 'Comprovante de endereço', delay: 1280 },
      { top: '19%', label: 'Endereço', value: 'Santa Cecília · São Paulo, SP', delay: 1560 },
      { top: '39%', label: 'Referência', value: 'set 2026 · 214 kWh', delay: 1960 },
      { top: '82%', label: 'Vencimento', value: '18 set 2026 · R$ 187,44', delay: 2380 },
    ],
  },
  {
    id: 'nota',
    eyebrow: 'Nota fiscal eletrônica · série 001',
    title: 'Vetor Log Transportes',
    stamp: 'Autorizada',
    hash: 'sha 2e58·c30d',
    body: <InvoiceBody />,
    annotations: [
      { top: '7%', label: 'Classificação', value: 'Fiscal', delay: 1280 },
      { top: '20%', label: 'Chave', value: '3526 0842 … 8853 2610', delay: 1500 },
      { top: '48%', label: 'Emissão', value: '28 ago 2026 · nº 41.271', delay: 1960 },
      { top: '82%', label: 'Valor', value: 'R$ 48.720,35', delay: 2380 },
    ],
  },
  {
    id: 'digitalizado',
    eyebrow: 'Documento digitalizado · 300 dpi',
    title: 'Ata de reunião — Conselho',
    stamp: 'Reconhecido',
    hash: 'sha 6b04·17fa',
    body: <ScannedBody />,
    annotations: [
      { top: '7%', label: 'Classificação', value: 'Societário', delay: 1280 },
      { top: '30%', label: 'Leitura', value: 'OCR · 98,4% de confiança', delay: 1960 },
      { top: '78%', label: 'Reconhecimento', value: 'Rubrica · 19 ago 2026', delay: 2380 },
    ],
  },
];

export function AntechamberDocument() {
  const location = useLocation();
  // A leitura se repete a cada navegação — trocar de tela é ato deliberado, e
  // um pulso por gesto não é o movimento ocioso que a regra "nada pisca" veta.
  const first = useRef(true);
  const isFirst = first.current;
  first.current = false;

  const [index, setIndex] = useState(0);

  /**
   * A troca é o fim da animação, não um temporizador paralelo.
   *
   * Havia dois relógios aqui: `auth-doc-life` no compositor e um `setInterval`
   * de 8400ms no event loop. Como a animação termina em `opacity: 0` e segura
   * esse estado (`both`), qualquer atraso do timer — e `setInterval` atrasa por
   * natureza, mais ainda em aba de fundo ou sob tarefa longa — deixava a folha
   * apagada esperando o React remontar. Era o branco entre um documento e o
   * seguinte, e ele crescia a cada volta, porque o atraso se acumula.
   *
   * Ouvindo `animationend` os dois viram um só: a página só é trocada quando a
   * animação de fato acabou, e a remontagem reinicia a animação. Não há o que
   * dessincronizar.
   *
   * `animationend` borbulha, e dentro da folha há dezenas de animações mais
   * curtas (`auth-write`, `auth-line`, `auth-scan`). Por isso o filtro duplo:
   * só o alvo que disparou, e só a animação de vida do documento.
   *
   * Em `prefers-reduced-motion` o CSS anula `auth-doc`, então o evento nunca
   * chega e o laço não anda — que é o comportamento que a regra pede, agora
   * sem precisar de um desvio em JavaScript para consegui-lo.
   */
  const advance = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.animationName !== 'auth-doc-life') return;
    setIndex((current) => (current + 1) % DOCUMENTS.length);
  };

  const doc = DOCUMENTS[index];

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden px-8">
      {/* o par página + extrações é centrado como um conjunto só; centrar apenas
          a página deixaria a massa visual pendendo para a direita */}
      <div className="flex items-stretch">
        {/* A chave é o documento: trocá-la remonta a folha inteira, e é o que
            faz o texto se escrever e a varredura descer de novo a cada tipo. */}
        <div key={doc.id} className="auth-doc flex items-stretch" onAnimationEnd={advance}>
          <div className="relative w-[min(46vh,464px)]">
            {/* a página, em proporção A4 */}
            <div className="auth-page relative flex aspect-[1/1.414] flex-col overflow-hidden rounded-[3px] bg-[#FBFCFC] px-8 py-7">
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

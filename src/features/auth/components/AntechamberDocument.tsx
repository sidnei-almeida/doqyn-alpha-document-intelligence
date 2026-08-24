import { DoqynMark } from '@/components/brand/DoqynMark';

/**
 * O painel da antessala — um contrato sendo lido pelo DOQYN.
 *
 * Não é ilustração nem foto de banco de imagem: é o produto. A página tem
 * proporção A4, aparece na cor real dela (o kit proíbe escurecer documento), o
 * texto se escreve, uma varredura desce lendo, e cada extração assenta quando a
 * varredura passa pela linha de onde ela saiu.
 *
 * A leitura acontece **uma vez**, no carregamento. Em laço, isso viraria um
 * letreiro piscando atrás de quem está digitando a senha — que é justamente o
 * que a regra "nada pisca" existe para impedir.
 */

type Anno = { top: string; label: string; value: string; delay: number };

/** Cada extração assenta no instante em que a varredura cruza a linha dela. */
const ANNOTATIONS: Anno[] = [
  { top: '22%', label: 'Partes', value: 'Nortis Engenharia · Vetor Log', delay: 1500 },
  { top: '46%', label: 'Vigência', value: '24 meses · 12 ago 2028', delay: 1960 },
  { top: '78%', label: 'Assinatura', value: '12 ago 2026', delay: 2380 },
];

/** A página é montada em blocos com cláusula nomeada, não como um bloco único
 *  de tarja cinza: é a cláusula que dá sentido ao fio da extração que sai dali.
 *  Larguras irregulares de propósito — bloco retangular perfeito lê como
 *  placeholder, não como texto. */
type Block = { clause?: string; lines: number[] };

const BLOCKS: Block[] = [
  { lines: [92, 88, 96, 64] },
  { clause: 'Cláusula 1ª — Do objeto', lines: [94, 90, 71] },
  { clause: 'Cláusula 4ª — Da vigência', lines: [88, 96, 62] },
  { clause: 'Cláusula 9ª — Do foro', lines: [90, 54] },
];

export function AntechamberDocument() {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden px-8">
      {/* o par página + extrações é centrado como um conjunto só; centrar apenas
          a página deixaria a massa visual pendendo para a direita */}
      <div className="flex items-stretch">
        <div className="relative w-[min(38vh,376px)]">
          {/* a página, em proporção A4 */}
          <div className="auth-page relative flex aspect-[1/1.414] flex-col rounded-[3px] bg-[#FBFCFC] px-8 py-7 shadow-[0_2px_8px_rgba(0,0,0,.45),0_28px_70px_-12px_rgba(0,0,0,.6)]">
            <span className="absolute inset-y-0 left-[22px] w-px bg-[#EBEFF1]" aria-hidden />

            <p className="auth-write font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#8B979E] [animation-delay:420ms]">
              Contrato de prestação de serviços
            </p>
            <p className="auth-write mt-1.5 font-serif text-[17px] font-medium leading-tight text-[#14181B] [animation-delay:540ms]">
              Nortis Engenharia
            </p>

            <div className="mt-5 flex flex-col gap-4" aria-hidden>
              {BLOCKS.map((block, b) => (
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
            </div>

            {/* Bloco de assinaturas: é a âncora real do fio "Assinatura", e é o
                que dá peso ao pé da página. Contrato termina assinado. */}
            <div className="mt-auto grid grid-cols-2 gap-5 pb-5" aria-hidden>
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

            <div className="auth-write flex items-center justify-between border-t border-[#EDF0F2] pt-4 [animation-delay:2600ms]">
              <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#8B979E]">
                sha 9f2c·41ab
              </span>
              {/* latão: contorno, nunca preenchimento */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7C6220] px-2.5 py-[3px] font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#7C6220]">
                <DoqynMark size={9} />
                Assinado
              </span>
            </div>

            {/* a varredura: desce uma vez, lendo */}
            <span
              className="auth-scan pointer-events-none absolute inset-x-0 top-0 h-[38%]"
              aria-hidden
            />
          </div>
        </div>

        {/* o que a IA leu, saindo da página */}
        {/* estica junto com a página: as porcentagens de topo precisam medir
            contra a altura real da A4, senão o fio aponta para a cláusula errada */}
        <div className="relative hidden w-[184px] shrink-0 xl:block">
          {ANNOTATIONS.map((anno) => (
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
  );
}

import { page, letterhead, boxes, gridTable, signatures } from '../lib/blocks.mjs';

/**
 * Financeiro — campos `fornecedor`, `numero_nota` e `data_emissao`.
 *
 * Documento fiscal é o pior caso de "campos parecidos": um DANFE tem quatro
 * datas em caixas vizinhas, dois CNPJs com o mesmo formato e três números que
 * parecem número de nota. Nada disso se resolve por proximidade no texto, que
 * é justamente o atalho que o modelo tende a tomar quando o layout é denso.
 */

export const FINANCEIRO_CASES = [
  {
    id: 'financeiro_01_danfe_denso',
    file: 'financeiro_01_danfe_nfe.pdf',
    className: 'Financeiro',
    difficulty: 'muito alta',
    traps: [
      'Dois CNPJs em caixas vizinhas: emitente e destinatário. O fornecedor é o emitente.',
      'Quatro datas na mesma faixa: emissão, saída, vencimento da duplicata e competência.',
      'Três números concorrentes: número da NF-e (com série), chave de acesso de 44 dígitos e número do pedido de compra.',
      'O destinatário tem nome mais destacado que o emitente por estar em caixa maior.',
    ],
    expected: {
      fornecedor: { value: 'Metalúrgica Três Coroas Ltda.', normalized: 'Metalúrgica Três Coroas Ltda.' },
      numero_nota: {
        value: '000.114.882',
        normalized: '000114882',
        acceptable: ['114882', '000.114.882 · Série 3'],
        note: 'O número da NF-e, não a chave de acesso nem o pedido de compra.',
      },
      data_emissao: { value: '11/06/2026', normalized: '2026-06-11' },
    },
    mustNotContain: {
      fornecedor: ['Cooperativa Agroindustrial Serra Azul', 'Transportes Bandeirante'],
      numero_nota: ['43260611', 'PC-2026-8871'],
      data_emissao: ['2026-06-12', '2026-07-11', '2026-05-01'],
    },
    scanned: null,
    html: () =>
      page(
        'DANFE — Documento Auxiliar da Nota Fiscal Eletrônica',
        `<div style="display:flex;justify-content:space-between;align-items:flex-start;border:0.5pt solid #2a2d31;padding:2mm 3mm;margin-bottom:0">
        <div style="max-width:52%">
          <div style="font-family:'Liberation Sans',sans-serif;font-weight:700;font-size:11pt">METALÚRGICA TRÊS COROAS LTDA.</div>
          <div style="font-size:7.4pt;line-height:1.4;margin-top:1mm">
            Rodovia RS-115, km 28 · Distrito Industrial<br>
            Três Coroas/RS · CEP 95660-000<br>
            CNPJ 74.209.881/0001-35 · IE 096/0448821<br>
            Fone (51) 3546-8800
          </div>
        </div>
        <div style="text-align:center;border:0.5pt solid #2a2d31;padding:1.5mm 4mm">
          <div style="font-family:'Liberation Sans',sans-serif;font-weight:700;font-size:13pt">DANFE</div>
          <div style="font-size:6.4pt;line-height:1.35;margin:1mm 0">Documento Auxiliar da<br>Nota Fiscal Eletrônica</div>
          <div style="font-size:7pt">0 - ENTRADA &nbsp;&nbsp; <strong>1 - SAÍDA</strong></div>
          <div style="border:0.7pt solid #2a2d31;margin-top:1.5mm;padding:1mm 2mm;font-family:'Liberation Mono',monospace;font-size:9.5pt">
            Nº 000.114.882<br>SÉRIE 3
          </div>
        </div>
        <div style="text-align:right;max-width:32%">
          <div class="box__label">Chave de acesso</div>
          <div class="mono" style="font-size:7pt;word-break:break-all;line-height:1.5">
            4326 0611 7420 9881 0001 3555 0030 0011 4882 1099 4471 8830
          </div>
          <div style="font-size:6.4pt;margin-top:1.5mm;color:#3c4045">Consulta de autenticidade no portal
          nacional da NF-e ou no site da SEFAZ autorizadora</div>
        </div>
      </div>

      ${boxes([
        [
          { label: 'Natureza da operação', value: 'Venda de mercadoria adquirida de terceiros', flex: 3 },
          { label: 'Protocolo de autorização de uso', value: '343260009114882 - 11/06/2026 16:42:07', mono: true, flex: 2 },
        ],
        [
          { label: 'Inscrição estadual', value: '096/0448821', mono: true },
          { label: 'Inscr. estadual do subst. trib.', value: '—' },
          { label: 'CNPJ do emitente', value: '74.209.881/0001-35', mono: true },
        ],
      ])}

      <div style="font-family:'Liberation Sans',sans-serif;font-size:6.8pt;text-transform:uppercase;letter-spacing:0.08em;margin:2.5mm 0 0.8mm">Destinatário / Remetente</div>
      ${boxes([
        [
          { label: 'Nome / razão social', value: '<span style="font-size:11pt;font-weight:700">COOPERATIVA AGROINDUSTRIAL SERRA AZUL</span>', flex: 4 },
          { label: 'CNPJ / CPF', value: '31.774.006/0001-88', mono: true, flex: 2 },
          { label: 'Data da emissão', value: '11/06/2026', flex: 1.4 },
        ],
        [
          { label: 'Endereço', value: 'Estrada da Colônia, 4.120', flex: 3 },
          { label: 'Bairro', value: 'Linha Nova', flex: 1.4 },
          { label: 'CEP', value: '95185-000', mono: true, flex: 1.2 },
          { label: 'Data da saída/entrada', value: '12/06/2026', flex: 1.4 },
        ],
        [
          { label: 'Município', value: 'Carlos Barbosa', flex: 2 },
          { label: 'UF', value: 'RS', flex: 0.5 },
          { label: 'Inscrição estadual', value: '029/1188403', mono: true, flex: 1.6 },
          { label: 'Hora da saída', value: '07:15', flex: 1 },
        ],
      ])}

      <div style="font-family:'Liberation Sans',sans-serif;font-size:6.8pt;text-transform:uppercase;letter-spacing:0.08em;margin:2.5mm 0 0.8mm">Fatura / Duplicatas</div>
      ${boxes([
        [
          { label: 'Duplicata 001', value: 'Venc. 11/07/2026 · R$ 28.418,60', flex: 1 },
          { label: 'Duplicata 002', value: 'Venc. 10/08/2026 · R$ 28.418,60', flex: 1 },
          { label: 'Duplicata 003', value: 'Venc. 09/09/2026 · R$ 28.418,62', flex: 1 },
        ],
      ])}

      <div style="font-family:'Liberation Sans',sans-serif;font-size:6.8pt;text-transform:uppercase;letter-spacing:0.08em;margin:2.5mm 0 0.8mm">Dados dos produtos / serviços</div>
      ${gridTable(
        ['Código', 'Descrição do produto', 'NCM', 'CFOP', 'Un.', 'Qtd.', 'Vl. unitário', 'Vl. total', 'BC ICMS', 'Vl. ICMS', 'Alíq.'],
        [
          ['CH-4408', 'Chapa de aço carbono laminada a quente 3,00 mm x 1200 x 3000', '7208.51.00', '5102', 'KG', '4.820,000', '9,4200', '45.404,40', '45.404,40', '8.172,79', '18%'],
          ['PF-2210', 'Perfil U enrijecido 150 x 60 x 20 x 2,25 mm — 6 m', '7216.91.00', '5102', 'PC', '180,000', '148,7000', '26.766,00', '26.766,00', '4.817,88', '18%'],
          ['TB-9017', 'Tubo industrial redondo 2" x 2,00 mm — 6 m', '7306.30.00', '5102', 'PC', '96,000', '112,4000', '10.790,40', '10.790,40', '1.942,27', '18%'],
          ['SV-0001', 'Corte e dobra sob desenho — lote 8871', '—', '5933', 'SV', '1,000', '2.295,02', '2.295,02', '0,00', '0,00', '—'],
        ],
        { align: [null, null, null, null, null, 'num', 'num', 'num', 'num', 'num', 'num'] },
      )}

      <div style="font-family:'Liberation Sans',sans-serif;font-size:6.8pt;text-transform:uppercase;letter-spacing:0.08em;margin:2.5mm 0 0.8mm">Cálculo do imposto</div>
      ${boxes([
        [
          { label: 'Base de cálculo do ICMS', value: '82.960,80', mono: true },
          { label: 'Valor do ICMS', value: '14.932,94', mono: true },
          { label: 'Valor total dos produtos', value: '85.255,82', mono: true },
          { label: 'Valor do frete', value: '0,00', mono: true },
          { label: 'Valor total da nota', value: '<strong>85.255,82</strong>', mono: true },
        ],
      ])}

      <div style="font-family:'Liberation Sans',sans-serif;font-size:6.8pt;text-transform:uppercase;letter-spacing:0.08em;margin:2.5mm 0 0.8mm">Transportador / Volumes</div>
      ${boxes([
        [
          { label: 'Razão social', value: 'Transportes Bandeirante Ltda.', flex: 2.4 },
          { label: 'Frete por conta', value: '1 - Destinatário', flex: 1.2 },
          { label: 'CNPJ', value: '48.117.220/0001-05', mono: true, flex: 1.6 },
        ],
      ])}

      ${boxes([
        [
          {
            label: 'Dados adicionais',
            value:
              'Pedido de compra do cliente: PC-2026-8871. Competência de apuração: 05/2026. ' +
              'Mercadoria entregue conforme romaneio RM-4471. Documento emitido por ME/EPP optante pelo Simples Nacional: NÃO.',
            flex: 1,
          },
        ],
      ])}`,
      ),
  },

  {
    id: 'financeiro_02_boleto_com_carimbo',
    file: 'financeiro_02_boleto_bancario.pdf',
    className: 'Financeiro',
    difficulty: 'muito alta',
    traps: [
      'O beneficiário é o fornecedor; o pagador é quem recebeu o documento e aparece em caixa maior.',
      'Três números: "nosso número", "número do documento" e a linha digitável de 47 dígitos.',
      'Datas concorrentes: documento, processamento e vencimento — a de emissão é a do documento.',
      'Carimbo "PAGO" rotacionado por cima da faixa de valores.',
      'O banco emissor tem razão social própria e aparece no topo, disputando o papel de fornecedor.',
    ],
    expected: {
      fornecedor: {
        value: 'Gráfica Selva Editora e Impressos Ltda.',
        normalized: 'Gráfica Selva Editora e Impressos Ltda.',
        note: 'Beneficiário do boleto — quem prestou o serviço e recebe.',
      },
      numero_nota: {
        value: '2026/04471',
        normalized: '2026/04471',
        acceptable: ['202604471'],
        note: 'Campo "Número do documento", não o "Nosso número" nem a linha digitável.',
      },
      data_emissao: { value: '03/09/2026', normalized: '2026-09-03' },
    },
    mustNotContain: {
      fornecedor: ['Banco Cooperativo Vale Verde', 'Instituto Farroupilha de Ensino'],
      numero_nota: ['34191', '10998447188'],
      data_emissao: ['2026-09-04', '2026-09-25'],
    },
    scanned: 'scanner_rapido',
    html: () =>
      page(
        'Boleto de Cobrança',
        `<div style="position:relative">
        <div class="stamp stamp--paid" style="top:63mm;left:126mm">Pago</div>

        <div style="display:flex;align-items:flex-end;border-bottom:1.6pt solid #16181a;padding-bottom:1.2mm">
          <div style="font-family:'Liberation Sans',sans-serif;font-weight:700;font-size:12pt;padding-right:4mm;border-right:1.6pt solid #16181a">
            VALE VERDE
          </div>
          <div class="mono" style="font-size:11pt;font-weight:700;padding:0 4mm;border-right:1.6pt solid #16181a">756-0</div>
          <div class="mono" style="font-size:10.5pt;padding-left:4mm;letter-spacing:0.02em">
            75691.23405 60112.100447 71888.300001 3 10990000452870
          </div>
        </div>
        <div style="font-size:6.6pt;color:#4a4f55;margin-top:0.8mm;margin-bottom:2.5mm">
          Banco Cooperativo Vale Verde S.A. — CNPJ 03.918.664/0001-72 — Agência emissora 0221
        </div>

        ${boxes([
          [
            { label: 'Local de pagamento', value: 'Pagável em qualquer banco até o vencimento', flex: 3.4 },
            { label: 'Vencimento', value: '<strong>25/09/2026</strong>', flex: 1.2 },
          ],
          [
            {
              label: 'Beneficiário',
              value: 'GRÁFICA SELVA EDITORA E IMPRESSOS LTDA. · CNPJ 26.410.773/0001-19 · Rua Voluntários da Pátria, 2.006 · Porto Alegre/RS',
              flex: 3.4,
            },
            { label: 'Agência / Código do beneficiário', value: '0221 / 100447-1', mono: true, flex: 1.2 },
          ],
          [
            { label: 'Data do documento', value: '03/09/2026', flex: 1 },
            { label: 'Número do documento', value: '<strong>2026/04471</strong>', mono: true, flex: 1.3 },
            { label: 'Espécie doc.', value: 'DM', flex: 0.7 },
            { label: 'Aceite', value: 'N', flex: 0.5 },
            { label: 'Data processamento', value: '04/09/2026', flex: 1 },
            { label: 'Nosso número', value: '10998447188-3', mono: true, flex: 1.4 },
          ],
          [
            { label: 'Uso do banco', value: '—', flex: 1 },
            { label: 'Carteira', value: '109', flex: 0.6 },
            { label: 'Espécie', value: 'R$', flex: 0.6 },
            { label: 'Quantidade', value: '—', flex: 0.8 },
            { label: 'Valor', value: '—', flex: 0.8 },
            { label: '(=) Valor do documento', value: '<strong>4.528,70</strong>', mono: true, flex: 1.4 },
          ],
          [
            {
              label: 'Instruções (texto de responsabilidade do beneficiário)',
              value:
                'Após o vencimento, cobrar multa de 2% e juros de 0,033% ao dia.<br>' +
                'Referente à nota fiscal de serviço nº 2026/04471, emitida em 03/09/2026.<br>' +
                'Não receber após 30 dias do vencimento. Protestar após 5 dias corridos.',
              flex: 3.4,
            },
            { label: '(=) Valor cobrado', value: '&nbsp;', flex: 1.2 },
          ],
          [
            {
              label: 'Pagador',
              value: 'INSTITUTO FARROUPILHA DE ENSINO SUPERIOR · CNPJ 08.221.470/0001-63<br>Av. Farroupilha, 8.001 · Canoas/RS · CEP 92425-900',
              flex: 4.6,
            },
          ],
        ])}

        <div style="border-top:0.8pt dashed #2a2d31;margin-top:6mm;padding-top:2mm;font-size:6.6pt;color:#4a4f55">
          Autenticação mecânica — Recibo do pagador. Corte na linha pontilhada.
        </div>

        <div style="margin-top:8mm">
          <div style="font-family:'Liberation Sans',sans-serif;font-size:6.8pt;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:1mm">Composição do valor</div>
          ${gridTable(
            ['Item', 'Descrição do serviço gráfico', 'Qtd.', 'Vl. unitário (R$)', 'Total (R$)'],
            [
              ['1', 'Impressão offset — catálogo institucional 32 págs., couché 150g', '2.000', '1,7420', '3.484,00'],
              ['2', 'Acabamento — lombada canoa e refile', '2.000', '0,3180', '636,00'],
              ['3', 'Prova digital de cor certificada', '4', '52,175', '208,70'],
              ['4', 'Frete entrega Canoas/RS', '1', '200,00', '200,00'],
            ],
            { align: [null, null, 'num', 'num', 'num'] },
          )}
        </div>
      </div>`,
      ),
  },

  {
    id: 'financeiro_03_recibo_manuscrito',
    file: 'financeiro_03_recibo_avulso.pdf',
    className: 'Financeiro',
    difficulty: 'alta',
    traps: [
      'Recibo avulso não tem número de nota fiscal: numero_nota deve ser null.',
      'O bloco tem uma numeração impressa de talão ("Nº 0447") que não é número de nota fiscal.',
      'Valor escrito por extenso e em algarismos, com centavos divergentes de propósito no extenso.',
      'Texto simulando escrita manual, em fonte cursiva, sobre linhas pautadas.',
      'Quem emite o recibo é pessoa física — o fornecedor é uma pessoa, não uma empresa.',
    ],
    expected: {
      fornecedor: { value: 'Aparecida Simões da Rocha', normalized: 'Aparecida Simões da Rocha' },
      data_emissao: { value: '02 de fevereiro de 2026', normalized: '2026-02-02' },
    },
    expectNull: ['numero_nota'],
    mustNotContain: {
      fornecedor: ['Condomínio Edifício Solar das Acácias'],
      numero_nota: ['0447'],
    },
    scanned: 'foto_celular',
    html: () =>
      page(
        'Recibo',
        `<div style="border:1.4pt solid #2a2d31;padding:6mm 7mm;position:relative">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:0.6pt solid #2a2d31;padding-bottom:2mm">
          <div style="font-family:'Liberation Sans',sans-serif;font-weight:700;font-size:19pt;letter-spacing:0.22em">RECIBO</div>
          <div style="text-align:right">
            <div class="mono" style="font-size:8pt;color:#4a4f55">Talão 12 — folha</div>
            <div class="mono" style="font-size:14pt;font-weight:700;color:#7a1f22">Nº 0447</div>
          </div>
        </div>

        <div style="margin-top:6mm;font-size:10pt">
          <div style="display:flex;align-items:baseline;gap:2mm;margin-bottom:5mm">
            <span>Valor R$</span>
            <span class="handwritten" style="border-bottom:0.6pt solid #6b7076;flex:1;padding-left:3mm">2.480,00</span>
          </div>

          <div style="line-height:2.6">
            Recebi(emos) de
            <span class="handwritten" style="border-bottom:0.6pt solid #6b7076;padding:0 3mm">Condomínio Edifício Solar das Acácias</span>
            a importância de
            <span class="handwritten" style="border-bottom:0.6pt solid #6b7076;padding:0 3mm">dois mil quatrocentos e oitenta reais</span>
            referente a
            <span class="handwritten" style="border-bottom:0.6pt solid #6b7076;padding:0 3mm">serviços de jardinagem e poda das áreas comuns, competência janeiro</span>
            <span class="handwritten" style="border-bottom:0.6pt solid #6b7076;padding:0 3mm">e reposição de mudas do jardim frontal, conforme orçamento verbal aprovado</span>
            <span style="display:inline-block;width:100%;border-bottom:0.6pt solid #6b7076;height:5mm"></span>
          </div>

          <p style="margin-top:6mm;font-size:9pt;text-align:left">E para clareza firmo(amos) o presente
          recibo, dando plena e geral quitação da quantia acima.</p>

          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:9mm">
            <div class="handwritten" style="font-size:11pt">Porto Alegre, 02 de fevereiro de 2026</div>
          </div>

          <div style="margin-top:14mm;text-align:center">
            <div class="handwritten" style="font-size:16pt;margin-bottom:1mm">Aparecida S. da Rocha</div>
            <div style="border-top:0.7pt solid #16181a;width:70%;margin:0 auto;padding-top:1.2mm">
              <div style="font-size:9pt;font-weight:700">APARECIDA SIMÕES DA ROCHA</div>
              <div style="font-size:7.8pt;color:#3c4045">CPF 447.902.115-30 — MEI 41.208.774/0001-92</div>
            </div>
          </div>
        </div>
      </div>`,
      ),
  },

  {
    id: 'financeiro_04_fatura_parcelada_competencia',
    file: 'financeiro_04_fatura_parcelada.pdf',
    className: 'Financeiro',
    difficulty: 'alta',
    traps: [
      'Seis parcelas, cada uma com sua própria data — nenhuma delas é a data de emissão.',
      'A competência é dada como "08/2026", sem dia: exige normalizar para 2026-08-01 com confiança menor, ou abster-se.',
      'A data de emissão aparece só uma vez, no canto superior direito, em formato por extenso abreviado.',
      'O número da fatura tem prefixo alfabético e um dígito verificador separado por hífen.',
    ],
    expected: {
      fornecedor: { value: 'Vetor Log Armazéns Gerais S.A.', normalized: 'Vetor Log Armazéns Gerais S.A.' },
      numero_nota: { value: 'FAT-2026-00318-7', normalized: 'FAT-2026-00318-7', acceptable: ['FAT20260031 87', 'FAT-2026-00318'] },
      data_emissao: { value: '31 ago 2026', normalized: '2026-08-31' },
    },
    mustNotContain: {
      fornecedor: ['Distribuidora Campo Bom'],
      data_emissao: ['2026-09-15', '2026-10-15', '2026-08-01'],
    },
    scanned: null,
    html: () =>
      page(
        'Fatura de Serviços de Armazenagem',
        `${letterhead({
          name: 'Vetor Log',
          legal:
            'Vetor Log Armazéns Gerais S.A. · CNPJ 55.902.114/0001-27<br>Rodovia BR-386, km 419 · Canoas/RS · IE 097/0221884',
          meta: 'Fatura nº FAT-2026-00318-7<br>Emitida em 31 ago 2026<br>Competência 08/2026',
        })}
      <h1 class="doc-title">Fatura de Serviços de Armazenagem e Movimentação</h1>

      ${boxes([
        [
          { label: 'Sacado / Tomador', value: 'DISTRIBUIDORA CAMPO BOM DE ALIMENTOS LTDA.', flex: 3 },
          { label: 'CNPJ', value: '19.774.208/0001-41', mono: true, flex: 1.4 },
        ],
        [
          { label: 'Endereço', value: 'Rua Osvaldo Cruz, 1.180 · Campo Bom/RS', flex: 3 },
          { label: 'Contrato', value: 'ARM-2024/0088', mono: true, flex: 1.4 },
        ],
      ])}

      <div style="font-family:'Liberation Sans',sans-serif;font-size:6.8pt;text-transform:uppercase;letter-spacing:0.08em;margin:4mm 0 1mm">Composição da fatura — competência 08/2026</div>
      ${gridTable(
        ['Rubrica', 'Base', 'Qtd.', 'Tarifa (R$)', 'Valor (R$)'],
        [
          ['Armazenagem estática — palete padrão PBR', 'palete/dia', '18.420', '0,9800', '18.051,60'],
          ['Movimentação de entrada', 'palete', '1.240', '4,3500', '5.394,00'],
          ['Movimentação de saída (picking fracionado)', 'caixa', '9.880', '0,7400', '7.311,20'],
          ['Câmara fria — sobretaxa de refrigeração', 'palete/dia', '3.100', '1,6200', '5.022,00'],
          ['Reprocessamento de avaria', 'ocorrência', '14', '86,0000', '1.204,00'],
          ['Taxa de administração de estoque', 'mês', '1', '2.900,0000', '2.900,00'],
        ],
        { align: [null, null, 'num', 'num', 'num'] },
      )}

      <table class="plain" style="margin-top:3mm;width:62mm;margin-left:auto;font-size:9pt">
        <tr><td>Subtotal</td><td class="num">39.882,80</td></tr>
        <tr><td>ISS retido na fonte (2%)</td><td class="num">-797,66</td></tr>
        <tr><td>Descontos comerciais</td><td class="num">-1.194,80</td></tr>
        <tr><td style="border-top:0.7pt solid #16181a;font-weight:700;padding-top:1.4mm">Total da fatura</td>
            <td class="num" style="border-top:0.7pt solid #16181a;font-weight:700;padding-top:1.4mm">37.890,34</td></tr>
      </table>

      <div style="font-family:'Liberation Sans',sans-serif;font-size:6.8pt;text-transform:uppercase;letter-spacing:0.08em;margin:5mm 0 1mm">Parcelamento acordado</div>
      ${gridTable(
        ['Parcela', 'Vencimento', 'Valor (R$)', 'Forma', 'Situação'],
        [
          ['1/6', '15/09/2026', '6.315,06', 'Boleto', 'Em aberto'],
          ['2/6', '15/10/2026', '6.315,06', 'Boleto', 'Em aberto'],
          ['3/6', '16/11/2026', '6.315,06', 'Boleto', 'Em aberto'],
          ['4/6', '15/12/2026', '6.315,06', 'Boleto', 'Em aberto'],
          ['5/6', '15/01/2027', '6.315,05', 'Boleto', 'Em aberto'],
          ['6/6', '15/02/2027', '6.315,05', 'Boleto', 'Em aberto'],
        ],
        { align: [null, null, 'num', null, null] },
      )}

      <p style="margin-top:4mm;font-size:8.6pt">A presente fatura consolida os serviços prestados no período de
      01/08/2026 a 31/08/2026 e substitui, para fins de conferência, os relatórios diários de movimentação.
      Divergências devem ser apontadas em até 5 (cinco) dias úteis do recebimento.</p>

      ${signatures([
        { name: 'Vetor Log Armazéns Gerais S.A.', role: 'Faturamento' },
        { name: 'Distribuidora Campo Bom de Alimentos Ltda.', role: 'Ciente — conferência de estoque' },
      ])}`,
      ),
  },
];

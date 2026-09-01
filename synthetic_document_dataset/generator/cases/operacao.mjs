import {
  page,
  letterhead,
  boxes,
  gridTable,
  signatures,
  digitalSignature,
} from '../lib/blocks.mjs';

/**
 * RH, Compras e Operacional — as três classes que compartilham o mesmo trio de
 * campos: `titulo`, `referencia` e `data_assinatura`.
 *
 * Como os campos são genéricos, o teste aqui é outro: a classificação. Um mapa
 * de cotação e um pedido de compra são visualmente irmãos; um laudo técnico e
 * uma ata de reunião têm a mesma anatomia. E há dois casos que existem para
 * medir a abstenção — um documento que pertence a duas classes ao mesmo tempo,
 * e um que não tem conteúdo suficiente para pertencer a alguma.
 */

export const OPERACAO_CASES = [
  {
    id: 'rh_01_rescisao_muitas_datas',
    file: 'rh_01_termo_rescisao_trabalho.pdf',
    className: 'Recursos Humanos',
    difficulty: 'muito alta',
    traps: [
      'Sete datas no mesmo documento: admissão, aviso prévio, último dia trabalhado, afastamento, projeção do aviso, homologação e assinatura.',
      'A data de admissão é a mais antiga e a mais destacada — candidata natural e errada.',
      'A "referência / parte principal" é o empregado, mas o empregador aparece no cabeçalho e no rodapé.',
      'Valores em tabela com verbas rescisórias e descontos, incluindo um valor negativo.',
    ],
    expected: {
      titulo: {
        value: 'Termo de Rescisão do Contrato de Trabalho',
        normalized: 'Termo de Rescisão do Contrato de Trabalho',
        acceptable: ['Termo de Rescisão do Contrato de Trabalho — TRCT'],
      },
      referencia: {
        value: 'Djalma Ferreira Quaresma',
        normalized: 'Djalma Ferreira Quaresma',
        acceptable: ['Cerâmica Portal do Vale Ltda.'],
        note: 'O empregado é o sujeito do termo; aceitar o empregador como referência é defensável, mas o empregado é a leitura preferida.',
      },
      data_assinatura: { value: '14/07/2026', normalized: '2026-07-14' },
    },
    mustNotContain: {
      data_assinatura: ['2019-03-11', '2026-06-15', '2026-06-30', '2026-07-15'],
    },
    scanned: null,
    html: () =>
      page(
        'Termo de Rescisão do Contrato de Trabalho',
        `${letterhead({
          name: 'Cerâmica Portal do Vale',
          legal:
            'Cerâmica Portal do Vale Ltda. · CNPJ 27.881.440/0001-63<br>Rodovia RS-122, km 8 · Farroupilha/RS · CNAE 2342-7/01',
          meta: 'TRCT · Código 01 — sem justa causa (empregador)<br>Homologação: sindicato dispensado (Lei 13.467/2017)<br>Via do empregado',
        })}
      <h1 class="doc-title">Termo de Rescisão do Contrato de Trabalho</h1>

      ${boxes([
        [
          { label: 'Empregador', value: 'CERÂMICA PORTAL DO VALE LTDA.', flex: 3 },
          { label: 'CNPJ', value: '27.881.440/0001-63', mono: true, flex: 1.5 },
          { label: 'CNAE', value: '2342-7/01', mono: true, flex: 1 },
        ],
        [
          { label: 'Empregado', value: '<strong>DJALMA FERREIRA QUARESMA</strong>', flex: 3 },
          { label: 'CPF', value: '308.774.115-42', mono: true, flex: 1.5 },
          { label: 'PIS/PASEP', value: '128.90441.77-0', mono: true, flex: 1 },
        ],
        [
          { label: 'Cargo (CBO)', value: 'Operador de forno túnel (8212-10)', flex: 2 },
          { label: 'Categoria', value: 'Empregado — CLT', flex: 1.2 },
          { label: 'CTPS', value: '0044718 / série 0031-RS', mono: true, flex: 1.4 },
        ],
      ])}

      <div style="font-family:'Liberation Sans',sans-serif;font-size:6.8pt;text-transform:uppercase;letter-spacing:0.08em;margin:4mm 0 1mm">Marcos temporais do contrato</div>
      ${boxes([
        [
          { label: 'Data de admissão', value: '<strong>11/03/2019</strong>', flex: 1 },
          { label: 'Aviso prévio (comunicado em)', value: '15/06/2026', flex: 1 },
          { label: 'Último dia trabalhado', value: '30/06/2026', flex: 1 },
        ],
        [
          { label: 'Afastamento (INSS, encerrado)', value: '02/02/2026 a 27/02/2026', flex: 1 },
          { label: 'Projeção do aviso indenizado', value: 'até 15/07/2026', flex: 1 },
          { label: 'Data de assinatura deste termo', value: '<strong>14/07/2026</strong>', flex: 1 },
        ],
      ])}

      <div style="font-family:'Liberation Sans',sans-serif;font-size:6.8pt;text-transform:uppercase;letter-spacing:0.08em;margin:4mm 0 1mm">Verbas rescisórias</div>
      ${gridTable(
        ['Cód.', 'Descrição da verba', 'Referência', 'Vencimentos (R$)', 'Descontos (R$)'],
        [
          ['01', 'Saldo de salário', '30 dias', '3.284,00', ''],
          ['02', 'Aviso prévio indenizado', '45 dias', '4.926,00', ''],
          ['03', '13º salário proporcional', '7/12 avos', '1.915,67', ''],
          ['04', 'Férias vencidas + 1/3', '1 período', '4.378,67', ''],
          ['05', 'Férias proporcionais + 1/3', '4/12 avos', '1.459,56', ''],
          ['06', 'Multa rescisória FGTS (40%)', 'sobre saldo', '9.114,22', ''],
          ['51', 'INSS sobre verbas rescisórias', 'tabela', '', '742,18'],
          ['52', 'IRRF sobre verbas rescisórias', 'tabela', '', '1.208,44'],
          ['53', 'Adiantamento salarial (folha 06/2026)', '—', '', '1.500,00'],
          ['54', 'Convênio farmácia — desconto acordado', '—', '', '286,90'],
        ],
        { align: [null, null, null, 'num', 'num'] },
      )}

      <table class="plain" style="margin-top:3mm;width:70mm;margin-left:auto;font-size:9pt">
        <tr><td>Total de vencimentos</td><td class="num">25.078,12</td></tr>
        <tr><td>Total de descontos</td><td class="num">3.737,52</td></tr>
        <tr><td style="border-top:0.7pt solid #16181a;font-weight:700;padding-top:1.4mm">Valor líquido a receber</td>
            <td class="num" style="border-top:0.7pt solid #16181a;font-weight:700;padding-top:1.4mm">21.340,60</td></tr>
      </table>

      <p style="margin-top:5mm;font-size:8.8pt">Declaro haver recebido a importância líquida discriminada
      acima, dando ao empregador plena e geral quitação pelas verbas expressamente consignadas neste termo,
      ressalvado o direito de pleitear judicialmente as parcelas não constantes deste instrumento.</p>

      <p style="font-size:8.8pt">Farroupilha, <strong>14 de julho de 2026</strong>.</p>

      ${signatures([
        { name: 'Djalma Ferreira Quaresma', role: 'Empregado' },
        { name: 'Cerâmica Portal do Vale Ltda.', role: 'Empregador' },
      ])}`,
      ),
  },

  {
    id: 'rh_02_atestado_curto',
    file: 'rh_02_atestado_medico.pdf',
    className: 'Recursos Humanos',
    difficulty: 'alta',
    traps: [
      'Documento curtíssimo: pouco texto para o classificador se apoiar.',
      'Escrita cursiva sobre receituário, com carimbo do profissional sobrepondo a assinatura.',
      'Duas datas: a da consulta e a do início do afastamento, com um dia de diferença.',
      'O paciente é o sujeito; o médico e a clínica disputam o papel de referência.',
    ],
    expected: {
      titulo: { value: 'Atestado médico', normalized: 'Atestado médico' },
      referencia: {
        value: 'Neusa Kliemann Vargas',
        normalized: 'Neusa Kliemann Vargas',
        acceptable: ['Clínica Integrada Bento Gonçalves'],
      },
      data_assinatura: { value: '09 de maio de 2026', normalized: '2026-05-09' },
    },
    mustNotContain: {
      data_assinatura: ['2026-05-10', '2026-05-13'],
    },
    scanned: 'foto_celular',
    html: () =>
      page(
        'Atestado Médico',
        `<div style="border:0.8pt solid #2a2d31;padding:8mm 9mm;min-height:150mm;position:relative">
        <div style="text-align:center;border-bottom:0.6pt solid #2a2d31;padding-bottom:3mm">
          <div style="font-family:'Liberation Sans',sans-serif;font-weight:700;font-size:13pt;letter-spacing:0.06em">
            CLÍNICA INTEGRADA BENTO GONÇALVES
          </div>
          <div style="font-size:7.6pt;color:#3c4045;margin-top:1mm">
            Rua Marechal Deodoro, 442 · Bento Gonçalves/RS · CNPJ 21.447.880/0001-70 · Fone (54) 3451-2200
          </div>
        </div>

        <div style="text-align:center;font-family:'Liberation Sans',sans-serif;font-weight:700;
                    font-size:12pt;letter-spacing:0.14em;margin:9mm 0 7mm">ATESTADO MÉDICO</div>

        <div class="handwritten" style="font-size:14pt;line-height:2.5">
          Atesto para os devidos fins que a Sra. Neusa Kliemann Vargas,<br>
          CPF 118.447.920-05, esteve sob meus cuidados nesta data e<br>
          necessita de afastamento de suas atividades laborais por<br>
          3 (três) dias, a contar de 10/05/2026, por motivo de doença.<br>
          CID-10: M54.5
        </div>

        <div style="margin-top:12mm;font-size:9.4pt">Bento Gonçalves, 09 de maio de 2026.</div>

        <div style="margin-top:20mm;text-align:center;position:relative">
          <div class="handwritten" style="font-size:17pt">Dr. R. Fiorenzano</div>
          <div style="border-top:0.7pt solid #16181a;width:64%;margin:1mm auto 0;padding-top:1.2mm">
            <div style="font-size:9pt;font-weight:700">Dr. Ronaldo Fiorenzano Bittencourt</div>
            <div style="font-size:8pt;color:#3c4045">Médico do Trabalho — CRM/RS 18.774 · RQE 9.115</div>
          </div>
          <div class="stamp stamp--copy" style="top:-6mm;left:58%;font-size:8.4pt;opacity:0.5">
            CRM/RS 18.774
          </div>
        </div>

        <div style="position:absolute;bottom:8mm;left:9mm;right:9mm;font-size:7pt;color:#6b7076;
                    border-top:0.4pt solid #b9bdc2;padding-top:1.5mm">
          Retorno agendado para 13/05/2026. Documento sujeito a conferência pelo serviço médico do empregador.
        </div>
      </div>`,
      ),
  },

  {
    id: 'compras_01_mapa_cotacao',
    file: 'compras_01_mapa_de_cotacao.pdf',
    className: 'Compras',
    difficulty: 'muito alta',
    traps: [
      'Três fornecedores cotados na mesma tabela; apenas um é o vencedor, indicado por uma nota de rodapé.',
      'O fornecedor vencedor não é o de menor preço unitário em todos os itens — é o de menor total.',
      'O documento é um mapa comparativo, não um pedido: classificar como Financeiro é erro.',
      'A data de assinatura é a da homologação, no fim; o topo traz a data de abertura das propostas.',
    ],
    expected: {
      titulo: { value: 'Mapa comparativo de cotação', normalized: 'Mapa comparativo de cotação' },
      referencia: {
        value: 'Ferragens Rio Branco Ltda.',
        normalized: 'Ferragens Rio Branco Ltda.',
        note: 'Fornecedor vencedor da cotação — a parte principal do documento.',
        acceptable: ['Hospital Regional São Camilo'],
      },
      data_assinatura: { value: '26/10/2026', normalized: '2026-10-26' },
    },
    mustNotContain: {
      referencia: ['Ondas Metalúrgica', 'Suprimenta Distribuidora'],
      data_assinatura: ['2026-10-19', '2026-11-03'],
    },
    scanned: null,
    html: () =>
      page(
        'Mapa Comparativo de Cotação',
        `${letterhead({
          name: 'Hospital São Camilo',
          legal:
            'Hospital Regional São Camilo · CNPJ 90.114.772/0001-08<br>Setor de Compras e Contratos · Santa Maria/RS',
          meta:
            'Processo de compra CP-2026/0774<br>Abertura das propostas: 19/10/2026<br>Entrega prevista: 03/11/2026',
        })}
      <h1 class="doc-title">Mapa Comparativo de Cotação</h1>
      <div class="doc-subtitle">Aquisição de material de fixação e ferragens para manutenção predial</div>

      <p style="font-size:8.8pt">Foram convidados 5 (cinco) fornecedores; 3 (três) apresentaram proposta
      válida dentro do prazo. As propostas foram abertas na presença da comissão em 19/10/2026 e conferidas
      quanto à regularidade fiscal e ao atendimento das especificações técnicas do Anexo I.</p>

      ${gridTable(
        [
          'Item',
          'Especificação',
          'Un.',
          'Qtd.',
          'Ondas Metalúrgica — unit. (R$)',
          'Ferragens Rio Branco — unit. (R$)',
          'Suprimenta Distribuidora — unit. (R$)',
        ],
        [
          ['1', 'Parafuso sextavado inox A2 M10 x 60', 'un', '1.200', '2,18', '2,34', '2,09'],
          ['2', 'Bucha de nylon 10 mm com aba', 'un', '1.200', '0,44', '0,39', '0,47'],
          ['3', 'Cantoneira galvanizada 40 x 40 x 3 mm — 3 m', 'pç', '80', '54,90', '48,70', '56,20'],
          ['4', 'Dobradiça reforçada 4" latonada', 'pç', '140', '19,80', '17,45', '18,90'],
          ['5', 'Fechadura tubular externa 40 mm', 'pç', '60', '88,40', '81,10', '84,70'],
          ['6', 'Trilho de gaveta telescópico 450 mm', 'par', '95', '46,20', '43,80', '49,10'],
        ],
        { align: [null, null, null, 'num', 'num', 'num', 'num'] },
      )}

      <table class="plain" style="margin-top:3mm;font-size:9pt;width:100%">
        <tr>
          <td style="width:40%"></td>
          <td class="num" style="border-top:0.7pt solid #16181a;padding-top:1.4mm">Ondas Metalúrgica<br><strong>R$ 20.148,00</strong></td>
          <td class="num" style="border-top:0.7pt solid #16181a;padding-top:1.4mm">Ferragens Rio Branco<br><strong>R$ 19.106,50</strong></td>
          <td class="num" style="border-top:0.7pt solid #16181a;padding-top:1.4mm">Suprimenta Distribuidora<br><strong>R$ 20.317,90</strong></td>
        </tr>
      </table>

      <div style="font-family:'Liberation Sans',sans-serif;font-size:6.8pt;text-transform:uppercase;letter-spacing:0.08em;margin:5mm 0 1mm">Condições comerciais apresentadas</div>
      ${gridTable(
        ['Fornecedor', 'CNPJ', 'Prazo de entrega', 'Pagamento', 'Validade da proposta', 'Regularidade fiscal'],
        [
          ['Ondas Metalúrgica Ltda.', '18.220.774/0001-30', '20 dias', '28 dias', '30 dias', 'Regular'],
          ['Ferragens Rio Branco Ltda.', '44.907.118/0001-52', '12 dias', '30 dias', '45 dias', 'Regular'],
          ['Suprimenta Distribuidora S.A.', '61.884.209/0001-71', '25 dias', '21 dias', '30 dias', 'CND vencida em 14/10/2026'],
        ],
      )}

      <p style="margin-top:4mm;font-size:8.8pt"><strong>Parecer da comissão:</strong> recomenda-se a
      contratação da proposta de menor valor global, apresentada por
      <strong>FERRAGENS RIO BRANCO LTDA.</strong>, que também ofereceu o menor prazo de entrega e mantém
      regularidade fiscal integral, ainda que não detenha o menor preço unitário nos itens 1 e 2. A proposta
      da Suprimenta Distribuidora S.A. foi desclassificada quanto à habilitação por certidão vencida.</p>

      <p style="font-size:8.8pt">Santa Maria, <strong>26/10/2026</strong>.</p>

      ${signatures([
        { name: 'Ivete Marcondes Frantz', role: 'Presidente da comissão de compras' },
        { name: 'Sérgio Kunz Peruzzo', role: 'Membro — engenharia de manutenção' },
        { name: 'Rosane Titton Bordignon', role: 'Autoridade homologadora' },
      ])}`,
      ),
  },

  {
    id: 'operacional_01_laudo_assinatura_divergente',
    file: 'operacional_01_laudo_tecnico.pdf',
    className: 'Operacional',
    difficulty: 'alta',
    traps: [
      'A assinatura digital ICP-Brasil no rodapé traz um carimbo de tempo dois dias posterior à data de emissão do laudo.',
      'Três datas de ensaio nas tabelas, anteriores às duas anteriores.',
      'O título do documento e o assunto do ensaio disputam o campo "título".',
      'Quatro pessoas nomeadas: responsável técnico, auxiliar, acompanhante do cliente e signatário digital.',
    ],
    expected: {
      titulo: {
        value: 'Laudo de ensaio de estanqueidade em linha de amônia',
        normalized: 'Laudo de ensaio de estanqueidade em linha de amônia',
        acceptable: ['Laudo técnico de ensaio de estanqueidade'],
      },
      referencia: {
        value: 'Frigorífico Cerro Azul S.A.',
        normalized: 'Frigorífico Cerro Azul S.A.',
        acceptable: ['Talha Sul Serviços Industriais Ltda.'],
      },
      data_assinatura: { value: '18/09/2026', normalized: '2026-09-18' },
    },
    mustNotContain: {
      data_assinatura: ['2026-09-20', '2026-09-14', '2026-09-15', '2026-09-16'],
    },
    scanned: null,
    html: () =>
      page(
        'Laudo Técnico de Ensaio',
        `${letterhead({
          name: 'Talha Sul',
          legal:
            'Talha Sul Serviços Industriais Ltda. · CNPJ 22.884.610/0001-70<br>Responsável técnico: Eng. Mec. Wagner Poletto Sanhudo · CREA/RS 118.447-D',
          meta: 'Laudo LT-2026/0912-03<br>Emitido em 18/09/2026<br>Cliente: Frigorífico Cerro Azul S.A.',
        })}
      <h1 class="doc-title">Laudo de Ensaio de Estanqueidade em Linha de Amônia</h1>
      <div class="doc-subtitle">NBR 16.069 · Sistema de refrigeração industrial — sala de máquinas 2</div>

      <h2 class="clause">1. Objeto do ensaio</h2>
      <p class="indent">Verificação da estanqueidade das linhas de líquido e de sucção do circuito de amônia
      (R-717) da sala de máquinas 2, compreendendo 148 metros lineares de tubulação, 22 conexões flangeadas,
      6 válvulas de bloqueio e 2 válvulas de segurança, na planta do cliente situada na BR-153, km 402, Bagé/RS.</p>

      <h2 class="clause">2. Metodologia</h2>
      <p class="indent">Pressurização com nitrogênio seco a 1,3 vez a pressão máxima de trabalho admissível,
      seguida de inspeção por solução espumante em todas as juntas e por detector eletrônico de haleto com
      sensibilidade de 5 ppm. Estabilização mínima de 4 horas com registro de pressão e temperatura ambiente.</p>

      <h2 class="clause">3. Resultados</h2>
      ${gridTable(
        ['Trecho', 'Data do ensaio', 'PMTA (bar)', 'Pressão de teste (bar)', 'Queda em 4 h (bar)', 'Resultado'],
        [
          ['Linha de líquido — A1 a A7', '14/09/2026', '18,0', '23,4', '0,02', 'Aprovado'],
          ['Linha de sucção — B1 a B9', '15/09/2026', '12,0', '15,6', '0,05', 'Aprovado'],
          ['Ramal do resfriador de placas', '15/09/2026', '18,0', '23,4', '0,31', 'Reprovado'],
          ['Ramal do resfriador — após reaperto', '16/09/2026', '18,0', '23,4', '0,03', 'Aprovado'],
        ],
        { align: [null, null, 'num', 'num', 'num', null] },
      )}

      <h2 class="clause">4. Não conformidade registrada</h2>
      <p class="indent">O ramal do resfriador de placas apresentou vazamento em flange de 2½" na primeira
      medição, com queda de pressão de 0,31 bar em 4 horas. Procedeu-se à substituição da junta de grafite
      expandido e ao reaperto com torquímetro calibrado a 95 N·m, com aprovação na remedição.</p>

      <h2 class="clause">5. Conclusão</h2>
      <p class="indent">O sistema encontra-se estanque e apto à operação nas condições de projeto. Recomenda-se
      nova verificação em 12 (doze) meses ou após qualquer intervenção que rompa a integridade do circuito.</p>

      ${signatures([
        { name: 'Eng. Wagner Poletto Sanhudo', role: 'Responsável técnico — CREA/RS 118.447-D' },
        { name: 'Téc. Marlon Guerreiro Ávila', role: 'Auxiliar de ensaio — CFT 41.208' },
        { name: 'Cleusa Andrighetto Piva', role: 'Acompanhamento — Frigorífico Cerro Azul S.A.' },
      ])}

      ${digitalSignature([
        'ASSINATURA DIGITAL ICP-BRASIL — PADRÃO PAdES',
        'Signatário: WAGNER POLETTO SANHUDO:30877411542',
        'Autoridade certificadora: AC Certisign RFB G5 — certificado A3 em token',
        'Carimbo de tempo: 2026-09-20T09:14:52-03:00 (ACT Observatório Nacional)',
        'Hash SHA-256 do documento: 7f3a 90c1 44b8 e2d7 1a06 ff59 3c88 4210 b7de 0951 6a3c 8814 22fe d075 9b41 3e6a',
      ])}`,
      ),
  },

  {
    id: 'ambiguo_01_contrato_que_e_nda',
    file: 'ambiguo_01_contrato_com_sigilo_dominante.pdf',
    className: 'Contratos',
    difficulty: 'muito alta',
    ambiguousClasses: ['Contratos', 'Jurídico'],
    traps: [
      'O título diz "Contrato de Prestação de Serviços", mas 6 das 8 cláusulas tratam de confidencialidade.',
      'O documento traz "Parte Reveladora" e "Parte Receptora" explicitamente, atraindo a classe Jurídico.',
      'Existe objeto contratual real, com preço e prazo — o que sustenta a classe Contratos.',
      'Qualquer das duas classes é defensável; o teste é se a confiança cai e o documento vai para revisão.',
    ],
    expected: {
      fornecedor: { value: 'Bracco Auditoria e Perícia Contábil Ltda.', normalized: 'Bracco Auditoria e Perícia Contábil Ltda.' },
      data_assinatura: { value: '07/04/2026', normalized: '2026-04-07' },
    },
    expectLowConfidence: true,
    scanned: null,
    html: () =>
      page(
        'Contrato de Prestação de Serviços com Cláusulas de Sigilo',
        `${letterhead({
          name: 'Bracco Auditoria',
          legal:
            'Bracco Auditoria e Perícia Contábil Ltda. · CNPJ 36.114.902/0001-48<br>CRC/RS 8.441/O-2 · Av. Praia de Belas, 1.212 · sala 1104 · Porto Alegre/RS',
          meta: 'Contrato 2026/AUD-0031<br>Proposta técnica PT-2026/019<br>Via da contratada',
        })}
      <h1 class="doc-title">Contrato de Prestação de Serviços de Auditoria Independente</h1>

      <p class="indent"><strong>CONTRATANTE:</strong> LATICÍNIOS VALE DO TAQUARI S.A., CNPJ 82.447.006/0001-13,
      com sede na Rua Júlio de Castilhos, 3.400, Lajeado/RS, também designada <strong>PARTE REVELADORA</strong>
      para os efeitos das cláusulas de sigilo deste instrumento.</p>

      <p class="indent"><strong>CONTRATADA:</strong> BRACCO AUDITORIA E PERÍCIA CONTÁBIL LTDA., CNPJ
      36.114.902/0001-48, com sede na Av. Praia de Belas, 1.212, sala 1104, Porto Alegre/RS, também designada
      <strong>PARTE RECEPTORA</strong> para os mesmos efeitos.</p>

      <h2 class="clause">Cláusula 1ª — Do objeto e do preço</h2>
      <p class="indent">Auditoria independente das demonstrações financeiras do exercício encerrado em
      31/12/2026, com emissão de parecer, pelo valor global de R$ 148.000,00 (cento e quarenta e oito mil
      reais), pagos em 8 (oito) parcelas mensais iguais, com entrega do relatório final até 31/03/2027.</p>

      <h2 class="clause">Cláusula 2ª — Do acesso a informações</h2>
      <p class="indent">A PARTE RECEPTORA terá acesso a livros contábeis e fiscais, contratos, atas, folha de
      pagamento nominal, política de preços, margens por linha de produto e projeções orçamentárias, todos
      classificados como Informação Confidencial.</p>

      <h2 class="clause">Cláusula 3ª — Do dever de sigilo</h2>
      <p class="indent">A PARTE RECEPTORA obriga-se a não divulgar, reproduzir ou utilizar as Informações
      Confidenciais para finalidade diversa da execução deste contrato, respondendo pelos atos de seus
      sócios, empregados e subcontratados.</p>

      <h2 class="clause">Cláusula 4ª — Do rol de pessoas autorizadas</h2>
      <p class="indent">O acesso será restrito à equipe nominada no Anexo II, cujas alterações dependem de
      comunicação prévia e por escrito à PARTE REVELADORA, com antecedência mínima de 5 (cinco) dias úteis.</p>

      <h2 class="clause">Cláusula 5ª — Da segurança da informação</h2>
      <p class="indent">Os arquivos serão mantidos em ambiente cifrado, com autenticação em dois fatores,
      registro de acesso e vedação de cópia para dispositivos removíveis. Incidentes de segurança serão
      comunicados em até 24 (vinte e quatro) horas da ciência.</p>

      <h2 class="clause">Cláusula 6ª — Da devolução e da retenção legal</h2>
      <p class="indent">Concluída a auditoria, o material será devolvido ou destruído em 30 (trinta) dias,
      ressalvada a retenção dos papéis de trabalho pelo prazo de 5 (cinco) anos, exigida pelas normas
      profissionais de auditoria, sob idêntico dever de sigilo.</p>

      <h2 class="clause">Cláusula 7ª — Da subsistência do sigilo</h2>
      <p class="indent">As obrigações de confidencialidade subsistem por 5 (cinco) anos após o término deste
      contrato, por qualquer causa, e não se extinguem com a rescisão antecipada.</p>

      <h2 class="clause">Cláusula 8ª — Do foro</h2>
      <p class="indent">Comarca de Lajeado/RS.</p>

      <p style="margin-top:5mm">Lajeado, <strong>07/04/2026</strong>.</p>

      ${signatures([
        { name: 'Laticínios Vale do Taquari S.A.', role: 'Contratante · Parte Reveladora' },
        { name: 'Bracco Auditoria e Perícia Contábil Ltda.', role: 'Contratada · Parte Receptora' },
      ])}`,
      ),
  },

  {
    id: 'ambiguo_02_folha_de_rosto_vazia',
    file: 'ambiguo_02_folha_de_rosto_anexo.pdf',
    className: null,
    difficulty: 'muito alta',
    traps: [
      'Folha de rosto de anexo: não há conteúdo suficiente para determinar classe alguma.',
      'A resposta certa é requiresReview, com confiança baixa e todos os campos em null.',
      'O texto tem um número de processo e uma data, que atraem preenchimento indevido.',
    ],
    expectReview: true,
    expectNull: ['titulo', 'referencia', 'data_assinatura'],
    scanned: 'fotocopia_terceira_geracao',
    html: () =>
      page(
        'Anexo I',
        `<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;
                  min-height:230mm;text-align:center">
        <div style="font-family:'Liberation Sans',sans-serif;font-weight:700;font-size:36pt;
                    letter-spacing:0.22em">ANEXO I</div>
        <div style="width:40mm;border-top:1.4pt solid #16181a;margin:8mm 0"></div>
        <div style="font-size:11pt;color:#3c4045">Documentação complementar</div>
        <div class="mono" style="font-size:9pt;color:#6b7076;margin-top:26mm">
          Proc. 2026/0774 — fls. 118
        </div>
        <div class="mono" style="font-size:8pt;color:#6b7076;margin-top:2mm">
          Juntada em 04/11/2026
        </div>
      </div>`,
      ),
  },

  {
    id: 'operacional_02_ata_muitos_nomes',
    file: 'operacional_02_ata_de_reuniao.pdf',
    className: 'Operacional',
    difficulty: 'alta',
    traps: [
      'Onze pessoas nomeadas entre presentes, ausentes justificados e convidados.',
      'Três datas: a da reunião, a da convocação e a do prazo de uma deliberação.',
      'O documento é assinado apenas pelo secretário e pelo presidente da mesa — dois dos onze nomes.',
      'Deliberações em tabela com responsáveis nominais e prazos, que competem com o campo de referência.',
    ],
    expected: {
      titulo: {
        value: 'Ata da 4ª Reunião Ordinária do Comitê de Operações',
        normalized: 'Ata da 4ª Reunião Ordinária do Comitê de Operações',
        acceptable: ['Ata de reunião do Comitê de Operações'],
      },
      referencia: {
        value: 'Cooperativa de Transportes Sul Fronteira',
        normalized: 'Cooperativa de Transportes Sul Fronteira',
        acceptable: ['Comitê de Operações'],
      },
      data_assinatura: {
        value: 'doze dias do mês de março de dois mil e vinte e seis',
        normalized: '2026-03-12',
      },
    },
    mustNotContain: {
      data_assinatura: ['2026-03-05', '2026-04-10'],
    },
    scanned: null,
    html: () =>
      page(
        'Ata de Reunião',
        `${letterhead({
          name: 'Sul Fronteira',
          legal:
            'Cooperativa de Transportes Sul Fronteira · CNPJ 71.884.220/0001-96<br>Av. Presidente Vargas, 2.208 · Uruguaiana/RS',
          meta: 'Comitê de Operações<br>Convocação expedida em 05/03/2026<br>Livro de atas 07 · fls. 42-43',
        })}
      <h1 class="doc-title">Ata da 4ª Reunião Ordinária do Comitê de Operações</h1>

      <p class="indent">Aos doze dias do mês de março de dois mil e vinte e seis, às 14h30, na sede da
      Cooperativa de Transportes Sul Fronteira, reuniu-se ordinariamente o Comitê de Operações, mediante
      convocação expedida em 05/03/2026.</p>

      <h2 class="clause">Presentes</h2>
      <p>Ubiratã Correa Pilla (presidente da mesa), Marlene Schardong Antunes (secretária),
      Aristides Vogt Machado, Cleonice Bervian Tomazoni, Fernando Kruger Bassani,
      Idalina Ruschel Portela, Jocemar Trentin Balbinot.</p>

      <h2 class="clause">Ausências justificadas</h2>
      <p>Roseli Chiapinotto Nardi (férias) e Valdomiro Feltrin Guerra (viagem a serviço).</p>

      <h2 class="clause">Convidados</h2>
      <p>Éverton Signor Dallabrida (consultoria de frota) e Sandra Mocelin Bertoldo (contabilidade).</p>

      <h2 class="clause">1. Ordem do dia</h2>
      <p class="indent">(a) Renovação parcial da frota de semirreboques; (b) revisão do plano de manutenção
      preventiva; (c) indicadores de disponibilidade do primeiro bimestre; (d) assuntos gerais.</p>

      <h2 class="clause">2. Deliberações</h2>
      ${gridTable(
        ['Nº', 'Deliberação', 'Responsável', 'Prazo', 'Situação'],
        [
          ['4.1', 'Abrir cotação para 6 semirreboques graneleiros', 'Aristides Vogt Machado', '10/04/2026', 'Aprovada por unanimidade'],
          ['4.2', 'Migrar a manutenção preventiva para intervalo por quilometragem', 'Fernando Kruger Bassani', '30/04/2026', 'Aprovada com 1 abstenção'],
          ['4.3', 'Contratar telemetria embarcada em caráter piloto — 10 veículos', 'Jocemar Trentin Balbinot', '15/05/2026', 'Adiada para a próxima reunião'],
          ['4.4', 'Padronizar o relatório mensal de disponibilidade', 'Marlene Schardong Antunes', '31/03/2026', 'Aprovada por unanimidade'],
        ],
      )}

      <h2 class="clause">3. Indicadores apresentados</h2>
      ${gridTable(
        ['Indicador', 'Janeiro', 'Fevereiro', 'Meta'],
        [
          ['Disponibilidade da frota', '88,4%', '91,2%', '93,0%'],
          ['Custo de manutenção por km', 'R$ 0,412', 'R$ 0,388', 'R$ 0,370'],
          ['Ocorrências de pane em rota', '17', '11', '≤ 8'],
        ],
        { align: [null, 'num', 'num', 'num'] },
      )}

      <p class="indent" style="margin-top:4mm">Nada mais havendo a tratar, foi encerrada a reunião às 16h50 e
      lavrada a presente ata, que vai assinada pela secretária e pelo presidente da mesa.</p>

      ${signatures([
        { name: 'Marlene Schardong Antunes', role: 'Secretária' },
        { name: 'Ubiratã Correa Pilla', role: 'Presidente da mesa' },
      ])}`,
      ),
  },
];

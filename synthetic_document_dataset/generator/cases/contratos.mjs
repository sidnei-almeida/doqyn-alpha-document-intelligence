import { page, letterhead, signatures, gridTable, digitalSignature } from '../lib/blocks.mjs';

/**
 * Contratos — campos `fornecedor` (obrigatório) e `data_assinatura`.
 *
 * O erro clássico aqui é pegar a primeira razão social do preâmbulo. Em
 * contrato brasileiro a primeira é quase sempre a CONTRATANTE, isto é, quem
 * paga — exatamente o oposto do que o campo pede. Os casos abaixo empurram o
 * fornecedor para longe: para a segunda posição, para uma tabela de cotação,
 * para a única linha de qualificação de um documento de duas páginas.
 */

export const CONTRATOS_CASES = [
  {
    id: 'contratos_01_ordem_invertida',
    file: 'contratos_01_prestacao_servicos.pdf',
    className: 'Contratos',
    difficulty: 'alta',
    traps: [
      'A primeira razão social do preâmbulo é a CONTRATANTE, não o fornecedor.',
      'Uma terceira empresa aparece como interveniente garantidora, com CNPJ e endereço completos.',
      'Três datas: emissão da proposta, assinatura e início da prestação — a de assinatura é a do meio.',
      'O cabeçalho é da contratante, o que reforça o nome errado como candidato.',
    ],
    expected: {
      fornecedor: { value: 'Talha Sul Serviços Industriais Ltda.', normalized: 'Talha Sul Serviços Industriais Ltda.' },
      data_assinatura: { value: '05 de maio de 2026', normalized: '2026-05-05' },
    },
    mustNotContain: {
      fornecedor: ['Frigorífico Cerro Azul', 'Banco Regional', 'Cerro Azul Participações'],
      data_assinatura: ['2026-04-14', '2026-06-01'],
    },
    scanned: null,
    html: () =>
      page(
        'Contrato de Prestação de Serviços',
        `${letterhead({
          name: 'Frigorífico Cerro Azul',
          legal:
            'Frigorífico Cerro Azul S.A. · CNPJ 61.207.443/0001-19<br>BR-153, km 402 · Distrito Industrial · Bagé/RS',
          meta:
            'Suprimentos · Processo SUP-2026/0912<br>Proposta recebida em 14/04/2026<br>Início da prestação: 01/06/2026',
        })}
      <h1 class="doc-title">Contrato de Prestação de Serviços de Manutenção Industrial</h1>

      <p class="indent">Pelo presente instrumento particular de prestação de serviços, de um lado
      <strong>FRIGORÍFICO CERRO AZUL S.A.</strong>, inscrita no CNPJ sob o nº 61.207.443/0001-19, com sede na
      BR-153, km 402, Distrito Industrial, Bagé/RS, neste ato representada por seu Gerente de Suprimentos,
      doravante denominada <strong>CONTRATANTE</strong>;</p>

      <p class="indent">e, de outro lado, <strong>TALHA SUL SERVIÇOS INDUSTRIAIS LTDA.</strong>, inscrita no
      CNPJ sob o nº 22.884.610/0001-70, com sede na Rua Duque de Caxias, 2.115, pavilhão B, Bairro Getúlio
      Vargas, Bagé/RS, CEP 96412-420, neste ato representada por seu sócio-administrador, doravante
      denominada <strong>CONTRATADA</strong>;</p>

      <p class="indent">e, ainda, na qualidade de <strong>INTERVENIENTE GARANTIDORA</strong>,
      <strong>CERRO AZUL PARTICIPAÇÕES LTDA.</strong>, CNPJ nº 09.774.115/0001-06, com sede na Avenida Sete
      de Setembro, 640, sala 12, Bagé/RS, que comparece para garantir as obrigações pecuniárias da
      CONTRATANTE;</p>

      <p class="indent">resolvem celebrar o presente contrato, que se regerá pelas cláusulas seguintes e pela
      legislação aplicável.</p>

      <h2 class="clause">Cláusula 1ª — Do objeto</h2>
      <p class="indent">A CONTRATADA prestará serviços de manutenção preventiva e corretiva em sistemas de
      refrigeração industrial por amônia, compressores parafuso, condensadores evaporativos e válvulas de
      segurança, nas dependências da CONTRATANTE, conforme escopo detalhado no Anexo I.</p>

      <h2 class="clause">Cláusula 2ª — Do regime de execução</h2>
      <p class="indent">Os serviços serão executados em regime de empreitada por preço unitário, com equipe
      residente de 4 (quatro) técnicos em turno administrativo e regime de sobreaviso 24 horas para
      atendimento emergencial, com tempo de resposta máximo de 2 (duas) horas.</p>

      <h2 class="clause">Cláusula 3ª — Do preço e das condições de pagamento</h2>
      ${gridTable(
        ['Item', 'Descrição', 'Unidade', 'Qtd. mensal estimada', 'Preço unitário (R$)', 'Total mensal (R$)'],
        [
          ['1', 'Hora técnica de manutenção preventiva', 'h', '640', '112,40', '71.936,00'],
          ['2', 'Hora técnica de atendimento emergencial', 'h', '60', '186,00', '11.160,00'],
          ['3', 'Disponibilidade de sobreaviso', 'mês', '1', '9.400,00', '9.400,00'],
          ['4', 'Ensaio de estanqueidade de linha de amônia', 'un', '2', '2.780,00', '5.560,00'],
        ],
        { align: [null, null, null, 'num', 'num', 'num'] },
      )}
      <p class="indent" style="margin-top:2.5mm">O valor mensal estimado é de R$ 98.056,00 (noventa e oito mil
      e cinquenta e seis reais), faturado até o 5º dia útil do mês subsequente, com pagamento em 30 (trinta)
      dias contados do aceite da nota fiscal.</p>

      <h2 class="clause">Cláusula 4ª — Do prazo</h2>
      <p class="indent">O contrato terá vigência de 24 (vinte e quatro) meses contados do início da prestação,
      previsto para 01/06/2026, prorrogável uma única vez por igual período mediante termo aditivo firmado
      com antecedência mínima de 60 (sessenta) dias do termo final.</p>

      <h2 class="clause">Cláusula 5ª — Das obrigações da CONTRATADA</h2>
      <p class="indent">Manter válidas as certidões de regularidade fiscal, trabalhista e do FGTS; fornecer
      equipamentos de proteção individual à sua equipe; responder por danos causados às instalações; e
      manter apólice de responsabilidade civil com cobertura mínima de R$ 1.000.000,00.</p>

      <h2 class="clause">Cláusula 6ª — Da rescisão</h2>
      <p class="indent">Qualquer das partes poderá rescindir o contrato mediante aviso escrito com 90 (noventa)
      dias de antecedência. A rescisão por inadimplemento contratual dispensa aviso prévio e sujeita a parte
      inadimplente a multa de 10% (dez por cento) sobre o valor remanescente.</p>

      <h2 class="clause">Cláusula 7ª — Do foro</h2>
      <p class="indent">Fica eleito o foro da Comarca de Bagé/RS.</p>

      <p style="margin-top:5mm">E por estarem justas e contratadas, as partes assinam o presente em 3 (três)
      vias de igual teor, em Bagé, <strong>05 de maio de 2026</strong>.</p>

      ${signatures([
        { name: 'Frigorífico Cerro Azul S.A.', role: 'Contratante' },
        { name: 'Talha Sul Serviços Industriais Ltda.', role: 'Contratada' },
        { name: 'Cerro Azul Participações Ltda.', role: 'Interveniente garantidora' },
      ])}`,
      ),
  },

  {
    id: 'contratos_02_aditivo_duas_datas',
    file: 'contratos_02_termo_aditivo.pdf',
    className: 'Contratos',
    difficulty: 'muito alta',
    traps: [
      'Duas datas de assinatura no mesmo documento: a do contrato original (citada) e a do aditivo (real).',
      'A data do contrato original aparece primeiro, em texto corrido, e é a mais destacada.',
      'Troca de fornecedor no meio do aditivo: a cessionária passa a ser a contratada, e é ela o fornecedor vigente.',
      'A cedente continua sendo citada em todas as cláusulas de histórico.',
    ],
    expected: {
      fornecedor: {
        value: 'Hidrotec Engenharia de Fluidos Ltda.',
        normalized: 'Hidrotec Engenharia de Fluidos Ltda.',
        note: 'O aditivo cede a posição contratual: a contratada vigente é a cessionária, não a signatária original.',
      },
      data_assinatura: { value: '28/08/2026', normalized: '2026-08-28' },
    },
    mustNotContain: {
      fornecedor: ['Bomba Norte', 'Companhia de Saneamento'],
      data_assinatura: ['2024-02-09', '2026-09-01'],
    },
    scanned: null,
    html: () =>
      page(
        'Segundo Termo Aditivo',
        `${letterhead({
          name: 'CSA Saneamento',
          legal:
            'Companhia de Saneamento do Alto Uruguai · CNPJ 92.115.774/0001-58<br>Rua Bento Gonçalves, 55 · Erechim/RS',
          meta: 'Contrato nº 2024/0117<br>Segundo Termo Aditivo<br>Publicado em 01/09/2026',
        })}
      <h1 class="doc-title">Segundo Termo Aditivo ao Contrato nº 2024/0117</h1>
      <div class="doc-subtitle">Cessão de posição contratual e reequilíbrio econômico-financeiro</div>

      <p class="indent">A <strong>COMPANHIA DE SANEAMENTO DO ALTO URUGUAI</strong>, CNPJ 92.115.774/0001-58,
      doravante <strong>CONTRATANTE</strong>, e as empresas adiante qualificadas, celebram o presente Segundo
      Termo Aditivo ao Contrato nº 2024/0117, <strong>originalmente firmado em 09 de fevereiro de 2024</strong>
      entre a CONTRATANTE e a empresa BOMBA NORTE EQUIPAMENTOS HIDRÁULICOS LTDA., CNPJ 40.771.208/0001-14,
      cujo objeto é o fornecimento e a manutenção de conjuntos motobomba para estações elevatórias.</p>

      <h2 class="clause">Cláusula 1ª — Da cessão de posição contratual</h2>
      <p class="indent">Com fundamento na cláusula 14ª do contrato original e mediante anuência expressa da
      CONTRATANTE, a <strong>BOMBA NORTE EQUIPAMENTOS HIDRÁULICOS LTDA.</strong>, na qualidade de
      <strong>CEDENTE</strong>, transfere integralmente sua posição contratual a
      <strong>HIDROTEC ENGENHARIA DE FLUIDOS LTDA.</strong>, CNPJ nº 18.556.902/0001-31, com sede na Avenida
      Maurício Cardoso, 1.870, Erechim/RS, na qualidade de <strong>CESSIONÁRIA</strong>, que passa a figurar
      como <strong>CONTRATADA</strong> para todos os efeitos, assumindo direitos e obrigações a partir da
      assinatura deste termo.</p>

      <h2 class="clause">Cláusula 2ª — Da responsabilidade pelo período anterior</h2>
      <p class="indent">A CEDENTE permanece responsável pelas obrigações vencidas e pelos vícios de fornecimento
      apurados em relação às entregas realizadas entre 09/02/2024 e a data deste termo, inclusive pelas
      garantias contratuais dos equipamentos já instalados.</p>

      <h2 class="clause">Cláusula 3ª — Do reequilíbrio</h2>
      ${gridTable(
        ['Item', 'Valor original (R$)', 'Índice aplicado', 'Valor reequilibrado (R$)'],
        [
          ['Conjunto motobomba 75 cv', '48.900,00', 'IPCA 12m — 4,62%', '51.159,18'],
          ['Conjunto motobomba 150 cv', '96.400,00', 'IPCA 12m — 4,62%', '100.853,68'],
          ['Hora de manutenção corretiva', '178,00', 'IPCA 12m — 4,62%', '186,22'],
        ],
        { align: [null, 'num', null, 'num'] },
      )}

      <h2 class="clause">Cláusula 4ª — Da ratificação</h2>
      <p class="indent">Permanecem inalteradas todas as demais cláusulas e condições do contrato original e do
      Primeiro Termo Aditivo, firmado em 17/03/2025, naquilo que não conflitarem com o presente instrumento.</p>

      <p style="margin-top:5mm">Erechim, <strong>28/08/2026</strong>.</p>

      ${signatures([
        { name: 'Cia. de Saneamento do Alto Uruguai', role: 'Contratante' },
        { name: 'Bomba Norte Equipamentos Hidráulicos Ltda.', role: 'Cedente' },
        { name: 'Hidrotec Engenharia de Fluidos Ltda.', role: 'Cessionária — Contratada' },
      ])}`,
      ),
  },

  {
    id: 'contratos_03_data_formato_americano',
    file: 'contratos_03_master_services_agreement.pdf',
    className: 'Contratos',
    difficulty: 'muito alta',
    traps: [
      'Documento bilíngue: a data aparece como "March 4, 2026" no corpo em inglês e como "04/03/2026" na versão em português.',
      'Uma terceira data, "03/04/2026", aparece no rodapé de controle de versão em formato americano mm/dd — mesma data, grafia trocada.',
      'O fornecedor é a subsidiária brasileira, não a matriz irlandesa que assina o cabeçalho.',
      'Razão social com sufixo estrangeiro e nome fantasia diferente no letterhead.',
    ],
    expected: {
      fornecedor: {
        value: 'Aurelian Cloud Serviços de Tecnologia do Brasil Ltda.',
        normalized: 'Aurelian Cloud Serviços de Tecnologia do Brasil Ltda.',
      },
      data_assinatura: { value: '04 de março de 2026', normalized: '2026-03-04' },
    },
    mustNotContain: {
      fornecedor: ['Aurelian Cloud Limited', 'Banco Cooperativo Vale Verde'],
      data_assinatura: ['2026-04-03'],
    },
    scanned: null,
    html: () =>
      page(
        'Master Services Agreement',
        `${letterhead({
          name: 'Aurelian Cloud',
          legal:
            'Aurelian Cloud Limited · Registered in Ireland No. 664213<br>Sir John Rogerson’s Quay, 70 · Dublin 2 · Ireland',
          meta:
            'Document control: MSA-BR-2026-0033<br>Rev. 2 — 03/04/2026 (mm/dd)<br>Bilingual execution copy',
        })}
      <h1 class="doc-title">Master Services Agreement · Contrato Marco de Prestação de Serviços</h1>

      <p style="font-size:9.2pt"><em>This Agreement is executed in English and Portuguese. In case of
      conflict, the Portuguese version prevails for all purposes of Brazilian law.</em></p>

      <h2 class="clause">Recitals · Preâmbulo</h2>
      <p class="indent"><strong>THIS MASTER SERVICES AGREEMENT</strong> is entered into on
      <strong>March 4, 2026</strong>, by and between <strong>BANCO COOPERATIVO VALE VERDE S.A.</strong>,
      a Brazilian financial institution enrolled with CNPJ under No. 03.918.664/0001-72, headquartered at
      Avenida Assis Brasil, 3.940, Porto Alegre, State of Rio Grande do Sul, Brazil (the
      <strong>"Customer"</strong>); and <strong>AURELIAN CLOUD SERVIÇOS DE TECNOLOGIA DO BRASIL LTDA.</strong>,
      a Brazilian limited liability company enrolled with CNPJ under No. 47.302.115/0001-64, headquartered at
      Rua Fidêncio Ramos, 302, tower A, 9th floor, São Paulo, State of São Paulo, Brazil, a wholly owned
      subsidiary of Aurelian Cloud Limited (the <strong>"Supplier"</strong>).</p>

      <p class="indent">Pelo presente <strong>CONTRATO MARCO DE PRESTAÇÃO DE SERVIÇOS</strong>, celebrado em
      <strong>04 de março de 2026</strong>, o <strong>BANCO COOPERATIVO VALE VERDE S.A.</strong>, na
      qualidade de <strong>CONTRATANTE</strong>, e a <strong>AURELIAN CLOUD SERVIÇOS DE TECNOLOGIA DO BRASIL
      LTDA.</strong>, na qualidade de <strong>CONTRATADA</strong> e única responsável pela prestação em
      território nacional, ajustam o quanto segue.</p>

      <h2 class="clause">1. Scope · Objeto</h2>
      <p class="indent">Provision of managed cloud infrastructure, including compute, object storage, managed
      database and 24x7 support, under the service levels of Schedule A. · Prestação de infraestrutura de
      nuvem gerenciada, incluindo processamento, armazenamento de objetos, banco de dados gerenciado e
      suporte 24x7, nos níveis de serviço do Anexo A.</p>

      <h2 class="clause">2. Term · Prazo</h2>
      <p class="indent">Initial term of thirty-six (36) months from the Effective Date, automatically renewed
      for successive twelve (12) month periods unless either party gives ninety (90) days’ written notice. ·
      Prazo inicial de 36 (trinta e seis) meses contados da Data de Vigência, renovado automaticamente por
      períodos sucessivos de 12 (doze) meses, salvo denúncia escrita com 90 (noventa) dias de antecedência.</p>

      <h2 class="clause">3. Charges · Preços</h2>
      ${gridTable(
        ['Service · Serviço', 'Unit · Unidade', 'Rate (USD)', 'Rate (BRL)'],
        [
          ['Compute — general purpose vCPU', 'vCPU/hour', '0.0412', '0,2183'],
          ['Object storage', 'GB/month', '0.0210', '0,1113'],
          ['Managed database — HA pair', 'instance/month', '1,840.00', '9.748,00'],
          ['Committed support retainer', 'month', '6,500.00', '34.450,00'],
        ],
        { align: [null, null, 'num', 'num'] },
      )}
      <p class="indent" style="margin-top:2.5mm">Conversão pela PTAX de venda do dia útil anterior ao
      faturamento. Faturamento em reais pela CONTRATADA, com retenção de tributos na fonte quando devida.</p>

      <h2 class="clause">4. Data localisation · Localização de dados</h2>
      <p class="indent">Customer data shall be stored exclusively in Brazilian regions. · Os dados da
      CONTRATANTE serão armazenados exclusivamente em regiões situadas em território brasileiro.</p>

      <h2 class="clause">5. Governing law · Lei aplicável</h2>
      <p class="indent">Brazilian law; venue of the Judicial District of São Paulo/SP. · Lei brasileira; foro
      da Comarca de São Paulo/SP.</p>

      ${signatures([
        { name: 'Banco Cooperativo Vale Verde S.A.', role: 'Customer · Contratante' },
        { name: 'Aurelian Cloud Serviços de Tecnologia do Brasil Ltda.', role: 'Supplier · Contratada' },
      ])}

      ${digitalSignature([
        'Aurelian Cloud — Document control',
        'MSA-BR-2026-0033 · Revision 2 · Generated 03/04/2026 14:22 UTC (date format: mm/dd/yyyy)',
        'Template owner: Legal Operations, Dublin. Approved by: Legal Brazil, São Paulo.',
      ])}`,
      ),
  },

  {
    id: 'contratos_04_locacao_duas_paginas',
    file: 'contratos_04_locacao_nao_residencial.pdf',
    className: 'Contratos',
    difficulty: 'alta',
    traps: [
      'Duas páginas: a razão social da locadora aparece uma única vez, na qualificação da primeira página.',
      'A partir da cláusula 2ª o documento usa apenas "LOCADORA" e "LOCATÁRIA".',
      'O fiador é pessoa física com nome completo e aparece três vezes — mais vezes que a própria locadora.',
      'Data de assinatura no fim da segunda página, precedida por uma data de vistoria do imóvel.',
    ],
    expected: {
      fornecedor: {
        value: 'Imobiliária Pórtico Administração de Bens Ltda.',
        normalized: 'Imobiliária Pórtico Administração de Bens Ltda.',
        note: 'Em locação, quem entrega a prestação é a locadora — é ela que ocupa o papel de fornecedora.',
      },
      data_assinatura: { value: '19 de janeiro de 2026', normalized: '2026-01-19' },
    },
    mustNotContain: {
      fornecedor: ['Eduardo Nachtigall', 'Panificadora Trigo de Ouro'],
      data_assinatura: ['2026-01-15'],
    },
    scanned: 'fax_monocromatico',
    html: () =>
      page(
        'Contrato de Locação Não Residencial',
        `${letterhead({
          name: 'Pórtico',
          legal:
            'Imobiliária Pórtico Administração de Bens Ltda. · CRECI/RS 12.884-J<br>CNPJ 30.114.827/0001-95 · Rua dos Andradas, 1.234 · sala 806 · Porto Alegre/RS',
          meta: 'Contrato 2026/LOC-0044<br>Vistoria realizada em 15/01/2026<br>Via da locadora',
        })}
      <h1 class="doc-title">Contrato de Locação de Imóvel Não Residencial</h1>

      <p class="indent"><strong>LOCADORA:</strong> IMOBILIÁRIA PÓRTICO ADMINISTRAÇÃO DE BENS LTDA., inscrita no
      CNPJ sob o nº 30.114.827/0001-95, com sede na Rua dos Andradas, 1.234, sala 806, Centro Histórico,
      Porto Alegre/RS, na qualidade de administradora e mandatária do proprietário, doravante
      <strong>LOCADORA</strong>.</p>

      <p class="indent"><strong>LOCATÁRIA:</strong> PANIFICADORA TRIGO DE OURO LTDA. - EPP, inscrita no CNPJ sob
      o nº 55.208.331/0001-40, com sede na Rua Voluntários da Pátria, 990, loja 2, Porto Alegre/RS, doravante
      <strong>LOCATÁRIA</strong>.</p>

      <p class="indent"><strong>FIADOR:</strong> EDUARDO NACHTIGALL BRANDÃO, brasileiro, casado, comerciante,
      CPF nº 704.115.822-09, RG 2.887.410 SSP/RS, residente na Rua Felipe Camarão, 611, apto. 302, Porto
      Alegre/RS, que assina o presente na condição de fiador e principal pagador.</p>

      <h2 class="clause">Cláusula 1ª — Do imóvel</h2>
      <p class="indent">Loja térrea com 148,60 m² de área privativa, situada na Avenida Osvaldo Aranha, 1.077,
      loja 1, bairro Bom Fim, Porto Alegre/RS, matrícula 88.402 do 2º Registro de Imóveis, destinada
      exclusivamente à atividade de panificação e confeitaria.</p>

      <h2 class="clause">Cláusula 2ª — Do prazo</h2>
      <p class="indent">A locação é ajustada pelo prazo determinado de 60 (sessenta) meses, iniciando-se em
      01/02/2026 e encerrando-se em 31/01/2031, independentemente de aviso ou notificação.</p>

      <h2 class="clause">Cláusula 3ª — Do aluguel e dos encargos</h2>
      ${gridTable(
        ['Rubrica', 'Valor mensal (R$)', 'Vencimento', 'Reajuste'],
        [
          ['Aluguel', '11.800,00', 'dia 05', 'IGP-M anual'],
          ['Condomínio (estimado)', '1.940,00', 'dia 05', 'conforme rateio'],
          ['IPTU (1/12 avos)', '812,55', 'dia 05', 'conforme lançamento'],
          ['Seguro incêndio', '96,30', 'dia 05', 'conforme apólice'],
        ],
        { align: [null, 'num', null, null] },
      )}
      <p class="indent" style="margin-top:2.5mm">O atraso no pagamento sujeitará a LOCATÁRIA a multa de 10%
      (dez por cento), juros de mora de 1% ao mês e correção pelo IGP-M, sem prejuízo dos honorários
      advocatícios de 20% em caso de cobrança judicial.</p>

      <h2 class="clause">Cláusula 4ª — Das benfeitorias</h2>
      <p class="indent">Benfeitorias necessárias serão indenizadas; as úteis e voluptuárias, ainda que
      autorizadas, não geram direito a indenização nem a retenção, incorporando-se ao imóvel.</p>

      <div class="page-break"></div>

      <h2 class="clause">Cláusula 5ª — Da fiança</h2>
      <p class="indent">EDUARDO NACHTIGALL BRANDÃO assume, solidariamente com a LOCATÁRIA, a responsabilidade
      por todas as obrigações deste contrato, inclusive após o termo final, enquanto perdurar a ocupação do
      imóvel, renunciando ao benefício de ordem previsto no art. 827 do Código Civil.</p>

      <h2 class="clause">Cláusula 6ª — Da vistoria</h2>
      <p class="indent">O laudo de vistoria realizado em 15/01/2026, assinado pelas partes, integra este
      contrato como Anexo I e servirá de parâmetro para a conferência na devolução das chaves.</p>

      <h2 class="clause">Cláusula 7ª — Da devolução</h2>
      <p class="indent">Findo o prazo, a LOCATÁRIA devolverá o imóvel no estado em que o recebeu, com pintura
      nova, instalações elétricas e hidráulicas em funcionamento e quitação de todos os encargos.</p>

      <h2 class="clause">Cláusula 8ª — Da rescisão antecipada</h2>
      <p class="indent">A rescisão antecipada pela LOCATÁRIA sujeita-a a multa correspondente a 3 (três)
      aluguéis vigentes, reduzida proporcionalmente ao tempo já cumprido do contrato.</p>

      <h2 class="clause">Cláusula 9ª — Do foro</h2>
      <p class="indent">Comarca de Porto Alegre/RS.</p>

      <p style="margin-top:5mm">Porto Alegre, <strong>19 de janeiro de 2026</strong>.</p>

      ${signatures([
        { name: 'Imobiliária Pórtico Administração de Bens Ltda.', role: 'Locadora' },
        { name: 'Panificadora Trigo de Ouro Ltda. - EPP', role: 'Locatária' },
        { name: 'Eduardo Nachtigall Brandão', role: 'Fiador e principal pagador' },
      ])}`,
      ),
  },
];

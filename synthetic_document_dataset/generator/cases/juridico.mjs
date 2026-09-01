import { page, letterhead, signatures, witnesses, digitalSignature } from '../lib/blocks.mjs';

/**
 * Jurídico — a classe cujos campos são `parte_reveladora`, `parte_receptora` e
 * `data_assinatura`.
 *
 * O que derruba a extração aqui não é o vocabulário jurídico: é que o
 * documento sempre traz mais nomes próprios do que partes (advogados,
 * testemunhas, prepostos, o cartório) e mais datas do que a da assinatura
 * (minuta, protocolo, vigência, prazo de guarda). Cada caso abaixo põe um
 * desses excessos no caminho.
 */

const ESCRITORIO = {
  name: 'Vasconcelos &amp; Requião',
  legal:
    'Sociedade de Advogados · OAB/RS 8.412<br>Av. Carlos Gomes, 1.492 · cj. 703 · Porto Alegre/RS',
  meta: 'Ref. interna VR-2026/0418<br>Minuta revisada em 04/03/2026<br>Impresso em 11/03/2026',
};

export const JURIDICO_CASES = [
  {
    id: 'juridico_01_nda_reciproco_extenso',
    file: 'juridico_01_nda_reciproco.pdf',
    className: 'Jurídico',
    difficulty: 'alta',
    traps: [
      'Data de assinatura escrita por extenso no fecho, e não em formato numérico.',
      'O cabeçalho traz duas datas anteriores (minuta revisada, impresso em) mais recentes na leitura visual que a data real de assinatura.',
      'NDA recíproco: as duas empresas são simultaneamente reveladora e receptora.',
      'Bloco de assinaturas com quatro nomes — dois prepostos, duas testemunhas — e um advogado no rodapé.',
      'Vigência dada como prazo relativo ("7 (sete) anos contados da assinatura"), exigindo aritmética de data.',
    ],
    expected: {
      parte_reveladora: {
        value: 'Meridiano Softworks Ltda.',
        normalized: 'Meridiano Softworks Ltda.',
        acceptable: ['Nortis Engenharia S.A.'],
        note: 'Acordo recíproco: qualquer uma das duas razões sociais é aceitável, desde que reveladora e receptora não repitam o mesmo nome.',
      },
      parte_receptora: {
        value: 'Nortis Engenharia S.A.',
        normalized: 'Nortis Engenharia S.A.',
        acceptable: ['Meridiano Softworks Ltda.'],
      },
      data_assinatura: {
        value: 'nove dias do mês de junho do ano de dois mil e vinte e seis',
        normalized: '2026-06-09',
      },
    },
    mustNotContain: {
      parte_reveladora: ['Vasconcelos', 'Requião', 'Helena Bastos', 'Ruy Portilho'],
      parte_receptora: ['Vasconcelos', 'Requião', 'Helena Bastos', 'Ruy Portilho'],
      data_assinatura: ['2026-03-04', '2026-03-11'],
    },
    scanned: null,
    html: () =>
      page(
        'Acordo de Confidencialidade Recíproco',
        `${letterhead(ESCRITORIO)}
      <h1 class="doc-title">Acordo de Confidencialidade Recíproco</h1>
      <div class="doc-subtitle">Instrumento particular · via do outorgante</div>

      <p class="indent">Pelo presente instrumento particular, de um lado <strong>MERIDIANO SOFTWORKS LTDA.</strong>,
      sociedade empresária limitada inscrita no CNPJ sob o nº 27.914.663/0001-08, com sede na Rua Sarmento
      Leite, 1.140, conjunto 502, bairro Farroupilha, Porto Alegre/RS, CEP 90050-170, neste ato representada
      na forma de seu contrato social; e, de outro lado, <strong>NORTIS ENGENHARIA S.A.</strong>, sociedade
      anônima de capital fechado inscrita no CNPJ sob o nº 09.338.271/0001-44, com sede na Avenida Júlio de
      Castilhos, 88, 12º andar, Caxias do Sul/RS, CEP 95010-000, neste ato representada por seu diretor
      estatutário; ambas doravante designadas, indistinta e reciprocamente, como Parte Reveladora e Parte
      Receptora, conforme o sentido em que a informação trafegue em cada troca;</p>

      <p class="indent">CONSIDERANDO que as partes pretendem avaliar a viabilidade técnica e comercial de uma
      integração entre a plataforma de gestão de ativos da primeira e os sistemas de telemetria de campo da
      segunda; e CONSIDERANDO que tal avaliação exigirá o intercâmbio de informações não públicas de parte a
      parte; resolvem celebrar o presente Acordo, que se regerá pelas cláusulas seguintes.</p>

      <h2 class="clause">Cláusula Primeira — Do objeto</h2>
      <p class="indent">O objeto deste Acordo é a proteção das Informações Confidenciais reveladas por qualquer
      das partes à outra, em qualquer suporte, oralmente ou por escrito, antes ou depois desta data, no
      contexto das tratativas descritas no preâmbulo.</p>

      <h2 class="clause">Cláusula Segunda — Da definição de informação confidencial</h2>
      <p class="indent">Consideram-se Informações Confidenciais, sem limitação: código-fonte, arquitetura de
      sistemas, esquemas elétricos, listas de clientes, tabelas de preços, margens praticadas, resultados de
      ensaios de campo, planos de expansão, bem como o próprio fato da existência das tratativas. Não se
      incluem as informações que a Parte Receptora comprove, por escrito e de forma inequívoca, já serem de
      seu conhecimento antes da revelação, ou terem se tornado públicas sem culpa sua.</p>

      <h2 class="clause">Cláusula Terceira — Das obrigações da Parte Receptora</h2>
      <p class="indent">A Parte Receptora obriga-se a manter as Informações Confidenciais em sigilo, empregando
      grau de cuidado não inferior ao que dispensa às suas próprias informações sensíveis, e a limitar o
      acesso a empregados e prestadores cuja atuação seja indispensável à finalidade do preâmbulo, mediante
      compromisso escrito de confidencialidade em termos não menos rigorosos que os deste instrumento.</p>

      <h2 class="clause">Cláusula Quarta — Da vigência</h2>
      <p class="indent">Este Acordo entra em vigor na data de sua assinatura e permanecerá eficaz pelo prazo de
      <strong>7 (sete) anos</strong> contados da assinatura, subsistindo as obrigações de sigilo por igual
      período adicional em relação a segredos de negócio, ainda que encerradas as tratativas antes do termo.</p>

      <h2 class="clause">Cláusula Quinta — Da guarda de documentos</h2>
      <p class="indent">Encerrada a avaliação, cada parte devolverá ou destruirá o material recebido no prazo de
      30 (trinta) dias corridos, ressalvada a retenção de uma via em arquivo legal, pelo prazo de 5 (cinco)
      anos, exclusivamente para comprovação do cumprimento deste Acordo.</p>

      <h2 class="clause">Cláusula Sexta — Do foro</h2>
      <p class="indent">Fica eleito o foro da Comarca de Porto Alegre/RS, com renúncia a qualquer outro, por mais
      privilegiado que seja.</p>

      <p style="margin-top:5mm">E por estarem assim justas e acordadas, as partes firmam o presente
      instrumento em 2 (duas) vias de igual teor e forma, na cidade de Porto Alegre, aos
      <strong>nove dias do mês de junho do ano de dois mil e vinte e seis</strong>.</p>

      ${signatures([
        { name: 'Meridiano Softworks Ltda.', role: 'p. Clarice Fontoura Rebelo', extra: 'Diretora de Tecnologia' },
        { name: 'Nortis Engenharia S.A.', role: 'p. Gustavo Kerber Marchi', extra: 'Diretor de Operações' },
      ])}

      ${witnesses([
        { name: 'Helena Bastos Corrêa', role: 'CPF 812.447.309-15' },
        { name: 'Ruy Portilho de Almeida', role: 'CPF 447.902.118-60' },
      ])}

      <p style="margin-top:8mm;font-size:8pt;color:#3c4045">Instrumento redigido por Vasconcelos &amp;
      Requião Sociedade de Advogados. Advogado responsável: Dr. Ruy Portilho de Almeida, OAB/RS 62.118.</p>`,
      ),
  },

  {
    id: 'juridico_02_nda_minuta_sem_assinatura',
    file: 'juridico_02_nda_minuta_nao_assinada.pdf',
    className: 'Jurídico',
    difficulty: 'alta',
    traps: [
      'Documento é minuta: o campo de data no fecho está em branco ("aos ____ dias").',
      'Existem quatro datas no documento — geração da minuta, prazo de resposta, vigência pretendida e validade da proposta — e nenhuma delas é data de assinatura.',
      'A resposta correta para data_assinatura é null; preencher com qualquer data visível é erro.',
    ],
    expected: {
      parte_reveladora: { value: 'Instituto Paraná de Pesquisa Aplicada', normalized: 'Instituto Paraná de Pesquisa Aplicada' },
      parte_receptora: { value: 'Duarte Vasques Consultoria Ltda.', normalized: 'Duarte Vasques Consultoria Ltda.' },
    },
    expectNull: ['data_assinatura'],
    mustNotContain: {
      data_assinatura: ['2026-02-18', '2026-03-05', '2026-03-20', '2027-02-18'],
    },
    scanned: null,
    html: () =>
      page(
        'Minuta — Termo de Confidencialidade Unilateral',
        `${letterhead({
          name: 'Instituto Paraná',
          legal:
            'Instituto Paraná de Pesquisa Aplicada · CNPJ 04.771.902/0001-31<br>Rua Comendador Araújo, 731 · Curitiba/PR',
          meta:
            'MINUTA — não assinada<br>Gerada em 18/02/2026<br>Resposta esperada até 05/03/2026<br>Proposta válida até 20/03/2026',
        })}
      <div class="watermark">MINUTA</div>
      <h1 class="doc-title">Termo de Confidencialidade Unilateral</h1>
      <div class="doc-subtitle">Versão para revisão jurídica da contraparte — não produz efeitos enquanto não firmada</div>

      <p class="indent">O <strong>INSTITUTO PARANÁ DE PESQUISA APLICADA</strong>, associação sem fins lucrativos
      inscrita no CNPJ sob o nº 04.771.902/0001-31, com sede na Rua Comendador Araújo, 731, Curitiba/PR, na
      qualidade de <strong>Parte Reveladora</strong>; e <strong>DUARTE VASQUES CONSULTORIA LTDA.</strong>,
      inscrita no CNPJ sob o nº 41.208.556/0001-77, com sede na Rua Padre Anchieta, 2.310, sala 91,
      Curitiba/PR, na qualidade de <strong>Parte Receptora</strong>, ajustam o seguinte:</p>

      <h2 class="clause">1. Objeto</h2>
      <p class="indent">A Parte Reveladora dará à Parte Receptora acesso a bases de dados anonimizadas de
      ensaios agronômicos, protocolos experimentais e resultados preliminares ainda não publicados, para o
      fim exclusivo de elaboração de parecer técnico independente.</p>

      <h2 class="clause">2. Prazo pretendido de vigência</h2>
      <p class="indent">Pretende-se vigência de 12 (doze) meses contados da data de assinatura, prorrogável por
      igual período mediante termo aditivo. A título de referência para o cronograma interno, a vigência
      pretendida encerrar-se-ia em 18/02/2027 caso a assinatura ocorresse na data de geração desta minuta —
      hipótese meramente ilustrativa, sem efeito vinculante.</p>

      <h2 class="clause">3. Devolução do material</h2>
      <p class="indent">Encerrado o parecer, a Parte Receptora devolverá as bases recebidas e apagará as cópias
      de trabalho, certificando o cumprimento por declaração escrita.</p>

      <h2 class="clause">4. Penalidade</h2>
      <p class="indent">A revelação não autorizada sujeitará a infratora a multa não compensatória de
      R$ 80.000,00 (oitenta mil reais), sem prejuízo das perdas e danos apuráveis.</p>

      <h2 class="clause">5. Foro</h2>
      <p class="indent">Comarca de Curitiba/PR.</p>

      <p style="margin-top:6mm">Curitiba, aos ______ dias do mês de ______________________ de ________.</p>

      ${signatures([
        { name: '________________________________', role: 'Instituto Paraná de Pesquisa Aplicada', extra: 'Parte Reveladora' },
        { name: '________________________________', role: 'Duarte Vasques Consultoria Ltda.', extra: 'Parte Receptora' },
      ])}

      <p style="margin-top:10mm;font-size:8pt;color:#3c4045">Campos de data e assinatura permanecem em branco
      até a aprovação da minuta pelos jurídicos de ambas as partes.</p>`,
      ),
  },

  {
    id: 'juridico_03_nda_terceirizado_encadeado',
    file: 'juridico_03_nda_com_interveniente.pdf',
    className: 'Jurídico',
    difficulty: 'muito alta',
    traps: [
      'Três empresas no preâmbulo: reveladora, receptora e uma interveniente anuente que não é parte do sigilo.',
      'A interveniente é citada primeiro no cabeçalho (é quem imprimiu o documento), invertendo a ordem de leitura natural.',
      'Data de assinatura em formato dd.mm.aaaa, separada por pontos, ao lado de um protocolo que também parece data.',
      'O nome da receptora aparece uma única vez por extenso; no resto do texto é sempre "CONTRATADA" ou "a Receptora".',
    ],
    expected: {
      parte_reveladora: { value: 'Companhia Riograndense de Malharia S.A.', normalized: 'Companhia Riograndense de Malharia S.A.' },
      parte_receptora: { value: 'Aldeia Tecnologia e Automação Ltda. - ME', normalized: 'Aldeia Tecnologia e Automação Ltda. - ME' },
      data_assinatura: { value: '22.07.2026', normalized: '2026-07-22' },
    },
    mustNotContain: {
      parte_reveladora: ['Grupo Vestal', 'Aldeia Tecnologia'],
      parte_receptora: ['Grupo Vestal', 'Companhia Riograndense'],
      data_assinatura: ['2026-11-30', '2026-07-19'],
    },
    scanned: 'scanner_rapido',
    html: () =>
      page(
        'Acordo de Confidencialidade com Interveniente Anuente',
        `${letterhead({
          name: 'Grupo Vestal',
          legal:
            'Vestal Participações S.A. · CNPJ 15.663.028/0001-52<br>Departamento Jurídico Compartilhado · Novo Hamburgo/RS',
          meta:
            'Protocolo jurídico 19.07.2026-4471<br>Guarda documental até 30/11/2026<br>Via do departamento jurídico',
        })}
      <h1 class="doc-title">Acordo de Confidencialidade</h1>
      <div class="doc-subtitle">Com interveniência e anuência de holding controladora</div>

      <p class="indent">Por este instrumento particular, as partes abaixo qualificadas:</p>

      <p class="indent">(i) <strong>COMPANHIA RIOGRANDENSE DE MALHARIA S.A.</strong>, CNPJ 88.402.117/0001-93,
      com sede na Rodovia RS-239, km 12, Distrito Industrial, Novo Hamburgo/RS, doravante
      <strong>PARTE REVELADORA</strong>;</p>

      <p class="indent">(ii) <strong>ALDEIA TECNOLOGIA E AUTOMAÇÃO LTDA. - ME</strong>, CNPJ 33.019.884/0001-26,
      com sede na Rua Bento Gonçalves, 405, sala 3, Sapiranga/RS, doravante <strong>PARTE RECEPTORA</strong>
      ou simplesmente <strong>CONTRATADA</strong>; e</p>

      <p class="indent">(iii) <strong>VESTAL PARTICIPAÇÕES S.A.</strong>, CNPJ 15.663.028/0001-52, na qualidade
      de <strong>INTERVENIENTE ANUENTE</strong>, controladora da Parte Reveladora, que comparece
      exclusivamente para tomar ciência dos termos e não assume, por este ato, obrigação de sigilo própria
      nem responsabilidade solidária;</p>

      <p class="indent">têm entre si justo e acordado o quanto segue.</p>

      <h2 class="clause">Cláusula 1ª — Do escopo</h2>
      <p class="indent">A Parte Reveladora franqueará à CONTRATADA o acesso ao chão de fábrica, aos parâmetros
      de programação dos teares eletrônicos e às fichas técnicas de artigos em desenvolvimento, para fins de
      elaboração de projeto de automação de coleta de dados de produção.</p>

      <h2 class="clause">Cláusula 2ª — Do dever de sigilo</h2>
      <p class="indent">A CONTRATADA não divulgará, reproduzirá, fotografará ou registrará por qualquer meio o
      que lhe for franqueado, salvo mediante autorização escrita e específica da Parte Reveladora. A
      obrigação alcança os empregados, sócios e subcontratados da CONTRATADA, por cujos atos ela responde
      integralmente.</p>

      <h2 class="clause">Cláusula 3ª — Da subcontratação</h2>
      <p class="indent">É vedada à CONTRATADA a subcontratação de terceiros sem prévia anuência escrita. Havendo
      anuência, o terceiro aderirá a este Acordo por termo próprio, permanecendo a CONTRATADA como única
      interlocutora perante a Parte Reveladora.</p>

      <h2 class="clause">Cláusula 4ª — Da vigência e da rescisão</h2>
      <p class="indent">Vigência de 24 (vinte e quatro) meses a contar da assinatura. A rescisão, a qualquer
      tempo e por qualquer das partes mediante aviso de 30 dias, não extingue o dever de sigilo, que
      subsiste pelo prazo remanescente.</p>

      <h2 class="clause">Cláusula 5ª — Do foro</h2>
      <p class="indent">Comarca de Novo Hamburgo/RS.</p>

      <p style="margin-top:5mm">Novo Hamburgo, <strong>22.07.2026</strong>.</p>

      ${signatures([
        { name: 'Cia. Riograndense de Malharia S.A.', role: 'Parte Reveladora' },
        { name: 'Aldeia Tecnologia e Automação Ltda. - ME', role: 'Parte Receptora' },
        { name: 'Vestal Participações S.A.', role: 'Interveniente Anuente' },
      ])}`,
      ),
  },

  {
    id: 'juridico_04_procuracao_dois_outorgados',
    file: 'juridico_04_procuracao_ad_negotia.pdf',
    className: 'Jurídico',
    difficulty: 'muito alta',
    traps: [
      'Não é NDA: é procuração. Os papéis são outorgante e outorgado, e o extrator precisa mapear para reveladora/receptora ou abster-se.',
      'Dois outorgados com poderes distintos, mais um substabelecido citado em cláusula.',
      'Data por extenso em cartório com formato notarial ("aos treze dias do mês de abril").',
      'O selo do cartório traz uma segunda data (reconhecimento de firma) posterior à lavratura.',
    ],
    expected: {
      parte_reveladora: {
        value: 'Otávio Pilar Bandeira Neto',
        normalized: 'Otávio Pilar Bandeira Neto',
        note: 'O outorgante é quem confere os poderes; mapear para parte_reveladora é a leitura defensável. Abster-se também é aceito.',
        nullAcceptable: true,
      },
      parte_receptora: {
        value: 'Solange Ferrari Duprat',
        normalized: 'Solange Ferrari Duprat',
        acceptable: ['Ivan Belmonte Prates'],
        nullAcceptable: true,
      },
      data_assinatura: {
        value: 'treze dias do mês de abril do ano de dois mil e vinte e seis',
        normalized: '2026-04-13',
      },
    },
    mustNotContain: {
      data_assinatura: ['2026-04-16'],
    },
    scanned: 'fotocopia_terceira_geracao',
    html: () =>
      page(
        'Procuração Ad Negotia',
        `${letterhead({
          name: '2º Tabelionato',
          legal:
            '2º Tabelionato de Notas de Pelotas · Tabelião: Amauri Lisboa Fetter<br>Rua General Osório, 810 · Pelotas/RS',
          meta: 'Livro 1.204 · Fls. 087/088<br>Selo digital RS-2CJ4-88T1-90KX',
        })}
      <h1 class="doc-title">Procuração Pública Ad Negotia</h1>

      <p class="indent">Saibam quantos este público instrumento de procuração virem que, aos
      <strong>treze dias do mês de abril do ano de dois mil e vinte e seis</strong>, nesta cidade de
      Pelotas, Estado do Rio Grande do Sul, perante mim, Tabelião, compareceu como
      <strong>OUTORGANTE</strong>:</p>

      <p class="indent"><strong>OTÁVIO PILAR BANDEIRA NETO</strong>, brasileiro, casado sob o regime da
      comunhão parcial de bens, engenheiro agrônomo, portador da cédula de identidade nº 3.088.412 SSP/RS e
      inscrito no CPF sob o nº 615.230.884-72, residente e domiciliado na Rua Marechal Deodoro, 1.522,
      apartamento 401, Centro, Pelotas/RS, reconhecido como o próprio pelos documentos apresentados.</p>

      <p class="indent">E por ele me foi dito que, por este instrumento, nomeia e constitui suas bastantes
      procuradoras e procurador, como <strong>OUTORGADOS</strong>:</p>

      <p class="indent">a) <strong>SOLANGE FERRARI DUPRAT</strong>, brasileira, divorciada, administradora,
      CPF nº 209.774.510-38, com poderes para representá-lo perante instituições financeiras, movimentar
      contas correntes e de investimento, emitir e endossar cheques, contratar e liquidar operações de
      crédito rural até o limite de R$ 400.000,00 (quatrocentos mil reais) por operação;</p>

      <p class="indent">b) <strong>IVAN BELMONTE PRATES</strong>, brasileiro, solteiro, técnico agrícola,
      CPF nº 883.415.220-04, com poderes restritos à representação perante órgãos de fiscalização
      sanitária e ambiental, recebimento de notificações e assinatura de termos de compromisso, vedada
      qualquer movimentação financeira.</p>

      <h2 class="clause">Do substabelecimento</h2>
      <p class="indent">Fica facultado à outorgada nomeada na alínea "a" substabelecer os poderes desta
      procuração, com ou sem reserva de iguais, exclusivamente em favor do advogado
      <strong>Dr. Fabrício Menegotto Sá</strong>, OAB/RS 41.207, para fins judiciais.</p>

      <h2 class="clause">Do prazo</h2>
      <p class="indent">Esta procuração vigorará por 2 (dois) anos contados desta data, extinguindo-se
      automaticamente ao seu termo, independentemente de revogação expressa.</p>

      <p class="indent">Assim o disse, do que dou fé, e me pediu lhe lavrasse este instrumento, que lhe li,
      achou conforme, aceitou e assina.</p>

      ${signatures([{ name: 'Otávio Pilar Bandeira Neto', role: 'Outorgante' }])}

      ${digitalSignature([
        'RECONHECIMENTO DE FIRMA POR AUTENTICIDADE',
        '2º Tabelionato de Notas de Pelotas/RS — Selo RS-2CJ4-88T1-90KX',
        'Reconheço por autenticidade a assinatura de OTÁVIO PILAR BANDEIRA NETO.',
        'Pelotas, 16 de abril de 2026. Em testemunho da verdade.',
        'Escrevente autorizada: Nadir Kroeff Sanhudo',
      ])}`,
      ),
  },
];

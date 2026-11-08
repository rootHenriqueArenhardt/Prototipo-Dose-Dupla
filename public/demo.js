'use strict';

/**
 * Dose Dupla - demonstração estática.
 *
 * Este arquivo substitui a API do servidor por uma base de exemplo em memória.
 * Nada é salvo no navegador: ao recarregar a página, a demonstração volta ao
 * estado inicial. O objetivo é apenas apresentar o funcionamento do protótipo.
 */
window.DoseDuplaDemo = (function () {
  const Catalogo = window.DoseDuplaCatalogo;
  const Pdf = window.DoseDuplaPdf;

  const VERSAO = 3;
  const PERFIS_VALIDOS = ['idoso', 'familiar', 'cuidador', 'medico'];
  const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;
  const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

  const ID_PACIENTE = 'u-demo-marlene';
  const ID_USUARIO = 'u-demo-camila';

  /* ------------------------------------------------------------------ */
  /* Utilidades de data                                                  */
  /* ------------------------------------------------------------------ */

  const pad = (n) => String(n).padStart(2, '0');
  const diaISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const horaTexto = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const somarDias = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const dataHora = (dia, horario) => {
    const [ano, mes, diaMes] = String(dia).split('-').map(Number);
    const [h, m] = String(horario).split(':').map(Number);
    return new Date(ano, mes - 1, diaMes, h, m, 0, 0);
  };
  const dataExiste = (texto) => {
    if (!DATA_VALIDA.test(texto)) return false;
    const d = new Date(`${texto}T12:00:00`);
    return !Number.isNaN(d.getTime());
  };

  const normalizar = (texto) =>
    String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';

  /* ------------------------------------------------------------------ */
  /* Base de conhecimento de interações medicamentosas                   */
  /* ------------------------------------------------------------------ */

  const REGRAS_INTERACAO = [
    {
      id: 'aine-pressao',
      grupoA: ['ibuprofeno', 'diclofenaco', 'naproxeno', 'nimesulida', 'cetoprofeno', 'aceclofenaco', 'piroxicam', 'advil', 'alivium', 'cataflam', 'voltaren'],
      grupoB: ['losartana', 'enalapril', 'captopril', 'lisinopril', 'ramipril', 'valsartana', 'telmisartana', 'olmesartana', 'hidroclorotiazida', 'furosemida'],
      gravidade: 'alta',
      titulo: 'Antinflamatório junto com remédio de pressão',
      risco: 'A pressão pode cair demais e os rins podem ser sobrecarregados.',
      orientacao: 'Não tome os dois juntos sem falar com o médico. Se precisar do antinflamatório, pergunte qual é o mais seguro.',
    },
    {
      id: 'aine-aas',
      grupoA: ['ibuprofeno', 'diclofenaco', 'naproxeno', 'nimesulida', 'cetoprofeno', 'aceclofenaco', 'piroxicam', 'advil', 'alivium', 'cataflam', 'voltaren'],
      grupoB: ['acido acetilsalicilico', 'aas', 'aspirina'],
      gravidade: 'alta',
      titulo: 'Antinflamatório junto com AAS',
      risco: 'Aumenta muito o risco de gastrite e sangramento no estômago. O antinflamatório também pode anular a proteção do AAS para o coração.',
      orientacao: 'Evite a combinação. Fale com o médico antes de tomar o antinflamatório.',
    },
    {
      id: 'aine-anticoagulante',
      grupoA: ['ibuprofeno', 'diclofenaco', 'naproxeno', 'nimesulida', 'cetoprofeno', 'aceclofenaco', 'piroxicam'],
      grupoB: ['varfarina', 'clopidogrel', 'rivaroxabana', 'apixabana', 'dabigatrana', 'enoxaparina'],
      gravidade: 'alta',
      titulo: 'Antinflamatório junto com anticoagulante',
      risco: 'Risco alto de sangramento, inclusive interno.',
      orientacao: 'Não use sem autorização expressa do médico que receitou o anticoagulante.',
    },
    {
      id: 'aas-anticoagulante',
      grupoA: ['acido acetilsalicilico', 'aas', 'aspirina'],
      grupoB: ['varfarina', 'rivaroxabana', 'apixabana', 'dabigatrana'],
      gravidade: 'alta',
      titulo: 'AAS junto com anticoagulante',
      risco: 'Risco elevado de sangramento.',
      orientacao: 'Somente use se o médico tiver orientado a associação por escrito.',
    },
    {
      id: 'claritro-estatina',
      grupoA: ['claritromicina', 'eritromicina', 'itraconazol', 'cetoconazol'],
      grupoB: ['sinvastatina', 'atorvastatina', 'lovastatina'],
      gravidade: 'alta',
      titulo: 'Antibiótico junto com estatina',
      risco: 'Pode causar dor muscular intensa e lesão nos músculos.',
      orientacao: 'Avise o médico: normalmente ele suspende a estatina durante o antibiótico.',
    },
    {
      id: 'serotoninergica',
      grupoA: ['fluoxetina', 'sertralina', 'paroxetina', 'escitalopram', 'citalopram', 'venlafaxina'],
      grupoB: ['tramadol', 'sumatriptana', 'amitriptilina'],
      gravidade: 'alta',
      titulo: 'Risco de síndrome serotoninérgica',
      risco: 'Pode causar agitação, tremores, febre e batimentos acelerados.',
      orientacao: 'Não associe sem avaliação médica.',
    },
    {
      id: 'omeprazol-clopidogrel',
      grupoA: ['omeprazol', 'esomeprazol'],
      grupoB: ['clopidogrel'],
      gravidade: 'moderada',
      titulo: 'Omeprazol pode reduzir o efeito do clopidogrel',
      risco: 'O clopidogrel pode proteger menos o coração.',
      orientacao: 'Pergunte ao médico se pode trocar o omeprazol por outro protetor de estômago.',
    },
    {
      id: 'levotiroxina-absorcao',
      grupoA: ['levotiroxina', 'puran t4'],
      grupoB: ['omeprazol', 'carbonato de calcio', 'sulfato ferroso', 'hidroxido de aluminio'],
      gravidade: 'moderada',
      titulo: 'Remédio da tireoide com menor absorção',
      risco: 'O efeito da levotiroxina pode diminuir.',
      orientacao: 'Tome a levotiroxina em jejum e espere pelo menos 2 horas para os outros remédios.',
    },
    {
      id: 'nitrato-sildenafila',
      grupoA: ['sildenafila', 'tadalafila', 'vardenafila'],
      grupoB: ['nitroglicerina', 'isossorbida', 'mononitrato', 'dinitrato'],
      gravidade: 'alta',
      titulo: 'Risco de queda grave de pressão',
      risco: 'A pressão pode cair a níveis perigosos.',
      orientacao: 'Nunca use juntos. Procure o médico.',
    },
    {
      id: 'digoxina-amiodarona',
      grupoA: ['digoxina'],
      grupoB: ['amiodarona', 'verapamil', 'diltiazem'],
      gravidade: 'alta',
      titulo: 'Risco de arritmia',
      risco: 'O nível de digoxina no sangue pode subir demais.',
      orientacao: 'Requer ajuste de dose e acompanhamento médico.',
    },
  ];

  const TURNO_POR_HORA = (hora) => {
    const h = Number(String(hora).slice(0, 2));
    if (h < 12) return 'manha';
    if (h < 18) return 'tarde';
    return 'noite';
  };

  const TURNOS = [
    { id: 'manha', nome: 'Manhã', icone: '🌅' },
    { id: 'tarde', nome: 'Tarde', icone: '☀️' },
    { id: 'noite', nome: 'Noite', icone: '🌙' },
  ];

  const ICONE_INSTRUCAO = {
    jejum: '💧',
    antes_refeicao: '⏳',
    com_comida: '🍽️',
    apos_refeicao: '🍽️',
    antes_dormir: '🌙',
  };

  const TEXTO_INSTRUCAO = {
    jejum: 'Em jejum',
    antes_refeicao: 'Antes da refeição',
    com_comida: 'Junto com a comida',
    apos_refeicao: 'Após a refeição',
    antes_dormir: 'Antes de dormir',
  };

  /* ------------------------------------------------------------------ */
  /* Dados de exemplo                                                    */
  /* ------------------------------------------------------------------ */

  /** Gerador determinístico para o histórico de exemplo. */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gerarRegistros(medicamentos, agora, hoje) {
    const rng = mulberry32(20261107);
    const registros = [];

    for (let i = 29; i >= 0; i -= 1) {
      const dia = diaISO(somarDias(hoje, -i));

      for (const med of medicamentos) {
        if (dia < med.inicio || dia > med.termino) continue;

        for (const horario of med.horarios) {
          const previsto = dataHora(dia, horario);
          if (previsto > agora) continue;

          const id = `r-${med.id}-${dia}-${horario.replace(':', '')}`;

          if (i === 0) {
            // Hoje: deixa a Losartana das 08:00 sem registro para simular atraso.
            if (med.id === 'm-demo-losa') continue;
            // Doses muito recentes continuam pendentes.
            if (previsto > new Date(agora.getTime() - 28 * 60000)) continue;
            const atraso = Math.min(8, Math.max(0, Math.floor((agora - previsto) / 60000)));
            registros.push({
              id,
              medicamentoId: med.id,
              data: dia,
              horario,
              status: 'tomado',
              minutosDeAtraso: atraso,
              registradoEm: new Date(previsto.getTime() + atraso * 60000).toISOString(),
              por: ID_USUARIO,
            });
            continue;
          }

          const sorte = rng();
          if (sorte > 0.88) continue; // dose perdida

          const atraso = sorte > 0.78 ? Math.floor(35 + rng() * 90) : Math.floor(rng() * 10);
          registros.push({
            id,
            medicamentoId: med.id,
            data: dia,
            horario,
            status: 'tomado',
            minutosDeAtraso: atraso,
            registradoEm: new Date(previsto.getTime() + atraso * 60000).toISOString(),
            por: ID_USUARIO,
          });
        }
      }
    }

    return registros;
  }

  function gerarAlertas(hoje) {
    const quando = dataHora(diaISO(somarDias(hoje, -12)), '10:20').toISOString();
    return [
      {
        id: 'a-demo-1',
        quando,
        tipo: 'interacao_confirmada',
        medicamento: 'Ibuprofeno (600 mg)',
        interacoes: [
          {
            regraId: 'aine-pressao',
            gravidade: 'alta',
            titulo: 'Antinflamatório junto com remédio de pressão',
            risco: 'A pressão pode cair demais e os rins podem ser sobrecarregados.',
            orientacao: 'Não tome os dois juntos sem falar com o médico.',
            medicamentoExistente: {
              id: 'm-demo-losa',
              nome: 'Losartana',
              dosagem: '50 mg',
              principioAtivo: 'Losartana',
            },
          },
        ],
        perfil: 'familiar',
        registradoPor: 'Camila Souza',
        observacao: 'Confirmado que a médica estava ciente.',
      },
    ];
  }

  function criarDemo() {
    const agora = new Date();
    const hoje = new Date(agora);
    hoje.setHours(0, 0, 0, 0);

    const inicio = diaISO(somarDias(hoje, -120));
    const termino = diaISO(somarDias(hoje, 180));

    const medicamentos = [
      {
        id: 'm-demo-levo',
        nome: 'Levotiroxina sódica',
        principioAtivo: 'Levotiroxina sódica',
        dosagem: '50 mcg',
        catalogoId: 'levotiroxina-sodica',
        classe: 'Hormônios e medicamentos para a tireoide',
        apresentacao: 'Comprimidos de 25, 50, 75, 100 mcg',
        horarios: ['07:00'],
        inicio,
        termino,
        instrucao: 'jejum',
        observacoes: 'Tomar em jejum, com água. Aguardar 30 minutos para o café da manhã.',
        receita: null,
        criadoEm: `${inicio}T08:00:00.000Z`,
        criadoPor: ID_USUARIO,
        ativo: true,
      },
      {
        id: 'm-demo-losa',
        nome: 'Losartana',
        principioAtivo: 'Losartana',
        dosagem: '50 mg',
        catalogoId: 'losartana',
        classe: 'Anti-hipertensivo',
        apresentacao: 'Comprimidos de 25, 50 e 100 mg',
        horarios: ['08:00'],
        inicio,
        termino,
        instrucao: 'apos_refeicao',
        observacoes: 'Tomar sempre no mesmo horário para controlar a pressão.',
        receita: null,
        criadoEm: `${inicio}T08:05:00.000Z`,
        criadoPor: ID_USUARIO,
        ativo: true,
      },
      {
        id: 'm-demo-metf',
        nome: 'Metformina',
        principioAtivo: 'Metformina',
        dosagem: '850 mg',
        catalogoId: 'metformina',
        classe: 'Antidiabético oral',
        apresentacao: 'Comprimidos de 500, 850 e 1000 mg',
        horarios: ['08:00', '20:00'],
        inicio,
        termino,
        instrucao: 'com_comida',
        observacoes: 'Tomar durante o café da manhã e o jantar para reduzir desconforto.',
        receita: null,
        criadoEm: `${inicio}T08:10:00.000Z`,
        criadoPor: ID_USUARIO,
        ativo: true,
      },
      {
        id: 'm-demo-aas',
        nome: 'Ácido acetilsalicílico',
        principioAtivo: 'Ácido acetilsalicílico',
        dosagem: '100 mg',
        catalogoId: 'acido-acetilsalicilico',
        classe: 'Antiagregante plaquetário',
        apresentacao: 'Comprimidos de 100 mg',
        horarios: ['12:00'],
        inicio,
        termino,
        instrucao: 'apos_refeicao',
        observacoes: 'Tomar após o almoço, conforme orientação da cardiologista.',
        receita: null,
        criadoEm: `${inicio}T08:15:00.000Z`,
        criadoPor: ID_USUARIO,
        ativo: true,
      },
      {
        id: 'm-demo-sinv',
        nome: 'Sinvastatina',
        principioAtivo: 'Sinvastatina',
        dosagem: '20 mg',
        catalogoId: 'sinvastatina',
        classe: 'Estatina / redutor de colesterol',
        apresentacao: 'Comprimidos de 10, 20, 40 e 80 mg',
        horarios: ['22:00'],
        inicio,
        termino,
        instrucao: 'antes_dormir',
        observacoes: 'Tomar antes de dormir.',
        receita: null,
        criadoEm: `${inicio}T08:20:00.000Z`,
        criadoPor: ID_USUARIO,
        ativo: true,
      },
    ];

    const paciente = {
      id: ID_PACIENTE,
      nome: 'Marlene da Silva',
      idade: 72,
      perfil: 'idoso',
      pacienteId: null,
      pacienteNome: 'Marlene da Silva',
      criadoEm: `${inicio}T08:00:00.000Z`,
      medicamentos,
      registros: gerarRegistros(medicamentos, agora, hoje),
      alertas: gerarAlertas(hoje),
    };

    const usuario = {
      id: ID_USUARIO,
      nome: 'Camila Souza',
      idade: null,
      perfil: 'familiar',
      pacienteId: ID_PACIENTE,
      pacienteNome: 'Marlene da Silva',
      criadoEm: `${inicio}T09:00:00.000Z`,
      medicamentos: [],
      registros: [],
      alertas: [],
    };

    return {
      versao: VERSAO,
      criadoEm: agora.toISOString(),
      sessao: ID_USUARIO,
      usuarios: [paciente, usuario],
    };
  }

  let base = criarDemo();

  /* ------------------------------------------------------------------ */
  /* Acesso aos dados                                                    */
  /* ------------------------------------------------------------------ */

  const usuarioPublico = (usuario) => ({
    id: usuario.id,
    nome: usuario.nome,
    idade: usuario.idade ?? null,
    perfil: usuario.perfil,
    pacienteId: usuario.pacienteId || null,
    pacienteNome: usuario.pacienteNome || usuario.nome,
    criadoEm: usuario.criadoEm,
    totalMedicamentos: (usuario.medicamentos || []).length,
  });

  const usuarioAtual = (b) => b.usuarios.find((u) => u.id === b.sessao) || null;

  function usuarioPaciente(b, usuario) {
    if (!usuario) return null;
    if (usuario.perfil === 'idoso') return usuario;
    const alvo = b.usuarios.find((u) => u.id === usuario.pacienteId && u.perfil === 'idoso');
    return alvo || usuario;
  }

  const termosDoMedicamento = (med) => [normalizar(med.principioAtivo), normalizar(med.nome)].filter(Boolean);
  const termoBate = (termo, lista) => lista.some((chave) => termo.includes(chave) || chave.includes(termo));

  function verificarInteracoes(novo, medicamentos) {
    const termosNovo = termosDoMedicamento(novo);
    const achados = [];
    const vistos = new Set();

    for (const med of medicamentos || []) {
      if (med.ativo === false) continue;
      if (med.id && novo.id && med.id === novo.id) continue;
      const termosExistentes = termosDoMedicamento(med);

      for (const regra of REGRAS_INTERACAO) {
        const novoNoA = termosNovo.some((t) => termoBate(t, regra.grupoA));
        const novoNoB = termosNovo.some((t) => termoBate(t, regra.grupoB));
        const existenteNoA = termosExistentes.some((t) => termoBate(t, regra.grupoA));
        const existenteNoB = termosExistentes.some((t) => termoBate(t, regra.grupoB));

        const bate = (novoNoA && existenteNoB) || (novoNoB && existenteNoA);
        if (!bate) continue;

        const chave = `${regra.id}|${med.id}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);

        achados.push({
          regraId: regra.id,
          gravidade: regra.gravidade,
          titulo: regra.titulo,
          risco: regra.risco,
          orientacao: regra.orientacao,
          medicamentoExistente: {
            id: med.id,
            nome: med.nome,
            dosagem: med.dosagem,
            principioAtivo: med.principioAtivo,
          },
        });
      }
    }

    return achados;
  }

  /* ------------------------------------------------------------------ */
  /* Situação das doses                                                  */
  /* ------------------------------------------------------------------ */

  const chaveRegistro = (medicamentoId, data, horario) => `${medicamentoId}|${data}|${horario}`;

  function indexarRegistros(registros) {
    const mapa = new Map();
    for (const r of registros || []) mapa.set(chaveRegistro(r.medicamentoId, r.data, r.horario), r);
    return mapa;
  }

  function situacaoDose(med, registro, dia, horario, agora) {
    if (registro) {
      if (registro.status === 'tomado') {
        return {
          status: 'tomado',
          rotulo: 'Tomado',
          registro,
          minutosDeAtraso: registro.minutosDeAtraso || 0,
          confirmadoEm: registro.registradoEm,
        };
      }
      if (registro.status === 'perdido') {
        return { status: 'perdido', rotulo: 'Perdido', registro };
      }
      if (registro.status === 'adiado') {
        const alvo = registro.adiadoPara ? new Date(registro.adiadoPara) : null;
        if (!alvo || alvo <= agora) {
          return { status: 'atrasado', rotulo: 'Atrasado', registro, adiado: true };
        }
        return {
          status: 'adiado',
          rotulo: `Adiado para ${horaTexto(alvo)}`,
          registro,
          adiadoPara: registro.adiadoPara,
        };
      }
    }

    const previsto = dataHora(dia, horario);
    if (agora >= previsto) {
      const minutos = Math.floor((agora - previsto) / 60000);
      if (minutos > 30) return { status: 'atrasado', rotulo: 'Atrasado', minutosDeAtraso: minutos };
      return { status: 'pendente', rotulo: 'Pendente' };
    }
    return { status: 'pendente', rotulo: 'Pendente' };
  }

  function itensDoDia(usuario, dia, agora) {
    const indice = indexarRegistros(usuario.registros);
    const itens = [];

    for (const med of usuario.medicamentos || []) {
      if (med.ativo === false) continue;
      if (dia < med.inicio || dia > med.termino) continue;
      for (const horario of med.horarios) {
        const registro = indice.get(chaveRegistro(med.id, dia, horario)) || null;
        const situacao = situacaoDose(med, registro, dia, horario, agora);
        itens.push({
          chave: chaveRegistro(med.id, dia, horario),
          medicamentoId: med.id,
          nome: med.nome,
          principioAtivo: med.principioAtivo,
          dosagem: med.dosagem,
          horario,
          data: dia,
          instrucao: med.instrucao,
          instrucaoTexto: TEXTO_INSTRUCAO[med.instrucao] || 'Conforme a receita',
          icone: ICONE_INSTRUCAO[med.instrucao] || '💊',
          observacoes: med.observacoes || '',
          temReceita: Boolean(med.receita),
          turno: TURNO_POR_HORA(horario),
          ...situacao,
        });
      }
    }

    itens.sort((a, b) => a.horario.localeCompare(b.horario));
    return itens;
  }

  /* ------------------------------------------------------------------ */
  /* Estado e ficha                                                      */
  /* ------------------------------------------------------------------ */

  function montarEstado(b, usuario) {
    const agora = new Date();
    const hoje = diaISO(agora);
    const pacienteUsuario = usuarioPaciente(b, usuario) || usuario;
    const itens = itensDoDia(pacienteUsuario, hoje, agora);

    const turnos = TURNOS.map((turno) => ({
      ...turno,
      itens: itens.filter((i) => i.turno === turno.id),
    }));

    const tomadasHoje = itens.filter((i) => i.status === 'tomado').length;
    const atrasadasHoje = itens.filter((i) => i.status === 'atrasado').length;
    const pendentesHoje = itens.filter((i) => i.status === 'pendente' || i.status === 'adiado').length;

    const proximo =
      itens.find((i) => i.status === 'atrasado' || i.status === 'adiado') ||
      itens.find((i) => i.status === 'pendente') ||
      null;

    const ficha = montarFicha(b, usuario, 30);
    const pacienteNome = pacienteUsuario.pacienteNome || pacienteUsuario.nome;

    return {
      autenticado: true,
      agora: agora.toISOString(),
      hoje,
      horaAtual: horaTexto(agora),
      usuario: usuarioPublico(usuario),
      paciente: {
        id: pacienteUsuario.id,
        nome: pacienteNome,
        tratamento: primeiroNome(pacienteNome),
        idade: pacienteUsuario.idade ?? null,
        perfil: pacienteUsuario.perfil,
        responsavel: pacienteUsuario.id === usuario.id ? null : usuario.nome,
      },
      perfil: usuario.perfil,
      acompanhando: pacienteUsuario.id !== usuario.id,
      medicamentos: (pacienteUsuario.medicamentos || []).map((med) => ({
        ...med,
        receita: undefined,
        temReceita: Boolean(med.receita),
      })),
      turnos,
      proximo,
      resumo: {
        totalHoje: itens.length,
        tomadasHoje,
        atrasadasHoje,
        pendentesHoje,
        adesao30: ficha.adesao,
        alertas: (pacienteUsuario.alertas || []).length,
        totalMedicamentos: (pacienteUsuario.medicamentos || []).length,
      },
      alertas: (pacienteUsuario.alertas || []).slice(-10).reverse(),
    };
  }

  function montarFicha(b, usuario, dias = 30) {
    const agora = new Date();
    const hoje = new Date(agora);
    hoje.setHours(0, 0, 0, 0);
    const pacienteUsuario = usuarioPaciente(b, usuario) || usuario;
    const indice = indexarRegistros(pacienteUsuario.registros);

    const porMedicamento = new Map();
    for (const med of pacienteUsuario.medicamentos || []) {
      if (med.ativo === false) continue;
      porMedicamento.set(med.id, {
        id: med.id,
        nome: med.nome,
        dosagem: med.dosagem,
        devidas: 0,
        tomadas: 0,
        perdidas: 0,
        atrasadas: 0,
      });
    }

    let devidas = 0;
    let tomadas = 0;
    let perdidas = 0;
    let atrasadas = 0;
    const perdidasLista = [];
    const diasResumo = [];

    for (let i = dias - 1; i >= 0; i -= 1) {
      const data = somarDias(hoje, -i);
      const dia = diaISO(data);
      let devidasDia = 0;
      let tomadasDia = 0;
      let perdidasDia = 0;

      for (const med of pacienteUsuario.medicamentos || []) {
        if (med.ativo === false) continue;
        if (dia < med.inicio || dia > med.termino) continue;
        const stats = porMedicamento.get(med.id);
        for (const horario of med.horarios) {
          const previsto = dataHora(dia, horario);
          if (previsto > agora) continue;

          const registro = indice.get(chaveRegistro(med.id, dia, horario));
          const situacao = situacaoDose(med, registro, dia, horario, agora);

          devidas += 1;
          devidasDia += 1;
          if (stats) stats.devidas += 1;

          if (situacao.status === 'tomado') {
            tomadas += 1;
            tomadasDia += 1;
            if (stats) stats.tomadas += 1;
            if ((situacao.minutosDeAtraso || 0) > 30) {
              atrasadas += 1;
              if (stats) stats.atrasadas += 1;
            }
          } else if (situacao.status === 'perdido' || (dia < diaISO(hoje) && situacao.status !== 'adiado')) {
            perdidas += 1;
            perdidasDia += 1;
            if (stats) stats.perdidas += 1;
            perdidasLista.push({
              data: dia,
              horario,
              medicamento: med.nome,
              dosagem: med.dosagem,
              status: 'Perdido',
            });
          }
        }
      }

      diasResumo.push({ dia, devidas: devidasDia, tomadas: tomadasDia, perdidas: perdidasDia });
    }

    const adesao = devidas > 0 ? Math.round((tomadas / devidas) * 100) : 0;
    const medicamentos = [...porMedicamento.values()].map((m) => ({
      ...m,
      adesao: m.devidas > 0 ? Math.round((m.tomadas / m.devidas) * 100) : 0,
    }));

    perdidasLista.sort((a, b2) => `${b2.data} ${b2.horario}`.localeCompare(`${a.data} ${a.horario}`));

    const pacienteNome = pacienteUsuario.pacienteNome || pacienteUsuario.nome;

    return {
      paciente: {
        nome: pacienteNome,
        tratamento: primeiroNome(pacienteNome),
        idade: pacienteUsuario.idade ?? null,
        perfil: pacienteUsuario.perfil,
        responsavel: pacienteUsuario.id === usuario.id ? null : usuario.nome,
        medico: null,
        condicoes: [],
      },
      geradoEm: agora.toISOString(),
      periodo: {
        dias,
        de: diaISO(somarDias(hoje, -(dias - 1))),
        ate: diaISO(hoje),
      },
      adesao,
      totais: {
        devidas,
        tomadas,
        atrasadas,
        perdidas,
        alertas: (pacienteUsuario.alertas || []).length,
        medicamentos: medicamentos.length,
        totalMedicamentos: (pacienteUsuario.medicamentos || []).length,
      },
      medicamentos,
      ultimosDias: diasResumo.slice(-7),
      perdidas: perdidasLista.slice(0, 20),
      alertas: (pacienteUsuario.alertas || []).slice(-10).reverse(),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Operações                                                           */
  /* ------------------------------------------------------------------ */

  function adicionarMedicamento(b, usuario, dados) {
    const pacienteUsuario = usuarioPaciente(b, usuario) || usuario;
    const med = {
      id: `m${Date.now().toString(36)}`,
      nome: dados.nome,
      principioAtivo: dados.principioAtivo,
      dosagem: dados.dosagem,
      catalogoId: dados.catalogoId || null,
      classe: dados.classe || '',
      apresentacao: dados.apresentacao || '',
      horarios: dados.horarios,
      inicio: dados.inicio,
      termino: dados.termino,
      instrucao: dados.instrucao,
      observacoes: dados.observacoes || '',
      receita: dados.receita || null,
      criadoEm: new Date().toISOString(),
      criadoPor: usuario.id,
      ativo: true,
    };
    pacienteUsuario.medicamentos.push(med);
    return med;
  }

  function registrarAlerta(usuario, alerta) {
    usuario.alertas.push({
      id: `a${Date.now().toString(36)}`,
      quando: new Date().toISOString(),
      ...alerta,
    });
  }

  function registrarDose(b, usuario, { medicamentoId, data, horario, acao, minutos }) {
    const pacienteUsuario = usuarioPaciente(b, usuario) || usuario;
    const med = pacienteUsuario.medicamentos.find((m) => m.id === medicamentoId);
    if (!med) return null;
    if (!HORA_VALIDA.test(horario)) return null;

    const agora = new Date();
    const chave = chaveRegistro(medicamentoId, data, horario);
    let registro = pacienteUsuario.registros.find((r) => chaveRegistro(r.medicamentoId, r.data, r.horario) === chave);

    if (acao === 'adiar') {
      const espera = Math.min(Math.max(Number(minutos) || 10, 1), 120);
      const alvo = new Date(agora.getTime() + espera * 60000);
      if (!registro) {
        registro = {
          id: `r-${medicamentoId}-${data}-${horario.replace(':', '')}`,
          medicamentoId,
          data,
          horario,
          status: 'adiado',
          minutosDeAtraso: 0,
          registradoEm: null,
          por: usuario.id,
        };
        pacienteUsuario.registros.push(registro);
      }
      registro.status = 'adiado';
      registro.adiadoPara = alvo.toISOString();
    } else {
      const previsto = dataHora(data, horario);
      const atraso = Math.max(0, Math.floor((agora - previsto) / 60000));
      if (!registro) {
        registro = {
          id: `r-${medicamentoId}-${data}-${horario.replace(':', '')}`,
          medicamentoId,
          data,
          horario,
          status: 'tomado',
          minutosDeAtraso: atraso,
          registradoEm: agora.toISOString(),
          por: usuario.id,
        };
        pacienteUsuario.registros.push(registro);
      } else {
        registro.status = 'tomado';
        registro.minutosDeAtraso = atraso;
        registro.registradoEm = agora.toISOString();
        registro.por = usuario.id;
        delete registro.adiadoPara;
      }
    }

    return registro;
  }

  /* ------------------------------------------------------------------ */
  /* Validações                                                          */
  /* ------------------------------------------------------------------ */

  async function validarMedicamento(corpo) {
    const erros = [];
    const item = await Catalogo.obter(corpo.catalogoId || corpo.nome);
    const nome = item ? item.nome : String(corpo.nome || '').trim();
    const principioAtivo = item ? item.principioAtivo : '';
    const dosagem = String(corpo.dosagem || '').trim() || (item ? item.dosagem : '');
    const instrucao = String(corpo.instrucao || 'apos_refeicao');
    const inicio = String(corpo.inicio || '').trim();
    const termino = String(corpo.termino || '').trim();
    const horarios = Array.isArray(corpo.horarios)
      ? [...new Set(corpo.horarios.map((h) => String(h).trim()))].filter((h) => HORA_VALIDA.test(h)).sort()
      : [];

    if (!item) erros.push('Escolha um remédio da lista do bulário.');
    if (!dosagem) erros.push('Informe a dosagem (ex.: 50 mg).');
    if (!horarios.length) erros.push('Marque pelo menos um horário para a dose.');
    if (!dataExiste(inicio)) erros.push('Informe uma data de início válida.');
    if (!dataExiste(termino)) erros.push('Informe uma data de término válida.');
    if (dataExiste(inicio) && dataExiste(termino) && termino < inicio) {
      erros.push('A data de término precisa ser depois da data de início.');
    }
    if (!['jejum', 'antes_refeicao', 'com_comida', 'apos_refeicao', 'antes_dormir'].includes(instrucao)) {
      erros.push('Escolha como o remédio deve ser tomado.');
    }

    let receita = null;
    if (typeof corpo.receita === 'string' && corpo.receita.startsWith('data:image/')) {
      if (corpo.receita.length <= 3 * 1024 * 1024) receita = corpo.receita;
    }

    return {
      erros,
      dados: {
        nome,
        principioAtivo,
        dosagem,
        catalogoId: item ? item.id : null,
        classe: item ? item.classe : '',
        apresentacao: item ? item.apresentacao : '',
        instrucao,
        inicio,
        termino,
        horarios,
        observacoes: String(corpo.observacoes || '').trim().slice(0, 500),
        receita,
      },
    };
  }

  function falha(status, corpo) {
    const erro = new Error(corpo.mensagem || 'Não foi possível concluir a operação.');
    erro.status = status;
    erro.corpo = corpo;
    return erro;
  }

  function sessaoObrigatoria() {
    const usuario = usuarioAtual(base);
    if (!usuario) {
      throw falha(401, { erro: 'sessao', mensagem: 'Nenhum usuário conectado.' });
    }
    return usuario;
  }

  /* ------------------------------------------------------------------ */
  /* "API" local                                                         */
  /* ------------------------------------------------------------------ */

  async function requisitar(caminho, opcoes = {}) {
    const url = new URL(String(caminho), window.location.href);
    const metodo = String(opcoes.method || 'GET').toUpperCase();
    let corpo = {};
    if (opcoes.body) {
      try {
        corpo = JSON.parse(opcoes.body);
      } catch (erro) {
        throw falha(400, { erro: 'json', mensagem: 'JSON inválido no corpo da requisição.' });
      }
    }
    const rota = `${metodo} ${url.pathname}`;

    if (rota === 'GET /api/saude') {
      return { ok: true, servico: 'Dose Dupla', modo: 'demonstração', versao: '3.0.0' };
    }

    if (rota === 'GET /api/catalogo') {
      const termo = String(url.searchParams.get('q') || '').trim();
      const limite = Math.min(Math.max(Number(url.searchParams.get('limite')) || 10, 1), 40);
      const id = String(url.searchParams.get('id') || '').trim();
      const info = await Catalogo.info();
      if (id) {
        const item = await Catalogo.obter(id);
        if (!item) throw falha(404, { erro: 'nao_encontrado', mensagem: 'Remédio não encontrado.' });
        return { item: Catalogo.publico(item) };
      }
      return {
        fonte: info.fonte,
        total: info.total,
        itens: await Catalogo.buscar(termo, limite),
        popular: termo ? [] : await Catalogo.populares(),
      };
    }

    if (rota === 'GET /api/estado') {
      return montarEstado(base, usuarioAtual(base));
    }

    if (rota === 'GET /api/ficha') {
      const usuario = sessaoObrigatoria();
      return montarFicha(base, usuario, 30);
    }

    if (rota === 'GET /api/medicamentos') {
      const usuario = sessaoObrigatoria();
      const paciente = usuarioPaciente(base, usuario);
      return { medicamentos: paciente.medicamentos };
    }

    if (rota === 'POST /api/medicamentos') {
      const usuario = sessaoObrigatoria();
      const paciente = usuarioPaciente(base, usuario);

      const { erros, dados } = await validarMedicamento(corpo);
      if (erros.length) {
        throw falha(400, { erro: 'validacao', mensagem: erros[0], campos: erros });
      }

      const interacoes = verificarInteracoes(dados, paciente.medicamentos);
      if (interacoes.length && corpo.confirmadoMedico !== true) {
        throw falha(409, {
          erro: 'interacao',
          mensagem: 'Este remédio pode interagir com outro que já está em uso.',
          interacoes,
          dados,
        });
      }

      const med = adicionarMedicamento(base, usuario, dados);

      if (interacoes.length) {
        registrarAlerta(paciente, {
          tipo: 'interacao_confirmada',
          medicamento: `${med.nome} (${med.dosagem})`,
          interacoes,
          perfil: usuario.perfil,
          registradoPor: usuario.nome,
          observacao: String(corpo.justificativa || 'Confirmado que o médico está ciente.'),
        });
      }

      return {
        mensagem: 'Remédio cadastrado com sucesso.',
        medicamento: med,
        alertaRegistrado: interacoes.length > 0,
        interacoes,
        estado: montarEstado(base, usuario),
      };
    }

    if (rota === 'POST /api/doses') {
      const usuario = sessaoObrigatoria();

      const medicamentoId = String(corpo.medicamentoId || '');
      const data = String(corpo.data || '');
      const horario = String(corpo.horario || '');
      const acao = String(corpo.acao || 'tomar');

      if (!medicamentoId || !dataExiste(data) || !HORA_VALIDA.test(horario)) {
        throw falha(400, { erro: 'validacao', mensagem: 'Dados da dose inválidos.' });
      }
      if (!['tomar', 'adiar'].includes(acao)) {
        throw falha(400, { erro: 'validacao', mensagem: 'Ação inválida.' });
      }

      const registro = registrarDose(base, usuario, {
        medicamentoId,
        data,
        horario,
        acao,
        minutos: corpo.minutos,
      });

      if (!registro) {
        throw falha(404, { erro: 'nao_encontrado', mensagem: 'Medicamento não encontrado.' });
      }

      return {
        mensagem: acao === 'adiar' ? 'Lembrete adiado.' : 'Dose registrada.',
        registro,
        estado: montarEstado(base, usuario),
      };
    }

    throw falha(404, { erro: 'nao_encontrado', mensagem: 'Rota não encontrada.' });
  }

  async function pdfBlob() {
    const usuario = sessaoObrigatoria();
    const ficha = montarFicha(base, usuario, 30);
    const bytes = Pdf.gerarPdfFicha(ficha);
    return new Blob([bytes], { type: 'application/pdf' });
  }

  function alternarPerfil() {
    const atual = usuarioAtual(base);
    base.sessao = atual && atual.id === ID_PACIENTE ? ID_USUARIO : ID_PACIENTE;
    return montarEstado(base, usuarioAtual(base));
  }

  function reiniciar() {
    base = criarDemo();
    return montarEstado(base, usuarioAtual(base));
  }

  return {
    requisitar,
    pdfBlob,
    alternarPerfil,
    reiniciar,
  };
})();

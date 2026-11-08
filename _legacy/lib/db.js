'use strict';

/**
 * Dose Dupla - camada de dados e regras de negocio.
 * Persistencia em JSON, sem dependencias externas.
 * Base inicial vazia: nenhum usuario ou medicamento pre-cadastrado.
 */

const fs = require('fs');
const path = require('path');

const DIR_DADOS = path.join(__dirname, '..', 'data');
const ARQ_DADOS = path.join(DIR_DADOS, 'db.json');
const VERSAO = 3;
const PERFIS_VALIDOS = ['idoso', 'familiar', 'cuidador', 'medico'];

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
const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;

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
/* Base de conhecimento de interacoes medicamentosas                   */
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

/* ------------------------------------------------------------------ */
/* Persistencia                                                        */
/* ------------------------------------------------------------------ */

let cache = null;

const criarBase = () => ({
  versao: VERSAO,
  criadoEm: new Date().toISOString(),
  sessao: null,
  usuarios: [],
});

function salvar(base) {
  if (!fs.existsSync(DIR_DADOS)) fs.mkdirSync(DIR_DADOS, { recursive: true });
  const temporario = `${ARQ_DADOS}.tmp`;
  fs.writeFileSync(temporario, JSON.stringify(base, null, 2), 'utf8');
  fs.renameSync(temporario, ARQ_DADOS);
  cache = base;
}

function migrarBase(lido) {
  if (!lido || typeof lido !== 'object' || !Array.isArray(lido.usuarios)) return null;
  if (lido.versao === VERSAO) return lido;
  if (lido.versao === 2) {
    const idosos = lido.usuarios.filter((u) => u.perfil === 'idoso');
    for (const usuario of lido.usuarios) {
      if (usuario.perfil === 'idoso') continue;
      if (usuario.pacienteId) continue;
      const alvo = idosos.find((i) => normalizar(i.nome) === normalizar(usuario.pacienteNome));
      if (alvo) usuario.pacienteId = alvo.id;
    }
    lido.versao = VERSAO;
    lido.migradoEm = new Date().toISOString();
    return lido;
  }
  return null;
}

function carregar() {
  if (cache) return cache;

  if (!fs.existsSync(ARQ_DADOS)) {
    const base = criarBase();
    salvar(base);
    return base;
  }

  try {
    const lido = JSON.parse(fs.readFileSync(ARQ_DADOS, 'utf8'));
    const versaoOriginal = lido && lido.versao;
    const migrado = migrarBase(lido);
    if (!migrado) {
      try {
        fs.copyFileSync(ARQ_DADOS, path.join(DIR_DADOS, `db.versao-antiga-${Date.now()}.json`));
      } catch (erro) {
        /* backup opcional */
      }
      const base = criarBase();
      salvar(base);
      return base;
    }
    if (versaoOriginal !== VERSAO) {
      salvar(migrado);
      return migrado;
    }
    cache = lido;
    return cache;
  } catch (erro) {
    const base = criarBase();
    salvar(base);
    return base;
  }
}

/* ------------------------------------------------------------------ */
/* Usuarios                                                            */
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

const listarUsuarios = (base) => base.usuarios.map(usuarioPublico);
const listarIdosos = (base) =>
  base.usuarios.filter((u) => u.perfil === 'idoso').map(usuarioPublico);
const usuarioAtual = (base) => base.usuarios.find((u) => u.id === base.sessao) || null;

/** Usuário cujos dados devem ser lidos/alterados na sessão atual. */
function usuarioPaciente(base, usuario) {
  if (!usuario) return null;
  if (usuario.perfil === 'idoso') return usuario;
  const alvo = base.usuarios.find((u) => u.id === usuario.pacienteId && u.perfil === 'idoso');
  return alvo || usuario;
}

function criarUsuario(base, dados) {
  const paciente = dados.pacienteId
    ? base.usuarios.find((u) => u.id === dados.pacienteId && u.perfil === 'idoso')
    : null;
  const usuario = {
    id: `u${Date.now().toString(36)}${Math.floor(Math.random() * 999).toString(36)}`,
    nome: dados.nome,
    idade: dados.idade ?? null,
    perfil: dados.perfil,
    pacienteId: paciente ? paciente.id : null,
    pacienteNome: paciente ? paciente.nome : dados.nome,
    criadoEm: new Date().toISOString(),
    medicamentos: [],
    registros: [],
    alertas: [],
  };
  base.usuarios.push(usuario);
  base.sessao = usuario.id;
  salvar(base);
  return usuario;
}

function autenticar(base, usuarioId) {
  const usuario = base.usuarios.find((u) => u.id === usuarioId);
  if (!usuario) return null;
  base.sessao = usuario.id;
  salvar(base);
  return usuario;
}

function sair(base) {
  base.sessao = null;
  salvar(base);
}

/* ------------------------------------------------------------------ */
/* Interacoes                                                          */
/* ------------------------------------------------------------------ */

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
/* Situacao das doses                                                  */
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
    if (minutos > 30) {
      return { status: 'atrasado', rotulo: 'Atrasado', minutosDeAtraso: minutos };
    }
    return { status: 'pendente', rotulo: 'Pendente' };
  }
  return { status: 'pendente', rotulo: 'Pendente' };
}

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

function montarEstado(base, usuario) {
  const agora = new Date();
  const hoje = diaISO(agora);
  const pacienteUsuario = usuarioPaciente(base, usuario) || usuario;
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

  const ficha = montarFicha(base, usuario, 30);
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

/* ------------------------------------------------------------------ */
/* Ficha medica / relatorio                                            */
/* ------------------------------------------------------------------ */

function montarFicha(base, usuario, dias = 30) {
  const agora = new Date();
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const pacienteUsuario = usuarioPaciente(base, usuario) || usuario;
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
        if (previsto > agora) continue; // ainda nao chegou a hora

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

  perdidasLista.sort((a, b) => `${b.data} ${b.horario}`.localeCompare(`${a.data} ${a.horario}`));

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
/* Operacoes                                                           */
/* ------------------------------------------------------------------ */

function adicionarMedicamento(base, usuario, dados) {
  const pacienteUsuario = usuarioPaciente(base, usuario) || usuario;
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

function registrarDose(base, usuario, { medicamentoId, data, horario, acao, minutos }) {
  const pacienteUsuario = usuarioPaciente(base, usuario) || usuario;
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

module.exports = {
  carregar,
  salvar,
  listarUsuarios,
  listarIdosos,
  usuarioAtual,
  usuarioPaciente,
  criarUsuario,
  autenticar,
  sair,
  montarEstado,
  montarFicha,
  verificarInteracoes,
  adicionarMedicamento,
  registrarAlerta,
  registrarDose,
  itensDoDia,
  normalizar,
  diaISO,
  dataHora,
  primeiroNome,
  HORA_VALIDA,
  PERFIS_VALIDOS,
  TEXTO_INSTRUCAO,
};

'use strict';

/* ============================================================
   Dose Dupla - protótipo funcional (front-end)
   ============================================================ */

const PERFIS = {
  idoso: {
    nome: 'Idoso',
    avatar: '👵',
    descricao: 'Vê a rotina e confirma as doses.',
  },
  familiar: {
    nome: 'Familiar',
    avatar: '👩',
    descricao: 'Acompanha a rotina e cadastra remédios.',
  },
  cuidador: {
    nome: 'Cuidador',
    avatar: '🧑‍⚕️',
    descricao: 'Recebe os alertas e registra as doses.',
  },
  medico: {
    nome: 'Médico',
    avatar: '👨‍⚕️',
    descricao: 'Consulta a ficha e os relatórios.',
  },
};

const HORARIOS_DISPONIVEIS = [
  { valor: '08:00', rotulo: 'Manhã', icone: '🌅' },
  { valor: '12:00', rotulo: 'Almoço', icone: '🍽️' },
  { valor: '16:00', rotulo: 'Tarde', icone: '☀️' },
  { valor: '20:00', rotulo: 'Noite', icone: '🌙' },
  { valor: '22:00', rotulo: 'Antes de dormir', icone: '🌛' },
];

const CICLO_DONUT = 2 * Math.PI * 70;

const app = {
  dados: null,
  ficha: null,
  tela: 'rotina',
  telaAuth: 'boas-vindas',
  usuarios: [],
  idosos: [],
  autenticado: false,
  overlay: null,
  focoAnterior: null,
  alarme: null,
  pendente: null,
  receita: null,
  catalogoItem: null,
  sugestoes: [],
  lembretes: new Map(),
  vistos: new Set(),
  enviando: false,
};

const el = (id) => document.getElementById(id);
const conteudo = el('conteudo');
const camada = el('camada');
const aviso = el('aviso');

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const esc = (texto) =>
  String(texto === undefined || texto === null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatarDataLonga = (data) => {
  const texto = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(data);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const formatarHora = (iso) => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatarDataCurta = (dia) => {
  const data = new Date(`${dia}T12:00:00`);
  if (Number.isNaN(data.getTime())) return dia;
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const diaDeHoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const somarDiasISO = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const duracao = (minutos) => {
  if (!minutos || minutos < 1) return 'poucos minutos';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h ${resto}min` : `${horas}h`;
};

const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';

const perfilDe = (chave) => PERFIS[chave] || PERFIS.idoso;

async function buscar(caminho, opcoes = {}) {
  return window.DoseDuplaDemo.requisitar(caminho, opcoes);
}

const enviar = (caminho, dados) =>
  buscar(caminho, { method: 'POST', body: JSON.stringify(dados) });

/* ------------------------------------------------------------------ */
/* Avisos flutuantes                                                   */
/* ------------------------------------------------------------------ */

let tempoAviso = null;

function mostrarAviso(mensagem, tipo = 'info') {
  if (!aviso) return;
  clearTimeout(tempoAviso);
  aviso.innerHTML = `<span aria-hidden="true">${tipo === 'sucesso' ? '✅' : tipo === 'erro' ? '⚠️' : '💬'}</span><span>${esc(mensagem)}</span>`;
  aviso.className = `aviso aviso--${tipo}`;
  aviso.hidden = false;
  requestAnimationFrame(() => aviso.classList.add('visivel'));
  tempoAviso = setTimeout(() => {
    aviso.classList.remove('visivel');
    setTimeout(() => {
      aviso.hidden = true;
    }, 260);
  }, 4200);
}

/* ------------------------------------------------------------------ */
/* Som do alarme                                                       */
/* ------------------------------------------------------------------ */

function tocarSom() {
  try {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;
    const contexto = new Contexto();
    [0, 0.42, 0.84].forEach((atraso) => {
      const oscilador = contexto.createOscillator();
      const ganho = contexto.createGain();
      const inicio = contexto.currentTime + atraso;
      oscilador.type = 'sine';
      oscilador.frequency.setValueAtTime(880, inicio);
      oscilador.frequency.setValueAtTime(1046, inicio + 0.12);
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.exponentialRampToValueAtTime(0.25, inicio + 0.03);
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.34);
      oscilador.connect(ganho).connect(contexto.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + 0.36);
    });
    setTimeout(() => contexto.close().catch(() => {}), 2000);
  } catch (erro) {
    /* som é opcional */
  }
  if (navigator.vibrate) navigator.vibrate([220, 120, 220]);
}

/* ------------------------------------------------------------------ */
/* Relógio da barra de status                                          */
/* ------------------------------------------------------------------ */

function atualizarRelogio() {
  const alvo = el('relogioStatus');
  if (!alvo) return;
  const agora = new Date();
  alvo.textContent = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/* ------------------------------------------------------------------ */
/* Cabeçalho e abas                                                    */
/* ------------------------------------------------------------------ */

function atualizarCabecalho() {
  const botao = el('btnConta');
  const subtitulo = el('appSubtitulo');

  if (!app.autenticado || !app.dados) {
    if (botao) botao.hidden = true;
    if (subtitulo) subtitulo.textContent = 'Sua rotina de remédios';
    return;
  }

  const usuario = app.dados.usuario;
  const perfil = perfilDe(usuario.perfil);
  const paciente = app.dados.paciente;

  if (botao) {
    botao.hidden = false;
    botao.title = 'Sobre o protótipo';
    el('contaAvatar').textContent = '💊';
    el('contaNome').textContent = 'Sobre';
  }
  if (subtitulo) {
    subtitulo.textContent =
      usuario.perfil === 'idoso' ? 'Sua rotina de remédios' : `Rotina de ${paciente.tratamento || paciente.nome}`;
  }
}

function atualizarAbas() {
  const abas = el('appAbas');
  if (abas) abas.hidden = !app.autenticado;
  document.querySelectorAll('.aba').forEach((aba) => {
    if (aba.dataset.tela === app.tela && app.autenticado) aba.setAttribute('aria-current', 'page');
    else aba.removeAttribute('aria-current');
  });
}

/* ------------------------------------------------------------------ */
/* Navegação                                                           */
/* ------------------------------------------------------------------ */

function irPara(tela, opcoes = {}) {
  if (!app.autenticado) return;
  if (!['rotina', 'cadastro', 'ficha'].includes(tela)) tela = 'rotina';
  const mudou = app.tela !== tela;
  app.tela = tela;
  atualizarAbas();

  if (!opcoes.semHash && location.hash.slice(1) !== tela) {
    history.replaceState(null, '', `#${tela}`);
  }

  if (tela === 'ficha') {
    renderFicha();
  } else {
    render();
  }

  if (mudou && !opcoes.semScroll) {
    conteudo.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (mudou) {
    conteudo.focus({ preventScroll: true });
  }
}

/* ------------------------------------------------------------------ */
/* Carregamento                                                        */
/* ------------------------------------------------------------------ */

async function carregar(opcoes = {}) {
  try {
    const dados = await buscar('/api/estado');
    app.autenticado = true;
    app.dados = dados;
    atualizarCabecalho();
    atualizarAbas();

    const interagindo = document.activeElement && document.activeElement.closest && document.activeElement.closest('#formMedicamento');
    if (!app.overlay && !interagindo) render();
    return dados;
  } catch (erro) {
    if (!opcoes.silencioso) {
      conteudo.innerHTML = `
        <div class="tela">
          <div class="alerta-faixa"><span aria-hidden="true">⚠️</span><div><strong>Não foi possível carregar a demonstração.</strong>Recarregue a página para voltar aos dados de exemplo.</div></div>
        </div>`;
    }
    console.error(erro);
    return null;
  }
}

/* A demonstração já inicia autenticada: não há cadastro, troca de usuário nem logout. */

/* ------------------------------------------------------------------ */
/* Render principal                                                    */
/* ------------------------------------------------------------------ */

function render() {
  if (!app.dados) return;
  if (app.tela === 'cadastro') renderCadastro();
  else if (app.tela === 'ficha') renderFicha();
  else renderRotina();
}

const itensDoDia = () =>
  (app.dados ? app.dados.turnos.flatMap((turno) => turno.itens) : []);

const encontrarItem = (chave) => itensDoDia().find((item) => item.chave === chave) || null;

/* ------------------------------------------------------------------ */
/* Tela 1 - Minha Rotina                                               */
/* ------------------------------------------------------------------ */

function seloStatus(item) {
  const rotulos = {
    tomado: '✅ Tomado',
    pendente: '🕐 Pendente',
    atrasado: '⚠️ Atrasado',
    adiado: '⏰ Adiado',
    perdido: '❌ Perdido',
  };
  let rotulo = item.rotulo || rotulos[item.status] || item.status;
  if (item.status === 'atrasado' && item.minutosDeAtraso) {
    rotulo = `⚠️ Atrasado há ${duracao(item.minutosDeAtraso)}`;
  }
  return `<span class="selo selo--${item.status}">${esc(rotulo)}</span>`;
}

function cartaoMedicamento(item) {
  const detalhe = [item.dosagem, item.instrucaoTexto].filter(Boolean).join(' · ');
  const botao =
    item.status === 'tomado' || item.status === 'perdido'
      ? `<button class="btn btn-mini btn-mini--claro" type="button" data-abrir="${esc(item.chave)}">Ver detalhes</button>`
      : `<button class="btn btn-mini btn-mini--verde" type="button" data-abrir="${esc(item.chave)}">Registrar</button>`;

  return `
    <article class="cartao-med cartao-med--${item.status}">
      <div class="cartao-linha">
        <span class="cartao-icone" aria-hidden="true">${esc(item.icone)}</span>
        <div class="cartao-texto">
          <h3>${esc(item.nome)}</h3>
          <p>${esc(detalhe)}${item.temReceita ? ' · 📎 receita anexada' : ''}</p>
        </div>
        <span class="cartao-hora">${esc(item.horario)}</span>
      </div>
      <div class="cartao-rodape">
        ${seloStatus(item)}
        ${botao}
      </div>
    </article>`;
}

function renderRotina() {
  const d = app.dados;
  const usuario = d.usuario;
  const perfil = perfilDe(usuario.perfil);
  const resumo = d.resumo;
  const paciente = d.paciente;
  const semRemedios = resumo.totalMedicamentos === 0;

  const pct = resumo.totalHoje ? Math.round((resumo.tomadasHoje / resumo.totalHoje) * 100) : 0;
  const itens = itensDoDia();
  const proximo = d.proximo;
  const atrasadas = itens.filter((i) => i.status === 'atrasado');

  const cartaoVazio = `
    <article class="vazio-card">
      <span class="vazio-icone" aria-hidden="true">💊</span>
      <h2>Nenhum remédio cadastrado</h2>
      <p>Cadastre o primeiro remédio de ${usuario.perfil === 'idoso' ? 'sua rotina' : esc(paciente.tratamento || paciente.nome)} para começar a receber os alarmes.</p>
      <button class="btn btn-primario" type="button" data-ir="cadastro">➕ Cadastrar meu primeiro remédio</button>
    </article>`;

  const cartaoProximo = proximo
    ? `
      <article class="proximo ${proximo.status === 'atrasado' ? 'proximo--atraso' : ''}">
        <span class="proximo-icone" aria-hidden="true">${esc(proximo.icone)}</span>
        <div class="proximo-texto">
          <span class="rotulo">${proximo.status === 'atrasado' ? 'Dose atrasada' : proximo.status === 'adiado' ? 'Lembrete adiado' : 'Próxima dose'}</span>
          <h2>${esc(proximo.nome)}</h2>
          <p>${esc(proximo.dosagem)} · ${esc(proximo.instrucaoTexto)}</p>
        </div>
        <div class="proximo-hora">
          <strong>${esc(proximo.horario)}</strong>
          <small>horário</small>
        </div>
        <button class="btn btn-primario" type="button" data-abrir="${esc(proximo.chave)}">
          <span aria-hidden="true">🔔</span> Abrir alarme
        </button>
      </article>`
    : !semRemedios
      ? `
      <article class="proximo">
        <span class="proximo-icone" aria-hidden="true">🎉</span>
        <div class="proximo-texto">
          <span class="rotulo">Tudo em dia</span>
          <h2>Nenhuma dose pendente por hoje</h2>
          <p>As doses de hoje já foram registradas. Continue assim!</p>
        </div>
      </article>`
      : '';

  const faixaAtraso = atrasadas.length
    ? `<div class="alerta-faixa" role="status"><span aria-hidden="true">⏰</span><div><strong>${atrasadas.length === 1 ? 'Você tem 1 dose atrasada.' : `Você tem ${atrasadas.length} doses atrasadas.`}</strong>Toque em “Registrar” para confirmar ou adiar o lembrete.</div></div>`
    : '';

  const painelProgresso = semRemedios
    ? ''
    : `
      <div class="painel-progresso">
        <div class="barra" role="img" aria-label="${resumo.tomadasHoje} de ${resumo.totalHoje} doses tomadas hoje">
          <span style="width:${pct}%"></span>
        </div>
        <div>
          <strong>${resumo.tomadasHoje} de ${resumo.totalHoje} doses</strong>
          <small>tomadas hoje (${pct}%)</small>
        </div>
      </div>`;

  const turnos = semRemedios
    ? ''
    : d.turnos
        .map((turno) => {
          const tomadas = turno.itens.filter((i) => i.status === 'tomado').length;
          return `
            <section class="turno" aria-labelledby="turno-${turno.id}">
              <h2 class="turno-titulo" id="turno-${turno.id}">
                <span aria-hidden="true">${turno.icone}</span> ${esc(turno.nome)}
                <span class="contagem">${tomadas}/${turno.itens.length}</span>
              </h2>
              <div class="lista-meds">
                ${turno.itens.length ? turno.itens.map(cartaoMedicamento).join('') : '<p class="vazio">Nenhum remédio neste turno.</p>'}
              </div>
            </section>`;
        })
        .join('');

  const saudacao =
    usuario.perfil === 'idoso'
      ? 'Sua rotina de hoje está organizada por turnos.'
      : `Acompanhando a rotina de <strong>${esc(paciente.nome)}</strong>.`;

  const dica = semRemedios
    ? ''
    : `
      <p class="dica">
        <span class="dica-icone" aria-hidden="true">💡</span>
        Toque em “Registrar” para abrir o alarme da dose.
        <button class="link" type="button" data-simular>Testar alarme agora</button>
      </p>`;

  conteudo.innerHTML = `
    <section class="tela tela-rotina">
      <div class="demo-selo"><span aria-hidden="true">🧪</span> Protótipo demonstrativo · dados de exemplo</div>

      <div class="saudacao">
        <div>
          <h1>Olá, ${esc(primeiroNome(usuario.nome))} 👋</h1>
          <p>${saudacao} Hoje é <strong>${esc(formatarDataLonga(new Date()))}</strong>.</p>
        </div>
      </div>

      ${faixaAtraso}
      ${painelProgresso}
      ${semRemedios ? cartaoVazio : cartaoProximo}

      <div class="turnos">
        ${turnos}
      </div>

      ${dica}

      <p class="dica" aria-hidden="true">👤 ${esc(perfil.nome)} · ${esc(usuario.nome)}</p>
    </section>`;

  conteudo.querySelectorAll('[data-abrir]').forEach((botao) => {
    botao.addEventListener('click', () => abrirAlarme(botao.dataset.abrir));
  });
  const simular = conteudo.querySelector('[data-simular]');
  if (simular) simular.addEventListener('click', simularAlarme);
  const irCadastro = conteudo.querySelector('[data-ir="cadastro"]');
  if (irCadastro) irCadastro.addEventListener('click', () => irPara('cadastro'));
}

/* ------------------------------------------------------------------ */
/* Tela 2 - Alarme e confirmação                                       */
/* ------------------------------------------------------------------ */

function abrirOverlay(html, classe) {
  app.focoAnterior = document.activeElement;
  camada.innerHTML = `<div class="overlay ${classe}">${html}</div>`;
  camada.hidden = false;
  app.overlay = classe;
  const primeiro = camada.querySelector('button:not([disabled]), [href], input');
  if (primeiro) primeiro.focus({ preventScroll: true });
}

function fecharOverlay() {
  camada.hidden = true;
  camada.innerHTML = '';
  app.overlay = null;
  app.alarme = null;
  if (app.focoAnterior && document.contains(app.focoAnterior)) {
    app.focoAnterior.focus({ preventScroll: true });
  }
  app.focoAnterior = null;
}

function abrirAlarme(chave) {
  const item = encontrarItem(chave);
  if (!item) return;
  app.alarme = item;
  tocarSom();

  const jaTomado = item.status === 'tomado';
  const jaPerdido = item.status === 'perdido';

  const rodape = jaTomado
    ? `<p class="alarme-tomado">✅ Dose confirmada${item.confirmadoEm ? ` às ${formatarHora(item.confirmadoEm)}` : ''}. ${item.minutosDeAtraso > 30 ? `Registrada com ${duracao(item.minutosDeAtraso)} de atraso.` : 'Muito bem!'}</p>
       <div class="alarme-acoes"><button class="btn btn-secundario" type="button" data-acao="fechar">Fechar</button></div>`
    : jaPerdido
      ? `<p class="alarme-tomado">Esta dose consta como perdida no histórico. Se você tomou, fale com seu cuidador.</p>
         <div class="alarme-acoes"><button class="btn btn-secundario" type="button" data-acao="fechar">Fechar</button></div>`
      : `<div class="alarme-acoes">
           <button class="btn btn-confirmar" type="button" data-acao="confirmar">✅ Confirmar Tomada</button>
           <button class="btn btn-secundario" type="button" data-acao="adiar">⏰ Lembrar em 10 minutos</button>
           <button class="btn btn-texto" type="button" data-acao="fechar">Fechar</button>
         </div>
         <p class="alarme-dica">Se a dose já foi tomada antes, confirme mesmo assim para atualizar a rotina.</p>`;

  abrirOverlay(
    `
    <div class="alarme" role="dialog" aria-modal="true" aria-labelledby="tituloAlarme">
      <span class="alarme-etiqueta">${item.status === 'atrasado' ? '⏰ Dose atrasada' : item.status === 'adiado' ? '🔔 Lembrete' : '⏰ Hora do remédio'}</span>
      <p class="alarme-hora">${esc(item.horario)}</p>
      <h2 class="alarme-nome" id="tituloAlarme">${esc(item.nome)}</h2>
      <p class="alarme-dose">${esc(item.dosagem)}</p>
      <p class="alarme-instrucao">${esc(item.icone)} ${esc(item.instrucaoTexto)}</p>
      ${item.observacoes ? `<p class="alarme-obs">${esc(item.observacoes)}</p>` : ''}
      ${rodape}
    </div>`,
    'overlay-alarme',
  );
}

async function acaoAlarme(acao) {
  const item = app.alarme;
  if (!item) return;

  if (acao === 'fechar') {
    fecharOverlay();
    return;
  }

  const botoes = camada.querySelectorAll('button');
  botoes.forEach((b) => {
    b.disabled = true;
  });

  try {
    const resposta = await enviar('/api/doses', {
      medicamentoId: item.medicamentoId,
      data: item.data,
      horario: item.horario,
      acao: acao === 'adiar' ? 'adiar' : 'tomar',
      minutos: 10,
    });

    app.dados = resposta.estado;
    fecharOverlay();
    atualizarCabecalho();
    render();

    if (acao === 'adiar') {
      mostrarAviso('Combinado! Vamos lembrar você em 10 minutos.', 'info');
      agendarLembrete(item.chave, 10);
    } else {
      mostrarAviso('Dose registrada. Muito bem!', 'sucesso');
    }
  } catch (erro) {
    botoes.forEach((b) => {
      b.disabled = false;
    });
    if (erro.status === 401) {
      fecharOverlay();
      await carregar({ silencioso: true });
      return;
    }
    mostrarAviso(erro.message, 'erro');
  }
}

function agendarLembrete(chave, minutos) {
  if (app.lembretes.has(chave)) clearTimeout(app.lembretes.get(chave));
  const timer = setTimeout(async () => {
    app.lembretes.delete(chave);
    if (app.overlay) return; // o verificador periódico retoma quando a tela estiver livre
    await carregar({ silencioso: true });
    const item = encontrarItem(chave);
    if (item && item.status !== 'tomado' && item.status !== 'perdido') {
      abrirAlarme(chave);
    }
  }, minutos * 60000);
  app.lembretes.set(chave, timer);
}

function simularAlarme() {
  const itens = itensDoDia();
  const alvo =
    itens.find((i) => i.status === 'atrasado') ||
    itens.find((i) => i.status === 'pendente') ||
    itens.find((i) => i.status === 'adiado') ||
    itens[0];
  if (!alvo) {
    mostrarAviso('Nenhuma dose programada para hoje.', 'info');
    return;
  }
  abrirAlarme(alvo.chave);
}

/* ------------------------------------------------------------------ */
/* Tela 3 - Cadastro de remédio                                        */
/* ------------------------------------------------------------------ */

function opcoesHorarios(selecionados = []) {
  return HORARIOS_DISPONIVEIS.map(
    (h) => `
      <label class="chip">
        <input type="checkbox" name="horarios" value="${h.valor}" ${selecionados.includes(h.valor) ? 'checked' : ''}>
        <span class="chip-marca" aria-hidden="true">✓</span>
        <span>${h.icone} ${h.rotulo} · ${h.valor}</span>
      </label>`,
  ).join('');
}

let timerSugestoes = null;

function fecharSugestoes() {
  const caixa = el('sugestoes');
  const campo = el('nome');
  if (!caixa) return;
  caixa.hidden = true;
  if (campo) campo.setAttribute('aria-expanded', 'false');
}

function descreverSugestao(item) {
  const principio = String(item.principioAtivo || '').trim();
  const nome = String(item.nome || '').trim();
  if (principio && principio.toLowerCase() !== nome.toLowerCase()) return principio;
  const classe = String(item.classe || '').trim();
  return classe && classe !== 'Consulte a bula' ? classe : 'Ver dados no bulário';
}

function renderSugestoes(itens) {
  app.sugestoes = itens || [];
  const caixa = el('sugestoes');
  const campo = el('nome');
  if (!caixa) return;

  if (!app.sugestoes.length) {
    caixa.innerHTML = '<p class="sugestao-vazia">Nenhum remédio encontrado. Tente outro nome.</p>';
  } else {
    caixa.innerHTML = app.sugestoes
      .map(
        (item) => `
          <button class="sugestao" type="button" role="option" data-catalogo="${esc(item.id)}">
            <strong>${esc(item.nome)}</strong>
            <small>${esc(descreverSugestao(item))}</small>
          </button>`,
      )
      .join('');
    caixa.querySelectorAll('[data-catalogo]').forEach((botao) => {
      botao.addEventListener('click', () => {
        const item = app.sugestoes.find((x) => x.id === botao.dataset.catalogo);
        selecionarRemedio(item);
      });
    });
  }

  caixa.hidden = false;
  if (campo) campo.setAttribute('aria-expanded', 'true');
}

async function carregarSugestoes(termo) {
  try {
    const resposta = await buscar(`/api/catalogo?q=${encodeURIComponent(termo)}&limite=8`);
    if (!el('sugestoes')) return;
    renderSugestoes(resposta.itens || []);
  } catch (erro) {
    fecharSugestoes();
  }
}

function agendarSugestoes(termo) {
  clearTimeout(timerSugestoes);
  timerSugestoes = setTimeout(() => carregarSugestoes(termo), 220);
}

function selecionarRemedio(item) {
  if (!item) return;
  app.catalogoItem = item;

  const campoNome = el('nome');
  const campoId = el('catalogoId');
  const dosagem = el('dosagem');
  const instrucao = el('instrucao');
  const resumo = el('resumoCatalogo');

  if (campoNome) campoNome.value = item.nome;
  if (campoId) campoId.value = item.id;
  if (dosagem) dosagem.value = item.dosagem && item.dosagem !== 'Conforme a receita' ? item.dosagem : '';

  const administracao = String(item.administracao || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (instrucao) {
    if (administracao.includes('jejum')) instrucao.value = 'jejum';
    else if (administracao.includes('antes da refeicao') || administracao.includes('antes das refeicoes')) instrucao.value = 'antes_refeicao';
    else if (administracao.includes('com alimento') || administracao.includes('com comida') || administracao.includes('com a refeicao')) instrucao.value = 'com_comida';
    else if (administracao.includes('dormir') || administracao.includes('noite')) instrucao.value = 'antes_dormir';
    else instrucao.value = 'apos_refeicao';
  }

  if (resumo) {
    resumo.innerHTML = `
      <div class="resumo-topo">
        <span aria-hidden="true">✅</span>
        <div>
          <strong>${esc(item.nome)}</strong>
          <small>Dados encontrados no bulário</small>
        </div>
      </div>
      <dl class="resumo-dados">
        <div><dt>Princípio ativo</dt><dd>${esc(item.principioAtivo)}</dd></div>
        <div><dt>Apresentação</dt><dd>${esc(item.apresentacao)}</dd></div>
        <div><dt>Classe</dt><dd>${esc(item.classe)}</dd></div>
      </dl>
      ${
        item.indicacao || item.administracao
          ? `<details class="bula"><summary>Ver orientações da bula</summary>
              ${item.indicacao ? `<p><strong>Indicação.</strong> ${esc(item.indicacao)}</p>` : ''}
              ${item.administracao ? `<p><strong>Como usar.</strong> ${esc(item.administracao)}</p>` : ''}
              ${item.contraindicacoes ? `<p><strong>Cuidados.</strong> ${esc(item.contraindicacoes)}</p>` : ''}
            </details>`
          : ''
      }
      ${item.detalhado ? '' : '<p class="aviso-campo">Este item tem dados básicos no bulário. Confira a dosagem na receita.</p>'}
    `;
    resumo.hidden = false;
  }

  const detalhes = el('detalhesRemedio');
  if (detalhes) detalhes.hidden = false;
  const ajuda = el('ajudaNome');
  if (ajuda) ajuda.textContent = 'Dados preenchidos pelo bulário. Confira a receita antes de salvar.';
  fecharSugestoes();
}

function renderCadastro() {
  app.receita = null;
  app.catalogoItem = null;
  app.sugestoes = [];
  const hoje = diaDeHoje();
  const paciente = app.dados.paciente;

  conteudo.innerHTML = `
    <section class="tela tela-cadastro">
      <header class="tela-cabecalho">
        <h1>Cadastrar remédio</h1>
        <p>Digite o nome. O Dose Dupla preenche os dados do remédio de <strong>${esc(paciente.tratamento || paciente.nome)}</strong> a partir do bulário.</p>
      </header>

      <form class="formulario" id="formMedicamento" novalidate>
        <div class="campo campo-busca">
          <label for="nome">Nome do remédio *</label>
          <input type="text" id="nome" name="nome" placeholder="Ex.: Ibuprofeno" autocomplete="off" aria-autocomplete="list" aria-controls="sugestoes" aria-expanded="false" required>
          <input type="hidden" id="catalogoId" name="catalogoId">
          <div class="sugestoes" id="sugestoes" role="listbox" aria-label="Sugestões de remédios" hidden></div>
          <p class="ajuda" id="ajudaNome">Digite pelo menos 2 letras e toque em uma sugestão.</p>
        </div>

        <div class="resumo-catalogo" id="resumoCatalogo" hidden></div>

        <div id="detalhesRemedio" hidden>
          <div class="linha-campos">
            <div class="campo">
              <label for="dosagem">Dosagem *</label>
              <input type="text" id="dosagem" name="dosagem" placeholder="Ex.: 400 mg" autocomplete="off" required>
              <p class="ajuda">Sugerida pelo bulário. Ajuste conforme a receita.</p>
            </div>
            <div class="campo">
              <label for="instrucao">Como tomar</label>
              <select id="instrucao" name="instrucao">
                <option value="apos_refeicao">Após a refeição</option>
                <option value="com_comida">Junto com a comida</option>
                <option value="antes_refeicao">Antes da refeição</option>
                <option value="jejum">Em jejum</option>
                <option value="antes_dormir">Antes de dormir</option>
              </select>
            </div>
          </div>
        </div>

        <fieldset class="campo">
          <legend>Horários das doses *</legend>
          <p class="ajuda">Marque um ou mais horários em que o remédio deve ser tomado.</p>
          <div class="chips" id="chipsHorarios">
            ${opcoesHorarios(['08:00'])}
          </div>
        </fieldset>

        <div class="linha-campos">
          <div class="campo">
            <label for="inicio">Início do tratamento *</label>
            <input type="date" id="inicio" name="inicio" value="${hoje}" required>
          </div>
          <div class="campo">
            <label for="termino">Término do tratamento *</label>
            <input type="date" id="termino" name="termino" value="${somarDiasISO(30)}" required>
          </div>
        </div>

        <details class="campo campo-extra">
          <summary>Mais opções (opcional)</summary>
          <div class="campo">
            <label for="observacoes">Observações</label>
            <textarea id="observacoes" name="observacoes" placeholder="Ex.: Tomar com bastante água após o almoço."></textarea>
          </div>

          <div class="campo">
            <label for="receita">Foto da receita</label>
            <input type="file" id="receita" name="receita" accept="image/*" capture="environment">
            <div class="preview-receita" id="previewReceita"></div>
            <p class="ajuda">A imagem fica guardada junto ao cadastro do remédio.</p>
          </div>
        </details>

        <p class="erro" id="erroForm" role="alert" hidden></p>

        <div class="acoes-form">
          <button class="btn btn-primario" type="submit" id="btnSalvar">💾 Salvar remédio</button>
          <button class="btn btn-texto" type="button" id="btnLimpar">Limpar formulário</button>
        </div>
      </form>

      <aside class="nota">
        <strong>Dados do bulário.</strong> O nome escolhido preenche princípio ativo, apresentação e orientações. A dosagem e os horários continuam ajustáveis conforme a receita.
      </aside>
    </section>`;

  const form = el('formMedicamento');
  const campoNome = el('nome');

  campoNome.addEventListener('input', () => {
    app.catalogoItem = null;
    const id = el('catalogoId');
    if (id) id.value = '';
    const resumo = el('resumoCatalogo');
    if (resumo) resumo.hidden = true;
    const detalhes = el('detalhesRemedio');
    if (detalhes) detalhes.hidden = true;
    const ajuda = el('ajudaNome');
    if (ajuda) ajuda.textContent = 'Digite pelo menos 2 letras e toque em uma sugestão.';

    const termo = campoNome.value.trim();
    if (termo.length >= 2) agendarSugestoes(termo);
    else {
      clearTimeout(timerSugestoes);
      fecharSugestoes();
    }
  });

  campoNome.addEventListener('focus', () => {
    if (!app.catalogoItem) carregarSugestoes(campoNome.value.trim());
  });

  campoNome.addEventListener('blur', () => {
    setTimeout(fecharSugestoes, 160);
  });

  campoNome.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') fecharSugestoes();
  });

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    enviarCadastro();
  });

  const campoReceita = el('receita');
  campoReceita.addEventListener('change', async () => {
    const arquivo = campoReceita.files && campoReceita.files[0];
    const preview = el('previewReceita');
    if (!arquivo) {
      app.receita = null;
      preview.innerHTML = '';
      return;
    }
    if (!arquivo.type.startsWith('image/')) {
      mostrarAviso('Escolha um arquivo de imagem.', 'erro');
      campoReceita.value = '';
      return;
    }
    try {
      app.receita = await prepararImagem(arquivo);
      preview.innerHTML = `<img src="${app.receita}" alt="Prévia da receita anexada"><small>Receita anexada. Você pode trocar a foto antes de salvar.</small>`;
    } catch (erro) {
      mostrarAviso('Não foi possível ler a imagem.', 'erro');
    }
  });

  el('btnLimpar').addEventListener('click', () => {
    form.reset();
    app.receita = null;
    app.catalogoItem = null;
    app.sugestoes = [];
    clearTimeout(timerSugestoes);
    fecharSugestoes();
    el('previewReceita').innerHTML = '';
    el('erroForm').hidden = true;
    el('resumoCatalogo').hidden = true;
    el('resumoCatalogo').innerHTML = '';
    el('detalhesRemedio').hidden = true;
    el('ajudaNome').textContent = 'Digite pelo menos 2 letras e toque em uma sugestão.';
    el('inicio').value = hoje;
    el('termino').value = somarDiasISO(30);
    mostrarAviso('Formulário limpo.', 'info');
  });
}

async function prepararImagem(arquivo) {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  const contexto = canvas.getContext('2d');
  contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.72);
}

function lerFormulario() {
  const form = el('formMedicamento');
  const dados = new FormData(form);
  return {
    catalogoId: String(dados.get('catalogoId') || ''),
    nome: String(dados.get('nome') || '').trim(),
    dosagem: String(dados.get('dosagem') || '').trim(),
    instrucao: String(dados.get('instrucao') || 'apos_refeicao'),
    horarios: dados.getAll('horarios').map(String),
    inicio: String(dados.get('inicio') || ''),
    termino: String(dados.get('termino') || ''),
    observacoes: String(dados.get('observacoes') || '').trim(),
    receita: app.receita,
  };
}

function mostrarErroForm(mensagem) {
  const caixa = el('erroForm');
  if (!caixa) return;
  caixa.textContent = mensagem;
  caixa.hidden = !mensagem;
  if (mensagem) caixa.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function enviarCadastro(confirmado = false, dadosBase = null) {
  if (app.enviando) return;
  const dados = dadosBase || lerFormulario();

  if (!confirmado) {
    if (!dados.catalogoId) return mostrarErroForm('Escolha um remédio da lista do bulário.');
    if (!dados.dosagem) return mostrarErroForm('Informe a dosagem (ex.: 50 mg).');
    if (!dados.horarios.length) return mostrarErroForm('Marque pelo menos um horário para a dose.');
    if (!dados.inicio || !dados.termino) return mostrarErroForm('Informe as datas de início e término.');
    if (dados.termino < dados.inicio) return mostrarErroForm('A data de término precisa ser depois da data de início.');
    mostrarErroForm('');
  }

  app.enviando = true;
  const botaoEnviar = el('btnSalvar');
  if (botaoEnviar) {
    botaoEnviar.disabled = true;
    botaoEnviar.textContent = 'Verificando…';
  }

  try {
    const resposta = await enviar('/api/medicamentos', {
      ...dados,
      confirmadoMedico: confirmado,
      justificativa: confirmado ? 'Confirmado na tela de alerta crítico.' : undefined,
    });

    app.receita = null;
    app.pendente = null;
    fecharOverlay();
    mostrarAviso(
      resposta.alertaRegistrado
        ? 'Remédio cadastrado. O alerta de interação foi registrado na ficha médica.'
        : 'Remédio cadastrado com sucesso.',
      'sucesso',
    );
    app.dados = resposta.estado;
    atualizarCabecalho();
    irPara('rotina');
  } catch (erro) {
    if (erro.status === 401) {
      fecharOverlay();
      await carregar({ silencioso: true });
      return;
    }
    if (erro.status === 409) {
      app.pendente = erro.corpo.dados || dados;
      abrirInteracao(erro.corpo.interacoes || [], app.pendente);
    } else {
      if (app.overlay === 'overlay-interacao') fecharOverlay();
      mostrarErroForm(erro.message);
      mostrarAviso(erro.message, 'erro');
    }
  } finally {
    app.enviando = false;
    if (botaoEnviar) {
      botaoEnviar.disabled = false;
      botaoEnviar.textContent = '💾 Salvar remédio';
    }
  }
}

/* ------------------------------------------------------------------ */
/* Tela 4 - Alerta de interação                                        */
/* ------------------------------------------------------------------ */

function abrirInteracao(interacoes, dados) {
  const nome = esc(dados.nome || 'Novo remédio');
  const itens = interacoes
    .map(
      (item) => `
        <div class="item-interacao">
          <div class="item-interacao-topo">
            <strong>${esc(item.titulo)}</strong>
            <span class="${item.gravidade === 'alta' ? 'etiqueta-grave' : 'etiqueta-moderada'}">
              ${item.gravidade === 'alta' ? 'Risco alto' : 'Atenção'}
            </span>
          </div>
          <p class="aviso-parceiro">Interage com: <strong>${esc(item.medicamentoExistente.nome)} ${esc(item.medicamentoExistente.dosagem)}</strong></p>
          <p>${esc(item.risco)}</p>
          <p>${esc(item.orientacao)}</p>
        </div>`,
    )
    .join('');

  abrirOverlay(
    `
    <div class="aviso-interacao" role="dialog" aria-modal="true" aria-labelledby="tituloInteracao">
      <div class="aviso-topo">
        <div class="icone" aria-hidden="true">⚠️</div>
        <h2 id="tituloInteracao">Atenção: risco de interação</h2>
        <p>${nome} pode fazer mal junto com um remédio que já está em uso.</p>
      </div>
      <div class="aviso-corpo">
        <p class="aviso-intro">Por segurança, o cadastro está bloqueado até você confirmar que o médico está ciente.</p>
        ${itens}
        <label class="confirmacao" for="ciente">
          <input type="checkbox" id="ciente">
          <span>O médico está ciente e autorizou usar estes remédios juntos.</span>
        </label>
        <div class="aviso-acoes">
          <button class="btn btn-secundario" type="button" data-acao="cancelar-interacao">Cancelar cadastro</button>
          <button class="btn btn-perigo" type="button" data-acao="salvar-interacao" id="btnSalvarInteracao" disabled>Salvar mesmo assim</button>
        </div>
      </div>
    </div>`,
    'overlay-interacao',
  );

  const caixa = el('ciente');
  caixa.addEventListener('change', () => {
    const botao = el('btnSalvarInteracao');
    if (botao) botao.disabled = !caixa.checked;
  });
}

/* ------------------------------------------------------------------ */
/* Tela 5 - Ficha médica                                               */
/* ------------------------------------------------------------------ */

async function renderFicha() {
  if (!app.dados) {
    conteudo.innerHTML = '<div class="carregando"><span class="bolinha"></span><p>Carregando a ficha médica…</p></div>';
    return;
  }

  conteudo.innerHTML = '<div class="carregando"><span class="bolinha"></span><p>Montando a ficha médica…</p></div>';

  let ficha;
  try {
    ficha = await buscar('/api/ficha');
    app.ficha = ficha;
  } catch (erro) {
    if (erro.status === 401) {
      await carregar({ silencioso: true });
      return;
    }
    conteudo.innerHTML = `<div class="tela"><div class="alerta-faixa"><span aria-hidden="true">⚠️</span><div><strong>Não foi possível carregar a ficha.</strong>${esc(erro.message)}</div></div></div>`;
    return;
  }

  if (app.tela !== 'ficha' || !app.autenticado) return;

  const paciente = ficha.paciente;
  const dash = (ficha.adesao / 100) * CICLO_DONUT;
  const semRemedios = ficha.totais.totalMedicamentos === 0;

  const stats = `
    <div class="grade-stats">
      <div class="stat stat--tomadas"><strong>${ficha.totais.tomadas}</strong><small>Doses tomadas</small></div>
      <div class="stat stat--atrasadas"><strong>${ficha.totais.atrasadas}</strong><small>Tomadas com atraso</small></div>
      <div class="stat stat--perdidas"><strong>${ficha.totais.perdidas}</strong><small>Doses perdidas</small></div>
      <div class="stat stat--alertas"><strong>${ficha.totais.alertas}</strong><small>Alertas de interação</small></div>
    </div>`;

  const porMedicamento = ficha.medicamentos.length
    ? ficha.medicamentos
        .map((med) => {
          const classe = med.adesao >= 85 ? 'alta' : med.adesao >= 60 ? 'media' : 'baixa';
          return `
            <div>
              <div class="adesao-item-topo">
                <strong>${esc(med.nome)} ${esc(med.dosagem)}</strong>
                <span>${med.adesao}%</span>
              </div>
              <div class="mini-barra"><span class="${classe}" style="width:${Math.max(2, med.adesao)}%"></span></div>
              <p class="ajuda">${med.tomadas} de ${med.devidas} doses · ${med.perdidas} perdida(s)</p>
            </div>`;
        })
        .join('')
    : '<p class="vazio">Nenhum medicamento cadastrado.</p>';

  const semana = ficha.ultimosDias
    .map((dia) => {
      const pct = dia.devidas ? Math.round((dia.tomadas / dia.devidas) * 100) : 0;
      const data = new Date(`${dia.dia}T12:00:00`);
      const rotulo = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(data).replace('.', '');
      return `
        <div class="dia-barra" title="${formatarDataCurta(dia.dia)}: ${dia.tomadas} de ${dia.devidas} doses">
          <div class="coluna"><span style="height:${Math.max(4, pct)}%"></span></div>
          <small>${esc(rotulo)}</small>
        </div>`;
    })
    .join('');

  const perdidas = ficha.perdidas.length
    ? ficha.perdidas
        .slice(0, 12)
        .map(
          (perda) => `
            <div class="dose-item">
              <span class="dose-data">${formatarDataCurta(perda.data)} ${esc(perda.horario)}</span>
              <span class="dose-nome">${esc(perda.medicamento)} · ${esc(perda.dosagem)}</span>
              <span class="selo selo--perdido">Perdida</span>
            </div>`,
        )
        .join('')
    : '<p class="vazio">Nenhuma dose perdida no período. Excelente adesão!</p>';

  const alertas = ficha.alertas.length
    ? ficha.alertas
        .map(
          (alerta) => `
            <div class="dose-item">
              <span class="dose-data">${formatarDataCurta(alerta.quando.slice(0, 10))}</span>
              <span class="dose-nome">${esc(alerta.medicamento || 'Alerta de interação')}</span>
              <span class="selo selo--adiado">Confirmado</span>
            </div>`,
        )
        .join('')
    : '<p class="vazio">Nenhum alerta de interação registrado.</p>';

  const vazio = semRemedios
    ? `
      <article class="vazio-card">
        <span class="vazio-icone" aria-hidden="true">📄</span>
        <h2>A ficha ainda está vazia</h2>
        <p>Cadastre um remédio para começar o histórico de adesão e gerar o PDF.</p>
        <button class="btn btn-primario" type="button" data-ir="cadastro">Cadastrar remédio</button>
      </article>`
    : '';

  const paineis = semRemedios
    ? ''
    : `
      <div class="duas-colunas">
        <div class="painel">
          <h2><span aria-hidden="true">💊</span> Adesão por medicamento</h2>
          <div class="adesao-lista">${porMedicamento}</div>
        </div>
        <div class="painel">
          <h2><span aria-hidden="true">📅</span> Últimos 7 dias</h2>
          <div class="semana">${semana}</div>
        </div>
      </div>

      <div class="duas-colunas">
        <div class="painel">
          <h2><span aria-hidden="true">❌</span> Doses perdidas</h2>
          <div class="lista-doses">${perdidas}</div>
        </div>
        <div class="painel">
          <h2><span aria-hidden="true">⚠️</span> Alertas de interação</h2>
          <div class="lista-doses">${alertas}</div>
        </div>
      </div>`;

  conteudo.innerHTML = `
    <section class="tela tela-ficha">
      <header class="tela-cabecalho">
        <h1>Ficha médica de ${esc(paciente.tratamento || paciente.nome)}</h1>
        <p>Resumo dos últimos ${ficha.periodo.dias} dias (${formatarDataCurta(ficha.periodo.de)} a ${formatarDataCurta(ficha.periodo.ate)}). Pronta para levar à consulta.</p>
      </header>

      <div class="ficha-topo">
        <div class="cartao-adesao">
          <svg class="donut" viewBox="0 0 180 180" role="img" aria-label="Adesão de ${ficha.adesao} por cento">
            <circle class="donut-fundo" cx="90" cy="90" r="70"></circle>
            <circle class="donut-valor" cx="90" cy="90" r="70" style="stroke-dasharray:${dash.toFixed(1)} ${CICLO_DONUT.toFixed(1)}"></circle>
            <text x="90" y="101" text-anchor="middle">${ficha.adesao}%</text>
          </svg>
          <div>
            <h2>Adesão ao tratamento</h2>
            <p>${ficha.totais.tomadas} doses tomadas de ${ficha.totais.devidas} previstas.</p>
            <p><strong>${semRemedios ? 'Sem dados ainda' : ficha.adesao >= 85 ? 'Muito bom!' : ficha.adesao >= 60 ? 'Pode melhorar' : 'Atenção necessária'}</strong></p>
          </div>
        </div>
        ${stats}
      </div>

      ${vazio}
      ${paineis}

      <div class="acoes-ficha">
        <button class="btn btn-primario" type="button" data-acao="baixar-pdf">📄 Gerar PDF da ficha</button>
        <button class="btn btn-secundario" type="button" data-acao="compartilhar">📤 Compartilhar com o médico</button>
      </div>

      <aside class="nota">
        Esta ficha reúne o histórico registrado no aplicativo. Ela não substitui a avaliação médica.
      </aside>
    </section>`;

  const compartilhar = conteudo.querySelector('[data-acao="compartilhar"]');
  if (compartilhar) compartilhar.addEventListener('click', compartilharFicha);
  const baixar = conteudo.querySelector('[data-acao="baixar-pdf"]');
  if (baixar) baixar.addEventListener('click', baixarFichaPdf);
  const irCadastro = conteudo.querySelector('[data-ir="cadastro"]');
  if (irCadastro) irCadastro.addEventListener('click', () => irPara('cadastro'));
}

async function baixarFichaPdf() {
  try {
    const blob = await window.DoseDuplaDemo.pdfBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ficha-medica-${diaDeHoje()}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    mostrarAviso('PDF gerado. Anexe o arquivo no WhatsApp ou e-mail do médico.', 'sucesso');
  } catch (erro) {
    mostrarAviso(erro.message || 'Não foi possível gerar o PDF.', 'erro');
  }
}

async function compartilharFicha() {
  try {
    const blob = await window.DoseDuplaDemo.pdfBlob();
    const arquivo = new File([blob], `ficha-medica-${diaDeHoje()}.pdf`, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      await navigator.share({
        files: [arquivo],
        title: 'Ficha médica - Dose Dupla',
        text: 'Ficha médica gerada pelo Dose Dupla para levar à consulta.',
      });
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = arquivo.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    mostrarAviso('PDF baixado. Anexe o arquivo no WhatsApp ou e-mail do médico.', 'info');
  } catch (erro) {
    mostrarAviso(erro.message || 'Não foi possível compartilhar a ficha.', 'erro');
  }
}

/* ------------------------------------------------------------------ */
/* Conta                                                               */
/* ------------------------------------------------------------------ */

function abrirConta() {
  if (!app.autenticado || !app.dados) return;
  const usuario = app.dados.usuario;
  const perfil = perfilDe(usuario.perfil);
  const paciente = app.dados.paciente;

  abrirOverlay(
    `
    <div class="painel-conta painel-sobre" role="dialog" aria-modal="true" aria-labelledby="tituloSobre">
      <div class="conta-avatar-grande" aria-hidden="true">💊</div>
      <h2 id="tituloSobre">Sobre este protótipo</h2>
      <span class="conta-perfil">Demonstração interativa</span>
      <p class="sobre-texto">
        Você está vendo a rotina de <strong>${esc(paciente.nome)}</strong> pelo perfil
        <strong>${esc(perfil.nome)}</strong> (${esc(usuario.nome)}). Todos os dados são de exemplo
        e ficam apenas na memória desta página.
      </p>

      <ul class="sobre-lista">
        <li><span aria-hidden="true">🏠</span><div><strong>Minha Rotina</strong>Doses do dia por turno, com status calculado em tempo real.</div></li>
        <li><span aria-hidden="true">⏰</span><div><strong>Alarme da dose</strong>Confirme a tomada ou peça para lembrar em 10 minutos.</div></li>
        <li><span aria-hidden="true">⚠️</span><div><strong>Alerta de interação</strong>Ao cadastrar um remédio, o app bloqueia combinações de risco.</div></li>
        <li><span aria-hidden="true">📄</span><div><strong>Ficha médica</strong>Adesão dos últimos 30 dias, doses perdidas e PDF para a consulta.</div></li>
      </ul>

      <p class="sobre-nota">Protótipo acadêmico · E3 · Engenharia de Software · Unochapecó</p>

      <div class="conta-acoes">
        <button class="btn btn-secundario" type="button" data-acao="alternar-perfil">
          ${usuario.perfil === 'idoso' ? '👩 Voltar para a visão de Camila (familiar)' : '👵 Ver a rotina como Marlene (idoso)'}
        </button>
        <button class="btn btn-secundario" type="button" data-acao="reiniciar-demo">🔄 Reiniciar demonstração</button>
        <button class="btn btn-texto" type="button" data-acao="fechar-conta">Fechar</button>
      </div>
    </div>`,
    'overlay-conta',
  );
}

function alternarPerfilDemo() {
  const estado = window.DoseDuplaDemo.alternarPerfil();
  app.dados = estado;
  app.ficha = null;
  app.vistos.clear();
  fecharOverlay();
  atualizarCabecalho();
  atualizarAbas();
  irPara('rotina');
  mostrarAviso(
    estado.perfil === 'idoso'
      ? 'Agora você está vendo a rotina como Marlene (idoso).'
      : 'De volta à visão de Camila (familiar).',
    'info',
  );
}

async function reiniciarDemonstracao() {
  window.DoseDuplaDemo.reiniciar();
  app.ficha = null;
  app.vistos.clear();
  fecharOverlay();
  await carregar();
  irPara('rotina');
  atualizarCabecalho();
  mostrarAviso('Demonstração reiniciada com os dados de exemplo.', 'sucesso');
}

/* ------------------------------------------------------------------ */
/* Eventos globais                                                     */
/* ------------------------------------------------------------------ */

camada.addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-acao]');
  if (!botao) return;

  const acao = botao.dataset.acao;
  if (acao === 'confirmar' || acao === 'adiar' || acao === 'fechar') {
    acaoAlarme(acao);
  } else if (acao === 'cancelar-interacao') {
    fecharOverlay();
    mostrarAviso('Cadastro cancelado. Nenhum remédio foi adicionado.', 'info');
  } else if (acao === 'salvar-interacao') {
    if (app.pendente) enviarCadastro(true, app.pendente);
  } else if (acao === 'fechar-conta') {
    fecharOverlay();
  } else if (acao === 'alternar-perfil') {
    alternarPerfilDemo();
  } else if (acao === 'reiniciar-demo') {
    reiniciarDemonstracao();
  }
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && app.overlay) {
    if (app.overlay === 'overlay-interacao') {
      fecharOverlay();
      mostrarAviso('Cadastro cancelado. Nenhum remédio foi adicionado.', 'info');
    } else {
      fecharOverlay();
    }
  }
});

document.querySelectorAll('.aba').forEach((aba) => {
  aba.addEventListener('click', () => irPara(aba.dataset.tela));
});

el('btnConta').addEventListener('click', abrirConta);

window.addEventListener('hashchange', () => {
  const tela = location.hash.slice(1);
  if (!app.autenticado) return;
  if (['rotina', 'cadastro', 'ficha'].includes(tela) && tela !== app.tela) {
    irPara(tela, { semHash: true });
  }
});

/* ------------------------------------------------------------------ */
/* Alarmes automáticos e atualização periódica                         */
/* ------------------------------------------------------------------ */

function verificarAlarmes() {
  if (!app.autenticado || !app.dados || app.overlay || document.hidden || app.tela === 'cadastro') return;

  const agora = new Date();
  const itens = itensDoDia();

  for (const item of itens) {
    if (item.status === 'adiado' && item.adiadoPara && new Date(item.adiadoPara) <= agora) {
      abrirAlarme(item.chave);
      return;
    }
    if (item.status === 'pendente' && !app.vistos.has(item.chave)) {
      const [hora, minuto] = item.horario.split(':').map(Number);
      const previsto = new Date();
      previsto.setHours(hora, minuto, 0, 0);
      const diferenca = agora - previsto;
      if (diferenca >= 0 && diferenca < 60000) {
        app.vistos.add(item.chave);
        abrirAlarme(item.chave);
        return;
      }
    }
  }
}

setInterval(verificarAlarmes, 20000);

setInterval(() => {
  if (!app.autenticado || document.hidden || app.overlay) return;
  if (app.tela !== 'rotina') return;
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#formMedicamento')) return;
  carregar({ silencioso: true });
}, 60000);

setInterval(atualizarRelogio, 15000);

/* ------------------------------------------------------------------ */
/* Inicialização                                                       */
/* ------------------------------------------------------------------ */

async function iniciar() {
  atualizarRelogio();
  atualizarCabecalho();
  atualizarAbas();

  const dados = await carregar({ silencioso: true });

  if (!dados && !app.autenticado) {
    conteudo.innerHTML = `
      <div class="tela">
        <div class="alerta-faixa"><span aria-hidden="true">⚠️</span><div><strong>Demonstração indisponível.</strong>Recarregue a página para tentar novamente.</div></div>
      </div>`;
    return;
  }

  if (app.autenticado) {
    const inicial = location.hash.slice(1);
    irPara(['rotina', 'cadastro', 'ficha'].includes(inicial) ? inicial : 'rotina', { semHash: true, semScroll: true });
    atualizarCabecalho();
  }
}

iniciar();

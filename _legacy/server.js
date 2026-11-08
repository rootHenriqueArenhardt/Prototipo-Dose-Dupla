'use strict';

/**
 * Dose Dupla - protótipo funcional (E3)
 * Servidor HTTP local, sem dependências externas.
 * Escuta exclusivamente em 127.0.0.1 (acesso apenas pela própria máquina).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const db = require('./lib/db');
const catalogo = require('./lib/catalogo');
const { gerarPdfFicha } = require('./lib/pdf');

const PORTA = Number(process.env.PORT) || 3000;
const HOST = '127.0.0.1';
const PUBLICO = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

/* ------------------------------------------------------------------ */
/* Helpers HTTP                                                        */
/* ------------------------------------------------------------------ */

function responderJson(res, codigo, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(texto),
  });
  res.end(texto);
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const pedacos = [];
    req.on('data', (pedaco) => {
      tamanho += pedaco.length;
      if (tamanho > 8 * 1024 * 1024) {
        reject(new Error('Conteúdo enviado é grande demais.'));
        req.destroy();
        return;
      }
      pedacos.push(pedaco);
    });
    req.on('end', () => {
      if (!pedacos.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(pedacos).toString('utf8')));
      } catch (erro) {
        reject(new Error('JSON inválido no corpo da requisição.'));
      }
    });
    req.on('error', reject);
  });
}

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
const dataExiste = (texto) => {
  if (!DATA_VALIDA.test(texto)) return false;
  const d = new Date(`${texto}T12:00:00`);
  return !Number.isNaN(d.getTime());
};

const exigirSessao = (base, res) => {
  const usuario = db.usuarioAtual(base);
  if (!usuario) {
    responderJson(res, 401, { erro: 'sessao', mensagem: 'Nenhum usuário conectado.' });
    return null;
  }
  return usuario;
};

/* ------------------------------------------------------------------ */
/* Validações                                                          */
/* ------------------------------------------------------------------ */

function validarUsuario(corpo, base) {
  const erros = [];
  const nome = String(corpo.nome || '').trim().slice(0, 80);
  const perfil = String(corpo.perfil || '');
  const temIdade = corpo.idade !== undefined && corpo.idade !== null && String(corpo.idade).trim() !== '';
  const idade = temIdade ? Number(corpo.idade) : null;
  const pacienteId = String(corpo.pacienteId || '').trim();

  if (nome.length < 2) erros.push('Informe o seu nome.');
  if (!db.PERFIS_VALIDOS.includes(perfil)) erros.push('Escolha quem é você no aplicativo.');
  if (temIdade && (!Number.isInteger(idade) || idade < 1 || idade > 120)) {
    erros.push('Informe uma idade válida (entre 1 e 120 anos).');
  }

  let paciente = null;
  if (perfil && perfil !== 'idoso') {
    paciente = base.usuarios.find((u) => u.id === pacienteId && u.perfil === 'idoso') || null;
    if (!paciente) {
      const existem = base.usuarios.some((u) => u.perfil === 'idoso');
      erros.push(
        existem
          ? 'Selecione o idoso que você acompanha.'
          : 'Cadastre primeiro a conta do idoso. Depois crie a sua conta e selecione esse idoso.',
      );
    }
  }

  return {
    erros,
    dados: {
      nome,
      perfil,
      idade,
      pacienteId: paciente ? paciente.id : null,
      pacienteNome: paciente ? paciente.nome : nome,
    },
  };
}

function validarMedicamento(corpo) {
  const erros = [];
  const item = catalogo.obter(corpo.catalogoId || corpo.nome);
  const nome = item ? item.nome : String(corpo.nome || '').trim();
  const principioAtivo = item ? item.principioAtivo : '';
  const dosagem = String(corpo.dosagem || '').trim() || (item ? item.dosagem : '');
  const instrucao = String(corpo.instrucao || 'apos_refeicao');
  const inicio = String(corpo.inicio || '').trim();
  const termino = String(corpo.termino || '').trim();
  const horarios = Array.isArray(corpo.horarios)
    ? [...new Set(corpo.horarios.map((h) => String(h).trim()))].filter((h) => db.HORA_VALIDA.test(h)).sort()
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

/* ------------------------------------------------------------------ */
/* Rotas da API                                                        */
/* ------------------------------------------------------------------ */

async function tratarApi(req, res, url) {
  const rota = `${req.method} ${url.pathname}`;
  const base = db.carregar();

  if (rota === 'GET /api/saude') {
    return responderJson(res, 200, { ok: true, servico: 'Dose Dupla', versao: '3.0.0' });
  }

  if (rota === 'GET /api/catalogo') {
    const termo = String(url.searchParams.get('q') || '').trim();
    const limite = Math.min(Math.max(Number(url.searchParams.get('limite')) || 10, 1), 40);
    const id = String(url.searchParams.get('id') || '').trim();
    if (id) {
      const item = catalogo.obter(id);
      return responderJson(res, item ? 200 : 404, item ? { item: catalogo.publico(item) } : { erro: 'nao_encontrado', mensagem: 'Remédio não encontrado.' });
    }
    return responderJson(res, 200, {
      fonte: catalogo.fonte,
      total: catalogo.total,
      itens: catalogo.buscarPublico(termo, limite),
      popular: termo ? [] : catalogo.popular,
    });
  }

  if (rota === 'GET /api/estado') {
    const usuario = db.usuarioAtual(base);
    if (!usuario) {
      return responderJson(res, 200, {
        autenticado: false,
        usuarios: db.listarUsuarios(base),
        idosos: db.listarIdosos(base),
      });
    }
    return responderJson(res, 200, db.montarEstado(base, usuario));
  }

  if (rota === 'GET /api/usuarios') {
    return responderJson(res, 200, {
      usuarios: db.listarUsuarios(base),
      idosos: db.listarIdosos(base),
    });
  }

  if (rota === 'POST /api/usuarios') {
    const corpo = await lerCorpo(req);
    const { erros, dados } = validarUsuario(corpo, base);
    if (erros.length) {
      return responderJson(res, 400, { erro: 'validacao', mensagem: erros[0], campos: erros });
    }
    const usuario = db.criarUsuario(base, dados);
    return responderJson(res, 201, {
      mensagem: `Bem-vindo(a), ${db.primeiroNome(usuario.nome)}!`,
      estado: db.montarEstado(base, usuario),
    });
  }

  if (rota === 'POST /api/sessao') {
    const corpo = await lerCorpo(req);
    const usuario = db.autenticar(base, String(corpo.usuarioId || ''));
    if (!usuario) {
      return responderJson(res, 404, { erro: 'nao_encontrado', mensagem: 'Usuário não encontrado.' });
    }
    return responderJson(res, 200, { mensagem: `Olá, ${db.primeiroNome(usuario.nome)}!`, estado: db.montarEstado(base, usuario) });
  }

  if (rota === 'POST /api/sessao/sair') {
    db.sair(base);
    return responderJson(res, 200, {
      mensagem: 'Sessão encerrada.',
      usuarios: db.listarUsuarios(base),
      idosos: db.listarIdosos(base),
    });
  }

  if (rota === 'GET /api/ficha') {
    const usuario = exigirSessao(base, res);
    if (!usuario) return;
    return responderJson(res, 200, db.montarFicha(base, usuario, 30));
  }

  if (rota === 'GET /api/ficha/pdf') {
    const usuario = exigirSessao(base, res);
    if (!usuario) return;
    const ficha = db.montarFicha(base, usuario, 30);
    const arquivo = gerarPdfFicha(ficha);
    const slug = String(ficha.paciente.nome || 'paciente')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ficha-medica-${slug}.pdf"`,
      'Content-Length': arquivo.length,
      'Cache-Control': 'no-store',
    });
    return res.end(arquivo);
  }

  if (rota === 'GET /api/medicamentos') {
    const usuario = exigirSessao(base, res);
    if (!usuario) return;
    const paciente = db.usuarioPaciente(base, usuario);
    return responderJson(res, 200, { medicamentos: paciente.medicamentos });
  }

  if (rota === 'POST /api/medicamentos') {
    const usuario = exigirSessao(base, res);
    if (!usuario) return;
    const paciente = db.usuarioPaciente(base, usuario);

    const corpo = await lerCorpo(req);
    const { erros, dados } = validarMedicamento(corpo);
    if (erros.length) {
      return responderJson(res, 400, { erro: 'validacao', mensagem: erros[0], campos: erros });
    }

    const interacoes = db.verificarInteracoes(dados, paciente.medicamentos);
    if (interacoes.length && corpo.confirmadoMedico !== true) {
      return responderJson(res, 409, {
        erro: 'interacao',
        mensagem: 'Este remédio pode interagir com outro que já está em uso.',
        interacoes,
        dados,
      });
    }

    const med = db.adicionarMedicamento(base, usuario, dados);

    if (interacoes.length) {
      db.registrarAlerta(paciente, {
        tipo: 'interacao_confirmada',
        medicamento: `${med.nome} (${med.dosagem})`,
        interacoes,
        perfil: usuario.perfil,
        registradoPor: usuario.nome,
        observacao: String(corpo.justificativa || 'Confirmado que o médico está ciente.'),
      });
    }

    db.salvar(base);

    return responderJson(res, 201, {
      mensagem: 'Remédio cadastrado com sucesso.',
      medicamento: med,
      alertaRegistrado: interacoes.length > 0,
      interacoes,
      estado: db.montarEstado(base, usuario),
    });
  }

  if (rota === 'POST /api/doses') {
    const usuario = exigirSessao(base, res);
    if (!usuario) return;

    const corpo = await lerCorpo(req);
    const medicamentoId = String(corpo.medicamentoId || '');
    const data = String(corpo.data || '');
    const horario = String(corpo.horario || '');
    const acao = String(corpo.acao || 'tomar');

    if (!medicamentoId || !dataExiste(data) || !db.HORA_VALIDA.test(horario)) {
      return responderJson(res, 400, { erro: 'validacao', mensagem: 'Dados da dose inválidos.' });
    }
    if (!['tomar', 'adiar'].includes(acao)) {
      return responderJson(res, 400, { erro: 'validacao', mensagem: 'Ação inválida.' });
    }

    const registro = db.registrarDose(base, usuario, {
      medicamentoId,
      data,
      horario,
      acao,
      minutos: corpo.minutos,
    });

    if (!registro) {
      return responderJson(res, 404, { erro: 'nao_encontrado', mensagem: 'Medicamento não encontrado.' });
    }

    db.salvar(base);

    return responderJson(res, 200, {
      mensagem: acao === 'adiar' ? 'Lembrete adiado.' : 'Dose registrada.',
      registro,
      estado: db.montarEstado(base, usuario),
    });
  }

  return responderJson(res, 404, { erro: 'nao_encontrado', mensagem: 'Rota não encontrada.' });
}

/* ------------------------------------------------------------------ */
/* Arquivos estáticos                                                  */
/* ------------------------------------------------------------------ */

function servirEstatico(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return responderJson(res, 405, { erro: 'metodo', mensagem: 'Método não permitido.' });
  }

  let caminhoRelativo;
  try {
    caminhoRelativo = decodeURIComponent(url.pathname);
  } catch (erro) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Caminho inválido.');
  }
  if (caminhoRelativo === '/') caminhoRelativo = '/index.html';

  const arquivo = path.join(PUBLICO, path.normalize(caminhoRelativo).replace(/^(\.\.[/\\])+/, ''));

  if (!arquivo.startsWith(PUBLICO)) {
    return responderJson(res, 403, { erro: 'proibido', mensagem: 'Acesso negado.' });
  }

  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) {
      if (!path.extname(caminhoRelativo)) {
        return fs.readFile(path.join(PUBLICO, 'index.html'), (erro2, html) => {
          if (erro2) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('Arquivo não encontrado.');
          }
          res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
          return res.end(html);
        });
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Arquivo não encontrado.');
    }

    const extensao = path.extname(arquivo).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[extensao] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': conteudo.length,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : conteudo);
  });
}

/* ------------------------------------------------------------------ */
/* Servidor                                                            */
/* ------------------------------------------------------------------ */

const servidor = http.createServer((req, res) => {
  const inicio = Date.now();
  try {
    const url = new URL(req.url, `http://${req.headers.host || HOST}`);

    res.on('finish', () => {
      if (url.pathname.startsWith('/api/')) {
        console.log(`${req.method} ${url.pathname} -> ${res.statusCode} (${Date.now() - inicio}ms)`);
      }
    });

    if (url.pathname.startsWith('/api/')) {
      tratarApi(req, res, url).catch((erro) => {
        console.error('Erro na API:', erro);
        if (!res.headersSent) responderJson(res, 500, { erro: 'interno', mensagem: 'Erro interno do servidor.' });
        else res.end();
      });
      return;
    }

    servirEstatico(req, res, url);
  } catch (erro) {
    console.error('Erro na requisição:', erro);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Erro interno do servidor.');
    } else {
      res.end();
    }
  }
});

servidor.on('error', (erro) => {
  if (erro.code === 'EADDRINUSE') {
    console.error(`\n  A porta ${PORTA} já está em uso. Encerre o outro processo e tente novamente.\n`);
  } else {
    console.error(erro);
  }
  process.exit(1);
});

db.carregar();

servidor.listen(PORTA, HOST, () => {
  console.log('');
  console.log('  Dose Dupla - protótipo funcional (E3)');
  console.log(`  Rodando em: http://localhost:${PORTA}`);
  console.log(`  Escuta apenas em ${HOST} (sem acesso externo/rede).`);
  console.log('  Para encerrar: Ctrl+C');
  console.log('');
});

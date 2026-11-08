'use strict';

/**
 * Catálogo de medicamentos gerado a partir da amostra do Bulário enviada.
 * O arquivo catalogo-medicamentos.json é estático: não há consulta externa.
 */

const base = require('./catalogo-medicamentos.json');

const PADROES = {
  classe: 'Consulte a bula',
  apresentacao: 'Conforme a receita',
  dosagem: 'Conforme a receita',
  indicacao: 'Uso conforme a prescrição médica. Consulte a bula ou o farmacêutico.',
  administracao: 'Siga a orientação do médico ou farmacêutico.',
  posologia: 'Siga a prescrição médica.',
  contraindicacoes: 'Consulte a bula ou o farmacêutico antes de usar.',
  riscoGravidez: 'Consulte o médico antes de usar na gravidez.',
  lactacao: 'Consulte o médico antes de usar durante a amamentação.',
  reacoesAdversas: 'Consulte a bula ou o farmacêutico se sentir algum efeito.',
  interacoes: 'Informe ao médico ou farmacêutico todos os remédios que você usa.',
  armazenamento: 'Conserve conforme a embalagem, longe do calor e da umidade.',
  mecanismo: '',
  detalhado: false,
};

const normalizar = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const completar = (item) => {
  const completo = { ...PADROES, ...item };
  completo.aliases = Array.isArray(item.aliases) ? item.aliases : [];
  completo.nomeComercial = Array.isArray(item.nomeComercial) ? item.nomeComercial : [];
  completo._nome = normalizar(item.nome);
  completo._principio = normalizar(item.principioAtivo || item.nome);
  completo._aliases = completo.aliases.map(normalizar).filter(Boolean);
  return completo;
};

const itens = base.itens.map(completar);
const porId = new Map(itens.map((item) => [item.id, item]));
const porNome = new Map();
for (const item of itens) {
  porNome.set(item._nome, item);
  if (!porNome.has(normalizar(item.principioAtivo))) porNome.set(normalizar(item.principioAtivo), item);
}

const POPULARES = (base.popular || [])
  .map((id) => porId.get(id))
  .filter(Boolean);

function pontuar(item, consulta) {
  if (!consulta) return 0;
  if (item._nome === consulta) return 0;
  if (item._nome.startsWith(consulta)) return 1;
  if (item._aliases.some((a) => a.startsWith(consulta))) return 2;
  if (item._principio.startsWith(consulta)) return 3;
  if (item._nome.includes(consulta)) return 4;
  if (item._principio.includes(consulta)) return 5;
  if (item._aliases.some((a) => a.includes(consulta))) return 6;
  return 99;
}

function buscar(termo, limite = 12) {
  const consulta = normalizar(termo);
  const max = Math.min(Math.max(Number(limite) || 12, 1), 40);

  if (!consulta) {
    return POPULARES.slice(0, max);
  }

  const achados = [];
  for (const item of itens) {
    const nota = pontuar(item, consulta);
    if (nota < 99) achados.push({ item, nota });
  }

  achados.sort((a, b) => a.nota - b.nota || a.item._nome.localeCompare(b.item._nome, 'pt-BR'));
  return achados.slice(0, max).map((x) => x.item);
}

function obter(chave) {
  const texto = String(chave || '').trim();
  if (!texto) return null;
  if (porId.has(texto)) return porId.get(texto);
  const consulta = normalizar(texto);
  return porNome.get(consulta) || buscar(consulta, 1)[0] || null;
}

function publico(item) {
  if (!item) return null;
  const { _nome, _principio, _aliases, ...resto } = item;
  return resto;
}

function buscarPublico(termo, limite) {
  return buscar(termo, limite).map(publico);
}

module.exports = {
  fonte: base.fonte,
  total: itens.length,
  popular: POPULARES.map(publico),
  buscar,
  buscarPublico,
  obter,
  publico,
  normalizar,
  PADROES,
};

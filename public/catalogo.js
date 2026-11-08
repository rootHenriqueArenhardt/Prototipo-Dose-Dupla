'use strict';

/**
 * Catálogo de medicamentos do protótipo.
 * O JSON é estático e carregado sob demanda, sem servidor de API.
 */
window.DoseDuplaCatalogo = (function () {
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

  let dados = null;
  let carregando = null;
  let itens = [];
  let porId = new Map();
  let porNome = new Map();
  let populares = [];

  const completar = (item) => {
    const completo = { ...PADROES, ...item };
    completo.aliases = Array.isArray(item.aliases) ? item.aliases : [];
    completo.nomeComercial = Array.isArray(item.nomeComercial) ? item.nomeComercial : [];
    completo._nome = normalizar(item.nome);
    completo._principio = normalizar(item.principioAtivo || item.nome);
    completo._aliases = completo.aliases.map(normalizar).filter(Boolean);
    return completo;
  };

  async function garantir() {
    if (dados) return dados;
    if (!carregando) {
      carregando = fetch('/catalogo-medicamentos.json', { cache: 'force-cache' })
        .then((resposta) => {
          if (!resposta.ok) throw new Error('Não foi possível carregar o catálogo.');
          return resposta.json();
        })
        .then((lido) => {
          dados = lido;
          itens = (lido.itens || []).map(completar);
          porId = new Map(itens.map((item) => [item.id, item]));
          porNome = new Map();
          for (const item of itens) {
            porNome.set(item._nome, item);
            if (!porNome.has(normalizar(item.principioAtivo))) porNome.set(normalizar(item.principioAtivo), item);
          }
          populares = (lido.popular || []).map((id) => porId.get(id)).filter(Boolean);
          return lido;
        })
        .catch((erro) => {
          carregando = null;
          throw erro;
        });
    }
    return carregando;
  }

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

  function publico(item) {
    if (!item) return null;
    const { _nome, _principio, _aliases, ...resto } = item;
    return resto;
  }

  function buscarNaBase(termo, limite) {
    const consulta = normalizar(termo);
    const max = Math.min(Math.max(Number(limite) || 12, 1), 40);
    if (!consulta) return populares.slice(0, max);

    const achados = [];
    for (const item of itens) {
      const nota = pontuar(item, consulta);
      if (nota < 99) achados.push({ item, nota });
    }
    achados.sort((a, b) => a.nota - b.nota || a.item._nome.localeCompare(b.item._nome, 'pt-BR'));
    return achados.slice(0, max).map((x) => x.item);
  }

  async function buscar(termo, limite) {
    await garantir();
    return buscarNaBase(termo, limite).map(publico);
  }

  async function obter(chave) {
    await garantir();
    const texto = String(chave || '').trim();
    if (!texto) return null;
    if (porId.has(texto)) return porId.get(texto);
    const consulta = normalizar(texto);
    return porNome.get(consulta) || buscarNaBase(consulta, 1)[0] || null;
  }

  async function popularesPublicos() {
    await garantir();
    return populares.map(publico);
  }

  async function info() {
    await garantir();
    return { fonte: dados.fonte, total: itens.length };
  }

  return { buscar, obter, publico, populares: popularesPublicos, info };
})();

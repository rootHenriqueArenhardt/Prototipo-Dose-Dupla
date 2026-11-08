'use strict';

/**
 * Gerador de PDF minimo (PDF 1.4) usando apenas os recursos nativos do Node.
 * Fontes base: Helvetica / Helvetica-Bold com codificacao WinAnsi.
 */

const LARGURA = 595.28;
const ALTURA = 841.89;
const MARGEM = 50;
const LARGURA_UTIL = LARGURA - MARGEM * 2;

const sanitizar = (texto) =>
  String(texto === undefined || texto === null ? '' : texto)
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, '');

const escapar = (texto) => sanitizar(texto).replace(/[\\()]/g, (c) => `\\${c}`);

/** Estimativa de largura (Helvetica ~0.52em por caractere). */
const larguraTexto = (texto, tamanho) => sanitizar(texto).length * tamanho * 0.52;

const quebrar = (texto, tamanho, larguraMax) => {
  const palavras = sanitizar(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (larguraTexto(tentativa, tamanho) > larguraMax && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
};

class Documento {
  constructor() {
    this.paginas = [];
    this.pagina = null;
    this.novaPagina();
  }

  novaPagina() {
    this.pagina = { ops: [], y: ALTURA - MARGEM };
    this.paginas.push(this.pagina);
  }

  garantir(altura) {
    if (this.pagina.y - altura < MARGEM + 10) this.novaPagina();
  }

  texto(texto, opcoes = {}) {
    const {
      tamanho = 11,
      negrito = false,
      cor = [0.1, 0.13, 0.2],
      espacoAntes = 0,
      espacoDepois = 4,
      alinhamento = 'left',
      entrelinha = 1.42,
    } = opcoes;

    const familia = negrito ? 'F2' : 'F1';
    const linhas = quebrar(texto, tamanho, LARGURA_UTIL);

    for (const linha of linhas) {
      const alturaLinha = tamanho * entrelinha;
      this.garantir(alturaLinha + espacoAntes);
      this.pagina.y -= espacoAntes;
      this.pagina.y -= alturaLinha;

      let x = MARGEM;
      const larguraLinha = larguraTexto(linha, tamanho);
      if (alinhamento === 'center') x = (LARGURA - larguraLinha) / 2;
      if (alinhamento === 'right') x = LARGURA - MARGEM - larguraLinha;

      this.pagina.ops.push(
        `BT /${familia} ${tamanho} Tf ${cor[0]} ${cor[1]} ${cor[2]} rg 1 0 0 1 ${x.toFixed(2)} ${this.pagina.y.toFixed(2)} Tm (${escapar(linha)}) Tj ET`,
      );
    }

    this.pagina.y -= espacoDepois;
  }

  regua(opcoes = {}) {
    const { espacoAntes = 6, espacoDepois = 10, cor = [0.82, 0.86, 0.92] } = opcoes;
    this.garantir(espacoAntes + espacoDepois + 2);
    this.pagina.y -= espacoAntes;
    this.pagina.ops.push(
      `${cor[0]} ${cor[1]} ${cor[2]} RG 0.8 w ${MARGEM} ${this.pagina.y.toFixed(2)} m ${(LARGURA - MARGEM).toFixed(2)} ${this.pagina.y.toFixed(2)} l S`,
    );
    this.pagina.y -= espacoDepois;
  }

  caixa(texto, opcoes = {}) {
    const { fundo = [0.95, 0.97, 1], borda = [0.75, 0.82, 0.93], tamanho = 10.5, cor = [0.1, 0.13, 0.2] } = opcoes;
    const linhas = quebrar(texto, tamanho, LARGURA_UTIL - 24);
    const altura = linhas.length * tamanho * 1.45 + 20;
    this.garantir(altura + 8);

    const yTopo = this.pagina.y - 6;
    const yBase = yTopo - altura;
    this.pagina.ops.push(
      `${fundo[0]} ${fundo[1]} ${fundo[2]} rg ${borda[0]} ${borda[1]} ${borda[2]} RG 0.7 w ${MARGEM} ${yBase.toFixed(2)} ${LARGURA_UTIL.toFixed(2)} ${altura.toFixed(2)} re B`,
    );

    let y = yTopo - 14;
    for (const linha of linhas) {
      this.pagina.ops.push(
        `BT /F1 ${tamanho} Tf ${cor[0]} ${cor[1]} ${cor[2]} rg 1 0 0 1 ${(MARGEM + 12).toFixed(2)} ${y.toFixed(2)} Tm (${escapar(linha)}) Tj ET`,
      );
      y -= tamanho * 1.45;
    }
    this.pagina.y = yBase - 8;
  }

  espaco(altura = 8) {
    this.pagina.y -= altura;
  }

  rodape(texto) {
    for (const pagina of this.paginas) {
      pagina.ops.push(
        `0.45 0.5 0.58 rg 0.5 w ${MARGEM} ${MARGEM - 8} m ${(LARGURA - MARGEM).toFixed(2)} ${MARGEM - 8} l S`,
      );
      pagina.ops.push(
        `BT /F1 8 Tf 0.45 0.5 0.58 rg 1 0 0 1 ${MARGEM} ${MARGEM - 22} Tm (${escapar(texto)}) Tj ET`,
      );
    }
  }

  serializar() {
    const total = this.paginas.length;
    const ids = [];
    let proximo = 5;
    for (let i = 0; i < total; i += 1) {
      ids.push({ pagina: proximo, conteudo: proximo + 1 });
      proximo += 2;
    }

    const objetos = [];
    objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objetos[2] = `<< /Type /Pages /Kids [${ids.map((i) => `${i.pagina} 0 R`).join(' ')}] /Count ${total} >>`;
    objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objetos[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    this.paginas.forEach((pagina, indice) => {
      const conteudo = pagina.ops.join('\n');
      const byteLength = Buffer.byteLength(conteudo, 'latin1');
      objetos[ids[indice].pagina] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGURA} ${ALTURA}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${ids[indice].conteudo} 0 R >>`;
      objetos[ids[indice].conteudo] = `<< /Length ${byteLength} >>\nstream\n${conteudo}\nendstream`;
    });

    let saida = '%PDF-1.4\n';
    const offsets = [];
    for (let i = 1; i < objetos.length; i += 1) {
      offsets[i] = Buffer.byteLength(saida, 'latin1');
      saida += `${i} 0 obj\n${objetos[i]}\nendobj\n`;
    }

    const inicioXref = Buffer.byteLength(saida, 'latin1');
    saida += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objetos.length; i += 1) {
      saida += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    saida += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

    return Buffer.from(saida, 'latin1');
  }
}

const formatarData = (iso) => {
  if (!iso) return '-';
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const data = somenteData ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleDateString('pt-BR');
};

const formatarDataHora = (iso) => {
  if (!iso) return '-';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return `${data.toLocaleDateString('pt-BR')} as ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

function gerarPdfFicha(ficha) {
  const doc = new Documento();
  const paciente = ficha.paciente || {};

  doc.texto('Ficha Médica', { tamanho: 24, negrito: true, cor: [0.1, 0.35, 0.72], espacoDepois: 2 });
  doc.texto('Dose Dupla - Gestão de Medicamentos', { tamanho: 10.5, cor: [0.42, 0.47, 0.55], espacoDepois: 10 });
  doc.regua({ espacoAntes: 0, espacoDepois: 12 });

  doc.texto(`Paciente: ${paciente.nome || '-'}`, { tamanho: 13, negrito: true, espacoDepois: 2 });

  const dadosPaciente = [];
  if (paciente.idade) dadosPaciente.push(`${paciente.idade} anos`);
  if (paciente.responsavel) dadosPaciente.push(`Responsável: ${paciente.responsavel}`);
  if (dadosPaciente.length) {
    doc.texto(dadosPaciente.join('   |   '), { tamanho: 10.5, cor: [0.3, 0.35, 0.43], espacoDepois: 2 });
  }
  if (paciente.medico) {
    doc.texto(`Médico acompanhante: ${paciente.medico}`, { tamanho: 10.5, cor: [0.3, 0.35, 0.43], espacoDepois: 2 });
  }
  if (paciente.condicoes && paciente.condicoes.length) {
    doc.texto(`Condições registradas: ${paciente.condicoes.join(', ')}`, { tamanho: 10.5, cor: [0.3, 0.35, 0.43], espacoDepois: 2 });
  }
  doc.espaco(10);

  doc.texto(`Período analisado: ${formatarData(ficha.periodo.de)} a ${formatarData(ficha.periodo.ate)} (${ficha.periodo.dias} dias)`, {
    tamanho: 10.5,
    cor: [0.3, 0.35, 0.43],
    espacoDepois: 6,
  });

  doc.caixa(
    `Adesão ao tratamento: ${ficha.adesao}%   |   Doses previstas: ${ficha.totais.devidas}   |   Tomadas: ${ficha.totais.tomadas}   |   Atrasadas: ${ficha.totais.atrasadas}   |   Perdidas: ${ficha.totais.perdidas}`,
    { tamanho: 11, fundo: [0.93, 0.96, 1], borda: [0.72, 0.81, 0.95] },
  );
  doc.espaco(10);

  doc.texto('Medicamentos em uso', { tamanho: 14, negrito: true, espacoDepois: 6 });
  if (ficha.medicamentos.length === 0) {
    doc.texto('Nenhum medicamento cadastrado.', { tamanho: 10.5, cor: [0.4, 0.45, 0.52] });
  }
  for (const med of ficha.medicamentos) {
    doc.texto(`${med.nome} - ${med.dosagem}`, { tamanho: 11, negrito: true, espacoAntes: 2, espacoDepois: 1 });
    doc.texto(
      `Adesão individual: ${med.adesao}%  (${med.tomadas} de ${med.devidas} doses)  |  Perdidas: ${med.perdidas}`,
      { tamanho: 10, cor: [0.32, 0.37, 0.45], espacoDepois: 4 },
    );
  }

  doc.espaco(4);
  doc.texto('Doses perdidas', { tamanho: 14, negrito: true, espacoDepois: 6 });
  if (ficha.perdidas.length === 0) {
    doc.texto('Nenhuma dose perdida no período. Excelente adesão!', { tamanho: 10.5, cor: [0.13, 0.55, 0.33] });
  } else {
    for (const perda of ficha.perdidas.slice(0, 12)) {
      doc.texto(
        `${formatarData(perda.data)} às ${perda.horario} - ${perda.medicamento} (${perda.dosagem})`,
        { tamanho: 10.5, espacoDepois: 2 },
      );
    }
  }

  doc.espaco(6);
  doc.texto('Alertas de interação registrados', { tamanho: 14, negrito: true, espacoDepois: 6 });
  if (!ficha.alertas.length) {
    doc.texto('Nenhum alerta de interação registrado no período.', { tamanho: 10.5, cor: [0.4, 0.45, 0.52] });
  } else {
    for (const alerta of ficha.alertas) {
      const titulo = alerta.medicamento
        ? `${alerta.medicamento} (${formatarDataHora(alerta.quando)})`
        : `Alerta em ${formatarDataHora(alerta.quando)}`;
      doc.texto(titulo, { tamanho: 10.5, negrito: true, espacoDepois: 1 });
      const detalhes = (alerta.interacoes || []).map((i) => `${i.titulo} - com ${i.medicamentoExistente.nome}`).join('; ');
      if (detalhes) doc.texto(detalhes, { tamanho: 9.5, cor: [0.55, 0.2, 0.2], espacoDepois: 4 });
    }
  }

  doc.espaco(8);
  doc.texto(
    'Documento gerado automaticamente pelo protótipo acadêmico Dose Dupla. As informações são de responsabilidade do usuário e não substituem avaliação médica.',
    { tamanho: 8.5, cor: [0.45, 0.5, 0.58] },
  );

  doc.rodape(`Gerado em ${formatarDataHora(ficha.geradoEm)} - Dose Dupla / Unochapecó`);
  return doc.serializar();
}

module.exports = { gerarPdfFicha };

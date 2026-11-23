/**
 * ✅ API Confirmação de Presença — GET/POST /api/presenca (Vercel Serverless + Supabase PostgreSQL)
 * Prazo limite: 11/12/2026 às 22:00 (horário de Brasília, UTC-03:00).
 */

const PRAZO_ISO = '2026-12-11T22:00:00-03:00';
const PRAZO_MS = Date.parse(PRAZO_ISO);

function limpa(v, max) {
  return String(v || '').trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const aberto = Date.now() <= PRAZO_MS;

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      servico: 'presenca-festa-lucas',
      aberto,
      prazo: PRAZO_ISO,
      configurado: Boolean(url && key)
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erro: 'metodo-nao-permitido' });
  }

  if (!aberto) {
    return res.status(410).json({ ok: false, erro: 'prazo-encerrado' });
  }

  if (!url || !key) {
    return res.status(503).json({ ok: false, erro: 'supabase-nao-configurado' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const nome = limpa(body.nome, 80);
    const tipoTitular = body.tipoTitular === 'crianca' ? 'crianca' : 'adulto';
    const observacao = limpa(body.observacao, 400);

    if (!nome) {
      return res.status(400).json({ ok: false, erro: 'nome-obrigatorio' });
    }

    const listaBruta = Array.isArray(body.acompanhantes) ? body.acompanhantes.slice(0, 15) : [];
    const acompanhantes = [];
    let totalAdultos = tipoTitular === 'adulto' ? 1 : 0;
    let totalCriancas = tipoTitular === 'crianca' ? 1 : 0;

    listaBruta.forEach(function (item) {
      if (!item) return;
      const n = limpa(typeof item === 'string' ? item : item.nome, 80);
      if (!n) return;
      const tipo = (typeof item === 'object' && item.tipo === 'crianca') ? 'crianca' : 'adulto';
      acompanhantes.push({ nome: n, tipo });
      if (tipo === 'crianca') totalCriancas++;
      else totalAdultos++;
    });

    const totalPessoas = totalAdultos + totalCriancas;
    const acompanhantesTexto = acompanhantes
      .map(function (a) { return `${a.nome} (${a.tipo === 'crianca' ? 'Criança' : 'Adulto'})`; })
      .join(', ');

    const headers = {
      'Content-Type': 'application/json',
      apikey: key,
      Prefer: 'return=minimal'
    };
    if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;

    const resp = await fetch(`${url.replace(/\/$/, '')}/rest/v1/presenca_confirmacoes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        nome,
        acompanhantes,
        acompanhantes_texto: acompanhantesTexto,
        total_adultos: totalAdultos,
        total_criancas: totalCriancas,
        total_pessoas: totalPessoas,
        observacao
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(502).json({ ok: false, erro: 'erro-supabase', detalhe: txt.slice(0, 200) });
    }

    return res.status(200).json({ ok: true, totalPessoas });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: 'erro-interno' });
  }
};

/**
 * ✅ API Confirmação de Presença — GET/POST /api/presenca (Vercel Serverless + Supabase PostgreSQL)
 * Prazo limite: 09/12/2026 às 22:00 (horário de Brasília, UTC-03:00).
 */

const crypto = require('crypto');

const PRAZO_ISO = '2026-12-09T22:00:00-03:00';
const PRAZO_MS = Date.parse(PRAZO_ISO);

function limpa(v, max) {
  return String(v || '').trim().slice(0, max);
}

function chaveValida(informada, esperada) {
  if (!informada || !esperada) return false;
  const a = Buffer.from(String(informada));
  const b = Buffer.from(String(esperada));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function idValido(raw) {
  const s = String(raw == null ? '' : raw).trim();
  return /^[0-9a-fA-F-]{1,64}$/.test(s) ? s : '';
}

function supabaseHeaders(key, extra) {
  const h = Object.assign({ 'Content-Type': 'application/json', apikey: key }, extra || {});
  if (!key.startsWith('sb_secret_')) h.Authorization = `Bearer ${key}`;
  return h;
}

function autenticaAdmin(req, res) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    res.status(503).json({ ok: false, erro: 'admin-key-nao-configurada' });
    return false;
  }
  const recebida = req.headers['x-admin-key'] || '';
  if (!chaveValida(recebida, adminKey)) {
    res.status(401).json({ ok: false, erro: 'nao-autorizado' });
    return false;
  }
  return true;
}

function montaRegistro(body) {
  const nome = limpa(body.nome, 80);
  if (!nome) return { erro: 'nome-obrigatorio' };

  const tipoTitular = body.tipoTitular === 'crianca' ? 'crianca' : 'adulto';
  const observacao = limpa(body.observacao, 400);
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

  return {
    payload: {
      nome,
      acompanhantes,
      acompanhantes_texto: acompanhantesTexto,
      total_adultos: totalAdultos,
      total_criancas: totalCriancas,
      total_pessoas: totalPessoas,
      observacao
    }
  };
}

module.exports = async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const aberto = Date.now() <= PRAZO_MS;
  const base = url ? url.replace(/\/$/, '') : '';

  if (req.method === 'GET') {
    // Listagem privada dos confirmados — exige ADMIN_KEY nas env vars da Vercel
    if (req.query && req.query.listar === '1') {
      if (!autenticaAdmin(req, res)) return;
      if (!url || !key) {
        return res.status(503).json({ ok: false, erro: 'supabase-nao-configurado' });
      }
      try {
        const r = await fetch(
          `${base}/rest/v1/presenca_confirmacoes?select=id,criado_em,nome,acompanhantes,acompanhantes_texto,total_adultos,total_criancas,total_pessoas,observacao&order=criado_em.desc&limit=500`,
          { headers: supabaseHeaders(key) }
        );
        if (!r.ok) return res.status(502).json({ ok: false, erro: 'erro-supabase' });
        const lista = await r.json();
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ ok: true, confirmados: lista });
      } catch (e) {
        return res.status(500).json({ ok: false, erro: 'erro-interno' });
      }
    }

    return res.status(200).json({
      ok: true,
      servico: 'presenca-festa-lucas',
      aberto,
      prazo: PRAZO_ISO,
      configurado: Boolean(url && key),
      painelProtegido: Boolean(process.env.ADMIN_KEY)
    });
  }

  if (req.method === 'POST') {
    const temCabecalhoAdmin = Boolean(req.headers['x-admin-key']);
    let ehAdmin = false;
    if (temCabecalhoAdmin) {
      if (!autenticaAdmin(req, res)) return;
      ehAdmin = true;
    }

    if (!aberto && !ehAdmin) {
      return res.status(410).json({ ok: false, erro: 'prazo-encerrado' });
    }

    if (!url || !key) {
      return res.status(503).json({ ok: false, erro: 'supabase-nao-configurado' });
    }

    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const montado = montaRegistro(body);
      if (montado.erro) {
        return res.status(400).json({ ok: false, erro: montado.erro });
      }

      const resp = await fetch(`${base}/rest/v1/presenca_confirmacoes`, {
        method: 'POST',
        headers: supabaseHeaders(key, { Prefer: 'return=representation' }),
        body: JSON.stringify(montado.payload)
      });

      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(502).json({ ok: false, erro: 'erro-supabase', detalhe: txt.slice(0, 200) });
      }

      const criados = await resp.json().catch(() => []);
      const registro = Array.isArray(criados) && criados[0] ? criados[0] : null;
      return res.status(200).json({ ok: true, totalPessoas: montado.payload.total_pessoas, registro });
    } catch (err) {
      return res.status(500).json({ ok: false, erro: 'erro-interno' });
    }
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    if (!autenticaAdmin(req, res)) return;
    if (!url || !key) {
      return res.status(503).json({ ok: false, erro: 'supabase-nao-configurado' });
    }
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const id = idValido(body.id || (req.query && req.query.id));
      if (!id) {
        return res.status(400).json({ ok: false, erro: 'id-invalido' });
      }
      const montado = montaRegistro(body);
      if (montado.erro) {
        return res.status(400).json({ ok: false, erro: montado.erro });
      }

      const resp = await fetch(
        `${base}/rest/v1/presenca_confirmacoes?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: supabaseHeaders(key, { Prefer: 'return=representation' }),
          body: JSON.stringify(montado.payload)
        }
      );

      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(502).json({ ok: false, erro: 'erro-supabase', detalhe: txt.slice(0, 200) });
      }

      const atualizados = await resp.json().catch(() => []);
      if (!Array.isArray(atualizados) || !atualizados.length) {
        return res.status(404).json({ ok: false, erro: 'nao-encontrado' });
      }
      return res.status(200).json({ ok: true, registro: atualizados[0] });
    } catch (err) {
      return res.status(500).json({ ok: false, erro: 'erro-interno' });
    }
  }

  if (req.method === 'DELETE') {
    if (!autenticaAdmin(req, res)) return;
    if (!url || !key) {
      return res.status(503).json({ ok: false, erro: 'supabase-nao-configurado' });
    }
    try {
      const body = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : {};
      const id = idValido((req.query && req.query.id) || body.id);
      if (!id) {
        return res.status(400).json({ ok: false, erro: 'id-invalido' });
      }

      const resp = await fetch(
        `${base}/rest/v1/presenca_confirmacoes?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: supabaseHeaders(key, { Prefer: 'return=representation' })
        }
      );

      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(502).json({ ok: false, erro: 'erro-supabase', detalhe: txt.slice(0, 200) });
      }

      const removidos = await resp.json().catch(() => []);
      if (!Array.isArray(removidos) || !removidos.length) {
        return res.status(404).json({ ok: false, erro: 'nao-encontrado' });
      }
      return res.status(200).json({ ok: true, id });
    } catch (err) {
      return res.status(500).json({ ok: false, erro: 'erro-interno' });
    }
  }

  return res.status(405).json({ ok: false, erro: 'metodo-nao-permitido' });
};

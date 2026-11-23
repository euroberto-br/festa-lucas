/**
 * 📼 API Cápsula do Tempo — POST /api/capsula (Vercel Serverless + Supabase PostgreSQL)
 * Variáveis de ambiente necessárias na Vercel:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const crypto = require('crypto');

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

module.exports = async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (req.method === 'GET') {
    if (req.query && req.query.listar === '1') {
      const adminKey = process.env.ADMIN_KEY;
      if (!adminKey) {
        return res.status(503).json({ ok: false, erro: 'admin-key-nao-configurada' });
      }
      if (!chaveValida(req.headers['x-admin-key'] || '', adminKey)) {
        return res.status(401).json({ ok: false, erro: 'nao-autorizado' });
      }
      if (!url || !key) {
        return res.status(503).json({ ok: false, erro: 'supabase-nao-configurado' });
      }
      try {
        const headers = { 'Content-Type': 'application/json', apikey: key };
        if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
        const r = await fetch(
          `${url.replace(/\/$/, '')}/rest/v1/capsula_mensagens?select=id,criado_em,nome,relacao,tipo,mensagem&order=criado_em.desc&limit=500`,
          { headers }
        );
        if (!r.ok) return res.status(502).json({ ok: false, erro: 'erro-supabase' });
        const mensagens = await r.json();
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ ok: true, mensagens });
      } catch (e) {
        return res.status(500).json({ ok: false, erro: 'erro-interno' });
      }
    }

    return res.status(200).json({
      ok: true,
      servico: 'capsula-do-tempo-lucas',
      configurado: Boolean(url && key),
      painelProtegido: Boolean(process.env.ADMIN_KEY)
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erro: 'metodo-nao-permitido' });
  }

  if (!url || !key) {
    return res.status(503).json({ ok: false, erro: 'supabase-nao-configurado' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const nome = limpa(body.nome, 80);
    const relacao = limpa(body.relacao, 80);
    const tipo = limpa(body.tipo || '🎤 Rima pro Lucas', 40);
    const mensagem = limpa(body.mensagem, 4000);

    if (!nome || !mensagem) {
      return res.status(400).json({ ok: false, erro: 'campos-obrigatorios' });
    }

    const headers = {
      'Content-Type': 'application/json',
      apikey: key,
      Prefer: 'return=minimal'
    };
    if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;

    const resp = await fetch(`${url.replace(/\/$/, '')}/rest/v1/capsula_mensagens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ nome, relacao, tipo, mensagem })
    });

    if (!resp.ok) {
      return res.status(502).json({ ok: false, erro: 'erro-supabase' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: 'erro-interno' });
  }
};

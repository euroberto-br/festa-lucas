/**
 * 🏆 API Ranking da Tropa — GET/POST /api/ranking (Vercel Serverless + Supabase PostgreSQL)
 * Variáveis de ambiente necessárias na Vercel:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const JOGOS_VALIDOS = { runner: 1200, sonic: 1200, flappy: 1200, ritmo: 1200, pacman: 1200 };

function limpa(v, max) {
  return String(v || '').trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(503).json({ ok: false, erro: 'supabase-nao-configurado' });
  }

  const base = url.replace(/\/$/, '');
  const headers = {
    'Content-Type': 'application/json',
    apikey: key
  };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const nome = limpa(body.nome, 40);
      const jogo = limpa(body.jogo, 20);
      const pontos = Math.round(Number(body.pontos));
      const detalhe = limpa(body.detalhe || '30s', 20);
      const aparelho = limpa(body.aparelho, 32);

      if (!nome) return res.status(400).json({ ok: false, erro: 'sem-nome' });
      if (!Object.prototype.hasOwnProperty.call(JOGOS_VALIDOS, jogo)) {
        return res.status(400).json({ ok: false, erro: 'jogo-desconhecido' });
      }
      if (!(pontos >= 1 && pontos <= JOGOS_VALIDOS[jogo])) {
        return res.status(400).json({ ok: false, erro: 'placar-fora-do-plausivel' });
      }

      const resp = await fetch(`${base}/rest/v1/ranking_placares`, {
        method: 'POST',
        headers: Object.assign({}, headers, { Prefer: 'return=minimal' }),
        body: JSON.stringify({ nome, jogo, pontos, detalhe, aparelho })
      });

      if (!resp.ok) {
        return res.status(502).json({ ok: false, erro: 'erro-supabase' });
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, erro: 'erro-interno' });
    }
  }

  if (req.method === 'GET') {
    try {
      const resp = await fetch(
        `${base}/rest/v1/ranking_melhores?select=nome,nome_normalizado,jogo,pontos,detalhe&limit=500`,
        { headers }
      );
      if (!resp.ok) {
        return res.status(502).json({ ok: false, erro: 'erro-supabase' });
      }
      const rows = await resp.json();

      const porJogo = { runner: [], sonic: [], flappy: [], ritmo: [], pacman: [] };
      const porPessoa = {};

      rows.forEach(function (r) {
        if (!Object.prototype.hasOwnProperty.call(porJogo, r.jogo)) return;
        porJogo[r.jogo].push({ nome: r.nome, pontos: r.pontos, detalhe: r.detalhe });
        const k = r.nome_normalizado || String(r.nome || '').toLowerCase();
        if (!porPessoa[k]) porPessoa[k] = { nome: r.nome, total: 0, jogos: 0 };
        porPessoa[k].total += Number(r.pontos) || 0;
        porPessoa[k].jogos += 1;
      });

      Object.keys(porJogo).forEach(function (j) {
        porJogo[j].sort(function (a, b) { return b.pontos - a.pontos; });
        porJogo[j] = porJogo[j].slice(0, 10);
      });

      const geral = Object.values(porPessoa)
        .sort(function (a, b) { return (b.total - a.total) || (b.jogos - a.jogos); })
        .slice(0, 10);

      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
      return res.status(200).json({
        ok: true,
        servico: 'ranking-tropa-lucas',
        porJogo,
        geral
      });
    } catch (err) {
      return res.status(500).json({ ok: false, erro: 'erro-interno' });
    }
  }

  return res.status(405).json({ ok: false, erro: 'metodo-nao-permitido' });
};

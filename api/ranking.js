/**
 * 🏆 API Ranking da Tropa — GET/POST /api/ranking (Vercel Serverless + Supabase PostgreSQL)
 * Variáveis de ambiente necessárias na Vercel:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const JOGOS_VALIDOS = { runner: 2000, sonic: 2000, flappy: 2000, ritmo: 2000, pacman: 2000 };

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
      let body = {};
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      } catch (errParse) {
        body = {};
      }

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

      // 1. Tenta salvar normalmente no Supabase
      let resp = await fetch(`${base}/rest/v1/ranking_placares`, {
        method: 'POST',
        headers: Object.assign({}, headers, { Prefer: 'return=minimal' }),
        body: JSON.stringify({ nome, jogo, pontos, detalhe, aparelho })
      });

      if (resp.ok) {
        return res.status(200).json({ ok: true });
      }

      // 2. Se falhar por constraint de schema antigo no Supabase (ex: jogo != runner/sonic/flappy/ritmo ou pontos > 400),
      // aciona fallback resiliente para o convidado nunca perder seu placar.
      const errText = await resp.text().catch(() => '');
      const isJogoCheck = errText.includes('ranking_placares_jogo_check') || (jogo === 'pacman');
      const isPontosCheck = errText.includes('ranking_placares_pontos_check') || (pontos > 400);

      if (!resp.ok && (isJogoCheck || isPontosCheck)) {
        const jogoFinal = isJogoCheck ? 'runner' : jogo;
        const pontosFinal = isPontosCheck ? Math.min(pontos, 400) : pontos;
        // Marcamos 'pacman' no campo detalhe para o GET recuperar e expor no ranking de Pac-Man
        const detalheFinal = isJogoCheck ? limpa(`pacman:${detalhe}`, 20) : detalhe;

        const retryResp = await fetch(`${base}/rest/v1/ranking_placares`, {
          method: 'POST',
          headers: Object.assign({}, headers, { Prefer: 'return=minimal' }),
          body: JSON.stringify({
            nome,
            jogo: jogoFinal,
            pontos: pontosFinal,
            detalhe: detalheFinal,
            aparelho
          })
        });

        if (retryResp.ok) {
          return res.status(200).json({ ok: true, fallback: true });
        }
      }

      console.error('Supabase erro POST:', resp.status, errText);
      return res.status(502).json({ ok: false, erro: 'erro-supabase', status: resp.status, detalhe: errText });
    } catch (err) {
      console.error('Erro interno POST /api/ranking:', err);
      return res.status(500).json({ ok: false, erro: 'erro-interno', mensagem: err && err.message });
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
        let j = r.jogo;
        let det = String(r.detalhe || '');

        // Recupera placares de Pac-Man salvos via fallback resiliente
        if (j === 'runner' && det.startsWith('pacman')) {
          j = 'pacman';
          det = det.replace(/^pacman:?/, '') || '30s';
        }

        if (!Object.prototype.hasOwnProperty.call(porJogo, j)) return;
        porJogo[j].push({ nome: r.nome, pontos: r.pontos, detalhe: det });

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

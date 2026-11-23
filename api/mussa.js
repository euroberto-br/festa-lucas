/**
 * 🎨 API Vire do Mussaverso — POST /api/mussa (Vercel Serverless + Azure AI Foundry + Supabase)
 * Variáveis de ambiente na Vercel:
 *   - AZURE_API_KEY (obrigatória para gerar desenhos)
 *   - AZURE_BASE (opcional — padrão projetosites-resource)
 *   - SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (opcionais — log de estatística em ia_geracoes)
 */

const AZURE_BASE = process.env.AZURE_BASE || 'https://projetosites-resource.services.ai.azure.com/openai/v1';
const MODELO = 'gpt-image-2';
const TAMANHO = '1024x1024';

const PROMPT =
  'Transform the person in this photo into a vibrant kid-friendly street-cartoon ' +
  'character inspired by a fun Brazilian hip-hop kids YouTuber universe: flat bold ' +
  'colors, thick dark comic outlines, big expressive cartoon eyes and a joyful smile. ' +
  'Keep the person clearly recognizable: same face features, skin tone, hair and ' +
  'expression, while styling them with a cool red backwards baseball cap, a white ' +
  'headband underneath, stylish sunglasses resting on the cap or worn with visible ' +
  'friendly vibe, a red streetwear hoodie, and holding a golden microphone. Place ' +
  'them on a colorful cartoon rap-battle stage with spotlights, floating musical notes, ' +
  'stars and a boombox in the background. Keep the bottom 20% of the image as simple ' +
  'clean stage floor background with no important elements there. The illustration must ' +
  'contain absolutely NO text: no letters, no words, no captions, no logos and no ' +
  'watermarks of any kind. Kid-friendly, vibrant, high quality 2D cartoon illustration.';

async function logUso(status, aparelho) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const headers = {
      'Content-Type': 'application/json',
      apikey: key,
      Prefer: 'return=minimal'
    };
    if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
    await fetch(`${url.replace(/\/$/, '')}/rest/v1/ia_geracoes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        status: String(status || 'ok').slice(0, 30),
        aparelho: String(aparelho || '').slice(0, 32)
      })
    });
  } catch (e) {}
}

module.exports = async function handler(req, res) {
  const chave = process.env.AZURE_API_KEY;

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      servico: 'vire-do-mussaverso-lucas',
      ia: `${MODELO} (Azure)`,
      chaveConfigurada: Boolean(chave),
      supabaseConfigurado: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY))
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erro: 'metodo-nao-permitido' });
  }

  if (!chave) {
    return res.status(503).json({ ok: false, erro: 'sem-chave' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const imagem = String(body.imagem || '');
    const mime = String(body.mime || 'image/jpeg');
    const aparelho = String(body.aparelho || '');

    if (!imagem || imagem.length > 6000000 || !/^image\/(jpeg|png|webp)$/.test(mime)) {
      return res.status(400).json({ ok: false, erro: 'foto-invalida' });
    }

    const buffer = Buffer.from(imagem, 'base64');
    const campos = {
      prompt: PROMPT,
      model: MODELO,
      size: TAMANHO,
      n: '1',
      output_format: 'png',
      quality: 'medium',
      input_fidelity: 'high'
    };

    let resp, corpo, tentativas = 0;
    while (true) {
      const fd = new FormData();
      fd.append('image', new Blob([buffer], { type: mime }), 'selfie.jpg');
      Object.keys(campos).forEach(function (k) { fd.append(k, campos[k]); });

      resp = await fetch(`${AZURE_BASE.replace(/\/$/, '')}/images/edits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${chave}` },
        body: fd
      });
      corpo = await resp.text();
      const m = resp.status === 400 && corpo.match(/[Uu]nknown parameter[^a-z_]*'?([a-z_]+)'?/);
      const desconhecido = m && m[1];
      if (!desconhecido || !(desconhecido in campos) || ++tentativas > 3) break;
      delete campos[desconhecido];
    }

    if (resp.status === 429) {
      await logUso('cota-ia', aparelho);
      return res.status(429).json({ ok: false, erro: 'cota-ia' });
    }
    if (!resp.ok) {
      if (/moderation|content_(policy|filter)|safety|responsible/i.test(corpo)) {
        await logUso('bloqueada', aparelho);
        return res.status(400).json({ ok: false, erro: 'bloqueada' });
      }
      await logUso('erro-ia', aparelho);
      return res.status(502).json({ ok: false, erro: 'ia' });
    }

    const json = JSON.parse(corpo);
    const item = json.data && json.data[0];
    if (item && item.b64_json) {
      await logUso('ok', aparelho);
      return res.status(200).json({ ok: true, imagem: item.b64_json, mime: 'image/png' });
    }

    await logUso('vazio', aparelho);
    return res.status(502).json({ ok: false, erro: 'ia' });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: 'ia' });
  }
};

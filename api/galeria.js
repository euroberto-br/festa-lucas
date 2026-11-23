/**
 * 📸 API Galeria por Pasta do Cloudinary — GET /api/galeria?pasta=festa-lucas|festa-lucas-ia
 *
 * Lista diretamente todas as imagens dentro da pasta (asset_folder) no Cloudinary
 * usando a Admin API (`resources/by_asset_folder`) quando CLOUDINARY_API_KEY e
 * CLOUDINARY_API_SECRET estão configuradas na Vercel.
 * Se não estiverem configuradas, faz fallback automático para a listagem pública por tag.
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'znbneca7';
const PASTAS_VALIDAS = { 'festa-lucas': true, 'festa-lucas-ia': true };

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, erro: 'metodo-nao-permitido' });
  }

  const pasta = String((req.query && req.query.pasta) || '').trim();
  if (!PASTAS_VALIDAS[pasta]) {
    return res.status(400).json({ ok: false, erro: 'pasta-invalida' });
  }

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // 1. Modo principal: lista diretamente pela PASTA (asset_folder) via Admin API
  if (apiKey && apiSecret) {
    try {
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      const url =
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/by_asset_folder` +
        `?asset_folder=${encodeURIComponent(pasta)}&max_results=100&context=true&direction=desc`;
      const r = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(10000)
      });

      if (r.ok) {
        const data = await r.json();
        const resources = (data.resources || []).map(function (it) {
          return {
            public_id: it.public_id,
            version: it.version,
            context: it.context || {}
          };
        });
        res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
        return res.status(200).json({ ok: true, origem: 'pasta', resources });
      }
    } catch (e) {}
  }

  // 2. Fallback: listagem pública por tag (não exige API Secret)
  try {
    const buster = Math.floor(Date.now() / 30000);
    const r = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/image/list/${pasta}.json?t=${buster}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (r.status === 404) {
      return res.status(200).json({ ok: true, origem: 'tag', resources: [], precisaChavePasta: !(apiKey && apiSecret) });
    }
    if (r.ok) {
      const data = await r.json();
      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
      return res.status(200).json({ ok: true, origem: 'tag', resources: data.resources || [] });
    }
  } catch (e) {}

  return res.status(200).json({ ok: true, origem: 'vazio', resources: [] });
};

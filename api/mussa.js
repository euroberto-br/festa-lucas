/**
 * 🎨 API Vire do Mussaverso — POST/GET /api/mussa (Vercel Serverless + Fila Assíncrona ComfyUI)
 *
 * Fluxo assíncrono (suporta 60+ convidados sem timeout na Vercel e estritamente 1 por vez na GPU):
 *   - POST /api/mussa        -> Enfileira a selfie no ComfyUI (FIFO) e responde <2s com { status:'fila', jobId, posicao }
 *   - GET  /api/mussa?job=ID -> Consulta posição na fila ('fila'|'gerando') ou entrega a imagem ('pronto')
 *   - GET  /api/mussa        -> Healthcheck dos provedores + tamanho atual da fila
 *
 * Fallback automático: se COMFYUI_URL estiver offline e HF_TOKEN estiver configurado, usa Hugging Face.
 */

const MAX_FILA = 25;

const ESTILOS = [
  'bold 2D street-comic cartoon illustration with thick dark outlines and vibrant flat colors',
  'vibrant 3D collectible vinyl-toy cartoon style (Pixar-like smooth lighting, playful proportions and glossy colors)',
  'energetic Saturday-morning cartoon / pop-anime illustration with dynamic action lines and crisp shading',
  'colorful urban graffiti sticker pop-art illustration with subtle comic halftone highlights',
  'clean modern YouTuber mascot vector cartoon style with bold cel-shading and bright rim lighting'
];

const POSES = [
  'holding a shiny golden microphone mid-rap while making a cool playful hand gesture toward the camera',
  'spinning a glowing vinyl record on a cartoon DJ turntable with big headphones around the neck',
  'jumping joyfully in mid-air with a colorful street skateboard and floating golden stars around',
  'striking a superstar YouTuber pose proudly holding a shiny golden play-button trophy',
  'carrying a retro cartoon boombox on one shoulder with musical notes bursting out',
  'pointing happily toward the camera in an energetic rap-battle winner pose with sparkles around'
];

const FIGURINOS = [
  'wearing a red baseball cap backwards over a white headband, stylish sunglasses resting on the cap, and a red streetwear hoodie',
  'wearing a black-and-gold baseball cap backwards over a red bandana, cool tinted sunglasses, and a red-and-black bomber jacket',
  'wearing a red backwards cap over a white bandana, neon-rimmed sunglasses on the cap, and an oversized graphic streetwear jersey with golden headphones',
  'wearing a red-and-gold backwards cap over a white headband, stylish dark shades, and a red-and-white varsity jacket',
  'wearing a bright red backwards cap over a patterned white bandana, cool cartoon sunglasses, and a vibrant yellow-and-red street hoodie'
];

const CENARIOS = [
  'on a vibrant concert rap-battle stage with colorful spotlights, giant speakers and floating musical notes',
  'in front of a bright colorful street-art graffiti wall at golden sunset with stars and dynamic paint splashes',
  'inside a colorful kids YouTuber streaming studio with glowing neon RGB lights, floating musical notes and trophies',
  'in a fun stylized cartoon desert sunset scene with golden skies, palm silhouettes, boombox and floating musical notes',
  'at an explosive festive birthday concert with red and gold balloons, flying confetti and disco beams',
  'on an energetic neon night street basketball court with cyan and magenta lights and glowing equalizer bars in the sky'
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function montarPrompt() {
  return (
    `Transform the person from the reference photo into a ${pick(ESTILOS)}. ` +
    'Keep the person clearly recognizable: preserve their exact face features, eyes, skin tone, hair color and joyful smile. ' +
    `Show them ${pick(POSES)}, ${pick(FIGURINOS)}. ` +
    `Background setting: ${pick(CENARIOS)}. ` +
    'Kid-friendly, joyful, high quality framing (head and upper body nicely centered). ' +
    'Keep the bottom 20% of the image clean and uncluttered for a caption badge. ' +
    'Absolutely NO text, NO letters, NO numbers, NO words, NO logos and NO watermarks anywhere in the image.'
  );
}

function comfyHeaders() {
  const h = {};
  if (process.env.COMFYUI_SECRET) h['X-Comfy-Secret'] = process.env.COMFYUI_SECRET;
  return h;
}

async function logUso(status, aparelho) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const headers = { 'Content-Type': 'application/json', apikey: key, Prefer: 'return=minimal' };
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

/* ---------- COMFYUI: ENFILEIRAR (rápido, <2s) ---------- */
async function enfileirarComfyUI(buffer, mime, prompt) {
  const base = process.env.COMFYUI_URL.replace(/\/$/, '');
  const extra = comfyHeaders();

  // 1. Checa tamanho da fila atual (proteção anti-sobrecarga)
  const qResp = await fetch(`${base}/queue`, { headers: extra, signal: AbortSignal.timeout(5000) });
  if (!qResp.ok) throw new Error('comfy-queue-' + qResp.status);
  const qJson = await qResp.json();
  const running = (qJson.queue_running || []).length;
  const pending = (qJson.queue_pending || []).length;
  if (running + pending >= MAX_FILA) {
    const err = new Error('fila-cheia');
    err.code = 429;
    throw err;
  }

  // 2. Upload da selfie
  const fd = new FormData();
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const fname = `selfie_${Date.now()}_${Math.floor(Math.random() * 9999)}.${ext}`;
  fd.append('image', new Blob([buffer], { type: mime }), fname);

  const up = await fetch(`${base}/upload/image`, {
    method: 'POST',
    headers: extra,
    body: fd,
    signal: AbortSignal.timeout(8000)
  });
  if (!up.ok) throw new Error('comfy-upload-' + up.status);
  const { name: imgName } = await up.json();

  // 3. Enfileira o workflow (FIFO nativo — 1 por vez na GPU)
  const seed = Math.floor(Math.random() * 1000000000);
  const wf = {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: 'flux-2-klein-4b-nvfp4.safetensors', weight_dtype: 'default' } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b_fp8_mixed.safetensors', type: 'flux2' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
    '4': { class_type: 'LoadImage', inputs: { image: imgName } },
    '5': { class_type: 'VAEEncode', inputs: { pixels: ['4', 0], vae: ['3', 0] } },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 0] } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['2', 0] } },
    '8': { class_type: 'ReferenceLatent', inputs: { conditioning: ['6', 0], latent: ['5', 0] } },
    '9': { class_type: 'ReferenceLatent', inputs: { conditioning: ['7', 0], latent: ['5', 0] } },
    '10': { class_type: 'EmptyFlux2LatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
    '11': { class_type: 'Flux2Scheduler', inputs: { steps: 6, width: 1024, height: 1024 } },
    '12': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    '13': { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
    '14': { class_type: 'CFGGuider', inputs: { model: ['1', 0], positive: ['8', 0], negative: ['9', 0], cfg: 1.0 } },
    '15': { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['13', 0], guider: ['14', 0], sampler: ['12', 0], sigmas: ['11', 0], latent_image: ['10', 0] } },
    '16': { class_type: 'VAEDecode', inputs: { samples: ['15', 0], vae: ['3', 0] } },
    '17': { class_type: 'SaveImage', inputs: { images: ['16', 0], filename_prefix: 'mussaverso_web' } }
  };

  const pResp = await fetch(`${base}/prompt`, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, extra),
    body: JSON.stringify({ prompt: wf, client_id: 'festa-lucas-vercel' }),
    signal: AbortSignal.timeout(8000)
  });
  if (!pResp.ok) throw new Error('comfy-prompt-' + pResp.status);
  const { prompt_id } = await pResp.json();

  const totalFila = running + pending + 1;
  const posicao = running === 0 && pending === 0 ? 0 : (pending + 1);
  return {
    ok: true,
    status: posicao === 0 ? 'gerando' : 'fila',
    jobId: prompt_id,
    posicao,
    totalFila,
    provedor: 'comfyui'
  };
}

/* ---------- COMFYUI: CONSULTAR STATUS DE UM JOB ---------- */
async function consultarJobComfyUI(jobId, aparelho) {
  const base = process.env.COMFYUI_URL.replace(/\/$/, '');
  const extra = comfyHeaders();

  // 1. Verifica se já terminou em /history/{jobId}
  const hResp = await fetch(`${base}/history/${encodeURIComponent(jobId)}`, {
    headers: extra,
    signal: AbortSignal.timeout(6000)
  });
  if (hResp.ok) {
    const hist = await hResp.json();
    const item = hist[jobId];
    if (item) {
      if (item.status && item.status.status_str === 'error') {
        await logUso('erro:comfyui', aparelho);
        return { ok: false, status: 'erro', erro: 'ia' };
      }
      const imgs = item.outputs && item.outputs['17'] && item.outputs['17'].images;
      if (imgs && imgs.length) {
        const im = imgs[0];
        const qs = new URLSearchParams({
          filename: im.filename,
          subfolder: im.subfolder || '',
          type: im.type || 'output'
        });
        const vResp = await fetch(`${base}/view?${qs.toString()}`, {
          headers: extra,
          signal: AbortSignal.timeout(12000)
        });
        if (!vResp.ok) return { ok: false, status: 'erro', erro: 'ia' };
        const ab = await vResp.arrayBuffer();
        await logUso('ok:comfyui', aparelho);
        return {
          ok: true,
          status: 'pronto',
          imagem: Buffer.from(ab).toString('base64'),
          mime: 'image/png',
          provedor: 'comfyui'
        };
      }
    }
  }

  // 2. Ainda em andamento: lê posição exata em /queue
  const qResp = await fetch(`${base}/queue`, { headers: extra, signal: AbortSignal.timeout(5000) });
  if (!qResp.ok) return { ok: true, status: 'fila', posicao: 1, totalFila: 1 };
  const qJson = await qResp.json();
  const running = qJson.queue_running || [];
  const pending = qJson.queue_pending || [];
  const totalFila = running.length + pending.length;

  // Em ComfyUI cada entrada da fila é um array [numero, prompt_id, ...]
  if (running.some(function (it) { return it && it[1] === jobId; })) {
    return { ok: true, status: 'gerando', posicao: 0, totalFila };
  }
  const idx = pending.findIndex(function (it) { return it && it[1] === jobId; });
  if (idx !== -1) {
    return { ok: true, status: 'fila', posicao: idx + 1, totalFila };
  }

  // Pequena janela de transição entre queue e history: aguarda próximo tick
  return { ok: true, status: 'gerando', posicao: 0, totalFila: Math.max(1, totalFila) };
}

/* ---------- FALLBACK: HUGGING FACE (FLUX.1-Kontext-dev) ---------- */
async function gerarHuggingFace(imagemB64, mime, prompt) {
  const token = process.env.HF_TOKEN;
  const model = process.env.HF_MODEL || 'black-forest-labs/FLUX.1-Kontext-dev';
  const dataUri = `data:${mime};base64,${imagemB64}`;

  const tentativas = [
    {
      url: 'https://router.huggingface.co/fal-ai/fal-ai/flux-kontext/dev',
      body: { prompt: prompt, image_url: dataUri, num_inference_steps: 24, output_format: 'png' }
    },
    {
      url: `https://router.huggingface.co/hf-inference/models/${model}`,
      body: { inputs: prompt, parameters: { image: imagemB64 } }
    }
  ];

  let ultimoErro = 'hf-erro';
  for (const t of tentativas) {
    const r = await fetch(t.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'image/png, application/json'
      },
      body: JSON.stringify(t.body),
      signal: AbortSignal.timeout(48000)
    });
    if (r.status === 402 || r.status === 429) {
      const err = new Error('cota-ia');
      err.code = 429;
      throw err;
    }
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.startsWith('image/')) {
      const ab = await r.arrayBuffer();
      return { ok: true, status: 'pronto', imagem: Buffer.from(ab).toString('base64'), mime: ct.split(';')[0], provedor: 'huggingface' };
    }
    if (r.ok && ct.includes('application/json')) {
      const j = await r.json();
      const imgUrl = (j.images && j.images[0] && j.images[0].url) || j.image_url;
      if (imgUrl) {
        const dl = await fetch(imgUrl, { signal: AbortSignal.timeout(15000) });
        if (dl.ok) {
          const ab = await dl.arrayBuffer();
          return { ok: true, status: 'pronto', imagem: Buffer.from(ab).toString('base64'), mime: dl.headers.get('content-type') || 'image/png', provedor: 'huggingface' };
        }
      }
    }
    ultimoErro = 'hf-' + r.status;
  }
  throw new Error(ultimoErro);
}

module.exports = async function handler(req, res) {
  const temComfy = Boolean(process.env.COMFYUI_URL);
  const temHF = Boolean(process.env.HF_TOKEN);

  if (req.method === 'GET') {
    const jobId = String((req.query && req.query.job) || '').trim();
    if (jobId) {
      if (!temComfy) return res.status(503).json({ ok: false, erro: 'sem-chave' });
      if (!/^[a-zA-Z0-9_-]{8,64}$/.test(jobId)) {
        return res.status(400).json({ ok: false, erro: 'job-invalido' });
      }
      try {
        const aparelho = String((req.query && req.query.aparelho) || '');
        const st = await consultarJobComfyUI(jobId, aparelho);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(st);
      } catch (e) {
        return res.status(502).json({ ok: false, erro: 'ia' });
      }
    }

    return res.status(200).json({
      ok: true,
      servico: 'vire-do-mussaverso-lucas',
      filaAssincrona: temComfy,
      maxFila: MAX_FILA,
      provedores: { comfyui: temComfy, huggingface: temHF },
      supabaseConfigurado: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY))
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erro: 'metodo-nao-permitido' });
  }

  if (!temComfy && !temHF) {
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
    const prompt = montarPrompt();

    if (temComfy) {
      try {
        const enq = await enfileirarComfyUI(buffer, mime, prompt);
        return res.status(202).json(enq);
      } catch (e) {
        if (e && e.message === 'fila-cheia') {
          await logUso('fila-cheia', aparelho);
          return res.status(429).json({ ok: false, erro: 'fila-cheia' });
        }
        if (!temHF) {
          await logUso('erro:comfyui', aparelho);
          return res.status(502).json({ ok: false, erro: 'ia' });
        }
      }
    }

    if (temHF) {
      const hfRes = await gerarHuggingFace(imagem, mime, prompt);
      await logUso('ok:huggingface', aparelho);
      return res.status(200).json(hfRes);
    }

    return res.status(502).json({ ok: false, erro: 'ia' });
  } catch (err) {
    const code = (err && err.code) || 500;
    const msg = (err && err.message === 'cota-ia') ? 'cota-ia' : 'ia';
    return res.status(code).json({ ok: false, erro: msg });
  }
};

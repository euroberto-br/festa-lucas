/**
 * 🎨 API Vire do Mussaverso — POST /api/mussa (Vercel Serverless + Multi-Provider IA)
 *
 * Ordem automática de provedores (usa o primeiro configurado nas env vars da Vercel;
 * se o ComfyUI local estiver offline, faz fallback automático para o Hugging Face):
 *   1. COMFYUI_URL -> Seu ComfyUI local (FLUX.2 Klein 4B NVFP4) via Cloudflare Tunnel (GRÁTIS e ILIMITADO!)
 *                     Opcional: COMFYUI_SECRET (enviado em X-Comfy-Secret)
 *   2. HF_TOKEN    -> Hugging Face Inference Providers (FLUX.1-Kontext-dev)
 *                     Opcional: HF_MODEL (padrão: black-forest-labs/FLUX.1-Kontext-dev)
 *
 * Opcional (log de estatística): SUPABASE_URL + SUPABASE_SECRET_KEY
 */

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
  const estilo = pick(ESTILOS);
  const pose = pick(POSES);
  const figurino = pick(FIGURINOS);
  const cenario = pick(CENARIOS);
  return (
    `Transform the person from the reference photo into a ${estilo}. ` +
    'Keep the person clearly recognizable: preserve their exact face features, eyes, skin tone, hair color and joyful smile. ' +
    `Show them ${pose}, ${figurino}. ` +
    `Background setting: ${cenario}. ` +
    'Kid-friendly, joyful, high quality framing (head and upper body nicely centered). ' +
    'Keep the bottom 20% of the image clean and uncluttered for a caption badge. ' +
    'Absolutely NO text, NO letters, NO numbers, NO words, NO logos and NO watermarks anywhere in the image.'
  );
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

/* ---------- 1. COMFYUI LOCAL (FLUX.2 Klein 4B NVFP4 via Cloudflare Tunnel) ---------- */
async function gerarComfyUI(buffer, mime, prompt) {
  const base = process.env.COMFYUI_URL.replace(/\/$/, '');
  const extraHeaders = {};
  if (process.env.COMFYUI_SECRET) extraHeaders['X-Comfy-Secret'] = process.env.COMFYUI_SECRET;

  // Upload da selfie (timeout curto de 6s para detectar rápido se o PC está desligado)
  const fd = new FormData();
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const fname = `selfie_${Date.now()}_${Math.floor(Math.random() * 9999)}.${ext}`;
  fd.append('image', new Blob([buffer], { type: mime }), fname);

  const up = await fetch(`${base}/upload/image`, {
    method: 'POST',
    headers: extraHeaders,
    body: fd,
    signal: AbortSignal.timeout(6000)
  });
  if (!up.ok) throw new Error('comfy-upload-' + up.status);
  const upJson = await up.json();
  const imgName = upJson.name;

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

  const q = await fetch(`${base}/prompt`, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders),
    body: JSON.stringify({ prompt: wf, client_id: 'festa-lucas-vercel' }),
    signal: AbortSignal.timeout(10000)
  });
  if (!q.ok) throw new Error('comfy-prompt-' + q.status);
  const { prompt_id } = await q.json();

  // Polling até ~48s
  for (let i = 0; i < 48; i++) {
    await new Promise(function (r) { setTimeout(r, 1000); });
    const h = await fetch(`${base}/history/${prompt_id}`, { headers: extraHeaders, signal: AbortSignal.timeout(5000) });
    if (!h.ok) continue;
    const hist = await h.json();
    const item = hist[prompt_id];
    if (!item) continue;
    if (item.status && item.status.status_str === 'error') throw new Error('comfy-exec-error');
    const imgs = item.outputs && item.outputs['17'] && item.outputs['17'].images;
    if (imgs && imgs.length) {
      const im = imgs[0];
      const qs = new URLSearchParams({
        filename: im.filename,
        subfolder: im.subfolder || '',
        type: im.type || 'output'
      });
      const v = await fetch(`${base}/view?${qs.toString()}`, { headers: extraHeaders, signal: AbortSignal.timeout(10000) });
      if (!v.ok) throw new Error('comfy-view-' + v.status);
      const ab = await v.arrayBuffer();
      return { imagem: Buffer.from(ab).toString('base64'), mime: 'image/png', provedor: 'comfyui' };
    }
  }
  throw new Error('comfy-timeout');
}

/* ---------- 2. HUGGING FACE INFERENCE PROVIDERS (FLUX.1-Kontext-dev) ---------- */
async function gerarHuggingFace(imagemB64, mime, prompt) {
  const token = process.env.HF_TOKEN;
  const model = process.env.HF_MODEL || 'black-forest-labs/FLUX.1-Kontext-dev';
  const dataUri = `data:${mime};base64,${imagemB64}`;

  // Tenta router fal-ai (mais rápido e confiável para Kontext) e cai para hf-inference se necessário
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
      return { imagem: Buffer.from(ab).toString('base64'), mime: ct.split(';')[0], provedor: 'huggingface' };
    }
    if (r.ok && ct.includes('application/json')) {
      const j = await r.json();
      const imgUrl = (j.images && j.images[0] && j.images[0].url) || j.image_url;
      if (imgUrl) {
        const dl = await fetch(imgUrl, { signal: AbortSignal.timeout(15000) });
        if (dl.ok) {
          const ab = await dl.arrayBuffer();
          return { imagem: Buffer.from(ab).toString('base64'), mime: dl.headers.get('content-type') || 'image/png', provedor: 'huggingface' };
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
    return res.status(200).json({
      ok: true,
      servico: 'vire-do-mussaverso-lucas',
      provedores: {
        comfyui: temComfy,
        huggingface: temHF
      },
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
    const fila = [];
    if (temComfy) fila.push(function () { return gerarComfyUI(buffer, mime, prompt); });
    if (temHF) fila.push(function () { return gerarHuggingFace(imagem, mime, prompt); });

    let ultimoErro = null;
    for (const executar of fila) {
      try {
        const resIA = await executar();
        await logUso('ok:' + resIA.provedor, aparelho);
        return res.status(200).json({
          ok: true,
          imagem: resIA.imagem,
          mime: resIA.mime,
          provedor: resIA.provedor
        });
      } catch (e) {
        ultimoErro = e;
        if (e && e.message === 'bloqueada') {
          await logUso('bloqueada', aparelho);
          return res.status(400).json({ ok: false, erro: 'bloqueada' });
        }
      }
    }

    const code = (ultimoErro && ultimoErro.code) || 502;
    const msg = (ultimoErro && ultimoErro.message === 'cota-ia') ? 'cota-ia' : 'ia';
    await logUso(msg, aparelho);
    return res.status(code).json({ ok: false, erro: msg });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: 'ia' });
  }
};

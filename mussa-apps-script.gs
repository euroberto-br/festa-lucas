/**
 * 🎨 VIRE DO MUSSAVERSO! — gerador de desenhos com IA (Lucas Nery 7 anos)
 * Backend em Google Apps Script: recebe a selfie da mussa.html,
 * pede ao Azure AI Foundry (gpt-image-2) uma versão cartoon no estilo
 * street hip-hop infantil do universo do Mussa e devolve a imagem gerada.
 * A chave da API fica AQUI no Google — nunca no site público.
 *
 * ── PASSO A PASSO (faz uma vez só) ─────────────────────────────────
 * 1. Acesse https://script.new e crie um projeto novo
 *    (sugestão: "Vire do Mussaverso — Lucas Nery 7 anos").
 * 2. Apague o conteúdo e cole ESTE arquivo inteiro. Salve (💾).
 * 3. Em Configurações do projeto (⚙️) → "Propriedades do script":
 *    - Propriedade: AZURE_API_KEY
 *    - Valor: sua apikey do Azure AI Foundry
 *    ⚠️ NUNCA cole a chave neste arquivo!
 * 4. Implantar → Nova implantação → App da Web →
 *    Executar como "Eu", Quem pode acessar "Qualquer pessoa".
 * 5. Copie a URL (/exec) e cole na constante SCRIPT_URL da mussa.html. 🎉
 * ───────────────────────────────────────────────────────────────────
 */

var AZURE_BASE = 'https://projetosites-resource.services.ai.azure.com/openai/v1';
var MODELO = 'gpt-image-2';
var TAMANHO = '1024x1024';

var PROMPT =
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

function doPost(e) {
  try {
    var chave = PropertiesService.getScriptProperties().getProperty('AZURE_API_KEY');
    if (!chave) return resposta({ ok: false, erro: 'sem-chave' });

    var dados = JSON.parse(e.postData.contents);
    var imagem = String(dados.imagem || '');
    var mime = String(dados.mime || 'image/jpeg');

    if (!imagem || imagem.length > 6000000) {
      return resposta({ ok: false, erro: 'foto-invalida' });
    }
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) {
      return resposta({ ok: false, erro: 'foto-invalida' });
    }

    contarUso();

    var selfie = Utilities.newBlob(Utilities.base64Decode(imagem), mime, 'selfie.jpg');

    var payload = {
      image: selfie,
      prompt: PROMPT,
      model: MODELO,
      size: TAMANHO,
      n: '1',
      output_format: 'png',
      quality: 'medium',
      input_fidelity: 'high'
    };

    var r, corpo, tentativas = 0;
    while (true) {
      r = UrlFetchApp.fetch(AZURE_BASE + '/images/edits', {
        method: 'post',
        headers: { Authorization: 'Bearer ' + chave },
        payload: payload,
        muteHttpExceptions: true
      });
      corpo = r.getContentText();
      var desconhecido = (r.getResponseCode() === 400) &&
        (corpo.match(/[Uu]nknown parameter[^a-z_]*'?([a-z_]+)'?/) || [])[1];
      if (!desconhecido || !(desconhecido in payload) || ++tentativas > 3) break;
      delete payload[desconhecido];
    }

    var codigo = r.getResponseCode();
    if (codigo === 429) {
      return resposta({ ok: false, erro: 'cota-ia', detalhe: corpo.slice(0, 500) });
    }
    if (codigo !== 200) {
      if (/moderation|content_(policy|filter)|safety|responsible/i.test(corpo)) {
        return resposta({ ok: false, erro: 'bloqueada' });
      }
      return resposta({ ok: false, erro: 'ia', detalhe: corpo.slice(0, 500) });
    }

    var json = JSON.parse(corpo);
    var item = json.data && json.data[0];
    if (item && item.b64_json) {
      return resposta({ ok: true, imagem: item.b64_json, mime: 'image/png' });
    }
    return resposta({ ok: false, erro: 'ia', detalhe: corpo.slice(0, 500) });
  } catch (erro) {
    return resposta({ ok: false, erro: 'ia', detalhe: String(erro).slice(0, 500) });
  }
}

function contarUso() {
  var trava = LockService.getScriptLock();
  trava.tryLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
    var salvo = {};
    try { salvo = JSON.parse(props.getProperty('usos') || '{}'); } catch (e) {}
    var usos = (salvo.dia === hoje) ? (salvo.usos || 0) : 0;
    props.setProperty('usos', JSON.stringify({ dia: hoje, usos: usos + 1 }));
  } finally {
    trava.releaseLock();
  }
}

function doGet() {
  var props = PropertiesService.getScriptProperties();
  var temChave = !!props.getProperty('AZURE_API_KEY');
  var salvo = {};
  try { salvo = JSON.parse(props.getProperty('usos') || '{}'); } catch (e) {}
  return resposta({
    ok: true,
    servico: 'vire-do-mussaverso-lucas',
    ia: MODELO + ' (Azure)',
    chaveConfigurada: temChave,
    usosHoje: salvo.usos || 0
  });
}

function resposta(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

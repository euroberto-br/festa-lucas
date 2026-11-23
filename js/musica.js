/* ============================================================
   PLAYER GLOBAL DA MÚSICA TEMA — Festa Lucas Nery 7 anos
   Injeta botão flutuante .btn-musica + <audio src="musica/mussa-style.mp3">
   em qualquer página que ainda não tenha seu próprio #btnMusica.
   ============================================================ */
(function () {
  'use strict';
  if (document.getElementById('btnMusica')) return;

  var btn = document.createElement('button');
  btn.className = 'btn-musica';
  btn.id = 'btnMusica';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Tocar música tema da festa do Lucas');
  btn.setAttribute('aria-pressed', 'false');
  btn.title = 'Música tema — Lucas Style (7 anos)';
  btn.textContent = '🎵';
  document.body.appendChild(btn);

  var audio = document.createElement('audio');
  audio.id = 'audioMussa';
  audio.src = 'musica/mussa-style.mp3';
  audio.preload = 'none';
  audio.loop = true;
  document.body.appendChild(audio);

  var tocando = false;

  function atualizaUI() {
    btn.classList.toggle('tocando', tocando);
    btn.setAttribute('aria-pressed', String(tocando));
    btn.textContent = tocando ? '🔊' : '🎵';
  }

  function salvarPosicao() {
    try {
      sessionStorage.setItem('festa-lucas-musica', tocando ? '1' : '0');
      if (audio.currentTime > 0) {
        sessionStorage.setItem('festa-lucas-musica-t', String(Math.floor(audio.currentTime)));
      }
    } catch (e) {}
  }

  btn.addEventListener('click', function () {
    tocando = !tocando;
    atualizaUI();
    if (tocando) {
      var p = audio.play();
      if (p && p.catch) {
        p.catch(function () {
          tocando = false;
          atualizaUI();
        });
      }
    } else {
      audio.pause();
    }
    salvarPosicao();
  });

  window.addEventListener('pagehide', salvarPosicao);

  // Tenta continuar suavemente se o usuário já estava ouvindo em outra página
  try {
    if (sessionStorage.getItem('festa-lucas-musica') === '1') {
      var pos = parseFloat(sessionStorage.getItem('festa-lucas-musica-t') || '0');
      if (pos > 0 && isFinite(pos)) {
        audio.addEventListener('loadedmetadata', function () {
          if (pos < audio.duration - 2) audio.currentTime = pos;
        }, { once: true });
      }
      var auto = audio.play();
      if (auto && auto.then) {
        auto.then(function () {
          tocando = true;
          atualizaUI();
        }).catch(function () {});
      }
    }
  } catch (e) {}
})();

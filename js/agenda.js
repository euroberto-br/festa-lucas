/* ============================================================
   ADICIONAR À AGENDA (.ics + Google Calendar)
   Festa Lucas Nery 7 anos — 12/12/2026 13:00–17:00 BRT
   ============================================================ */
(function () {
  'use strict';

  var GOOGLE_CAL_URL =
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent('Festa de 7 anos do Lucas Nery — Mussa Style! 🎤') +
    '&dates=20261212T160000Z/20261212T200000Z' +
    '&details=' + encodeURIComponent('Festa de 7 anos do Lucas Nery! Pano na cabeça, bonézin pra trás, faz o sinalzinho do L! Site da festa: https://festalucas.roberto.inf.br') +
    '&location=' + encodeURIComponent('Guimi Buffet — Rua Muniz de Souza, 1130, Aclimação, São Paulo - SP, CEP 01534-001');

  function baixarICS() {
    var linhas = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Festa Lucas Nery 7 anos//PT-BR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:festa-lucas-7anos-2026@festalucas.roberto.inf.br',
      'DTSTAMP:20261123T210000Z',
      'DTSTART:20261212T160000Z',
      'DTEND:20261212T200000Z',
      'SUMMARY:Festa de 7 anos do Lucas Nery - Mussa Style!',
      'DESCRIPTION:Festa de 7 anos do Lucas Nery! Guimi Buffet (em frente ao Parque da Aclimacao). Site da festa: https://festalucas.roberto.inf.br',
      'LOCATION:Guimi Buffet - Rua Muniz de Souza\\, 1130\\, Aclimacao\\, Sao Paulo - SP\\, CEP 01534-001',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Faltam 2 horas para a festa de 7 anos do Lucas Nery no Guimi Buffet!',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    var blob = new Blob([linhas.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'festa-lucas-7anos.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  window.FestaAgenda = {
    googleUrl: GOOGLE_CAL_URL,
    baixarICS: baixarICS
  };

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-agenda]');
    if (!btn) return;
    var tipo = btn.getAttribute('data-agenda');
    if (tipo === 'ics') {
      ev.preventDefault();
      baixarICS();
    } else if (tipo === 'google') {
      btn.setAttribute('href', GOOGLE_CAL_URL);
    }
  });

  document.querySelectorAll('a[data-agenda="google"]').forEach(function (a) {
    a.setAttribute('href', GOOGLE_CAL_URL);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
})();

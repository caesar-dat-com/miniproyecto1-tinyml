/* ============================================================================
   landing.js — portada
   Lee las marcas reales de la Libreta (js/game.js) y pinta las medallas.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  /* ---------------------------------------------------------- medallas ---
     Tres estrellas por tarjeta. Cada zona tiene su propio listón: lo que
     mide "progreso" no es lo mismo en recetas que en entrenamiento. */
  function medallas(el, ganadas) {
    if (!el) return;
    el.innerHTML = [0, 1, 2].map(i => `<i class="${i < ganadas ? 'on' : ''}">★</i>`).join('');
  }

  function escalon(valor, listones) {
    return listones.reduce((n, l) => valor >= l ? n + 1 : n, 0);
  }

  function pintar() {
    const r = Libreta.resumen();

    $('#nEstrellas').textContent = r.estrellasTotales;

    // Recetas: cuántas tienen al menos una estrella.
    const conMarca = r.recetas.filter(x => x.marca && x.marca.estrellas > 0).length;
    medallas($('#med-recetas'), escalon(conMarca, [1, 3, 5]));

    // Entrenar: gestos con precisión media decente.
    const gestosOk = r.gestos.filter(g => g.media !== null && g.media >= 0.65).length;
    medallas($('#med-entrenar'), escalon(gestosOk, [1, 3, 5]));

    // Servicio: servicios completados.
    medallas($('#med-jugar'), escalon(r.partidas, [1, 5, 12]));

    // La libreta vacía también se puede consultar; explica cómo empezar.
    const hayDatos = r.partidas > 0 || r.gestos.some(g => g.intentos > 0);
    medallas($('#med-libreta'), hayDatos ? escalon(r.global || 0, [0.4, 0.65, 0.85]) : 0);

    const libreta = $('#platoLibreta');
    libreta.classList.toggle('es-vacia', !hayDatos);
    libreta.querySelector('.plato__candado').hidden = hayDatos;
    libreta.setAttribute('aria-label',
      hayDatos ? 'Libreta, tus marcas' : 'Libreta, todavía sin marcas');

    // Mantener siempre el destino anunciado en la tarjeta.
    libreta.href = 'consola.html#progreso';
  }

  /* --------------------------------------------------------- dónde se sirve --
     El Taller avisa de esto, pero el usuario llega antes aquí: si la portada
     se abrió con doble clic, conviene decirlo antes de que entre al bar y se
     encuentre el Bluetooth apagado sin explicación.

     Chrome marca file:// como contexto seguro y aun así le quita
     navigator.bluetooth, así que isSecureContext por sí solo no detecta el
     caso más probable de la demo. */
  function initOrigen() {
    const fichero = location.protocol === 'file:';
    if (!fichero && window.isSecureContext) return;

    $('#textoPlaca').hidden = true;
    $(fichero ? '#textoFichero' : '#textoHttp').hidden = false;
    $('#puntoPlaca').classList.add('firma__punto--aviso');
  }

  /* ------------------------------------------------------ pantalla completa */
  function initPantalla() {
    const btn = $('#btnPantalla');
    const raiz = document.documentElement;
    const puede = raiz.requestFullscreen || raiz.webkitRequestFullscreen;

    if (!puede) {
      // Safari en iPhone no deja pantalla completa por API. La salida real
      // es «Añadir a pantalla de inicio», que además abre sin barras.
      btn.addEventListener('click', () => {
        alert('En iPhone la pantalla completa se consigue añadiendo MixLab a la pantalla de inicio: Compartir → Añadir a pantalla de inicio.');
      });
      return;
    }

    btn.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
        } else {
          await (raiz.requestFullscreen?.() ?? raiz.webkitRequestFullscreen?.());
        }
      } catch { /* el navegador puede negarlo sin motivo visible */ }
    });
  }

  /* -------------------------------------------------------- hoja de ayuda */
  function initHoja() {
    const hoja = $('#hojaComo');
    const velo = $('#veloHoja');
    const btn  = $('#btnComo');

    let origen = btn;
    const abrir = (si) => {
      if (si) origen = document.activeElement;
      hoja.hidden = !si;
      velo.hidden = !si;
      btn.setAttribute('aria-expanded', String(si));
      document.body.style.overflow = si ? 'hidden' : '';
      if (si) hoja.querySelector('[data-cerrar-hoja]').focus();
      else origen?.focus();
    };

    btn.addEventListener('click', () => abrir(hoja.hidden));
    document.querySelector('[data-help]')?.addEventListener('click', () => abrir(true));
    velo.addEventListener('click', () => abrir(false));
    hoja.querySelector('[data-cerrar-hoja]').addEventListener('click', () => abrir(false));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !hoja.hidden) abrir(false); });
  }

  /* Al volver de la consola la portada sigue en memoria (bfcache): sin esto
     las medallas se quedarían con las marcas de antes de jugar. */
  addEventListener('pageshow', pintar);

  pintar();
  initOrigen();
  initPantalla();
  initHoja();
})();

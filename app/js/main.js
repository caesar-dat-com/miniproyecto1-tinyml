/* ============================================================================
   main.js — la consola: salón (recetas, entrenar, servicio, libreta) y taller
   ========================================================================== */
(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------------------------------------------------------- estado */
  const buffer   = new RingBuffer(6000);
  const recorder = new Recorder();

  let transporte = null;
  let splitter   = null;
  let partida    = null;

  let vista = 'recetas';
  let vistaPrevia = 'recetas';   // a dónde vuelve el botón del taller
  let recetaElegida = RECETAS[0].id;
  let gestoElegido  = CLASES[0].id;
  let ultimaActa    = null;

  let pausado = false;
  let t0Reloj = 0;
  let ultimaInf = null;
  const historia = [];
  const hz = { marcas: [], valor: 0 };

  let lienzoAcc, lienzoGyr;

  const GESTOS = CLASES.filter(c => c.id !== 'reposo');
  const TONO   = ['ambar', 'verde', 'rojo', 'azul', 'morado'];

  const ROTULO = {
    recetas:  ['Recetas',  'La carta de la casa'],
    entrenar: ['Entrenar', 'Un gesto a la vez'],
    jugar:    ['Servicio', 'La receta contra reloj'],
    progreso: ['Libreta',  'Tus marcas'],
    taller:   ['Taller',   'Sensores y dataset'],
  };

  const COACH = {
    welcome:      ['coach-welcome-confident.webp',           'La coach de MixLab te da la bienvenida',              'Elige tu reto',      'Hoy vamos por una marca perfecta.'],
    ready:        ['coach-ready-challenge.webp',              'La coach está lista para comenzar el reto',            '¡En guardia!',       'Firme, preciso y sin perder el ritmo.'],
    enthusiastic: ['coach-guide-enthusiastic.webp',           'La coach presenta la receta con entusiasmo',           'Receta elegida',     'Lee la secuencia antes de servir.'],
    presenting:   ['coach-guide-presenting.webp',             'La coach explica las herramientas disponibles',        'Centro técnico',     'Conecta la placa o practica con el simulador.'],
    calm:         ['coach-guide-calm.webp',                   'La coach explica tus resultados con calma',            'Lee tu combate',     'Tu punto débil indica qué gesto entrenar.'],
    failed:       ['coach-result-failed-one-star-angry.webp', 'La coach reacciona con enfado a un resultado bajo',     '¡Revancha!',         'Respira, corrige el gesto y vuelve a intentarlo.'],
    good:         ['coach-result-good-three-stars.webp',      'La coach aprueba un resultado intermedio',              'Buen servicio',      'Ya tienes técnica; ahora busca consistencia.'],
    perfect:      ['coach-result-perfect-five-stars.webp',    'La coach celebra un resultado excelente',               '¡Perfect mix!',      'Precisión de campeón. Esa ronda fue tuya.'],
  };

  function estadoCoach() {
    if (vista === 'jugar' && ultimaActa) {
      if (ultimaActa.estrellas >= 3) return 'perfect';
      if (ultimaActa.estrellas >= 2) return 'good';
      return 'failed';
    }
    if (vista === 'jugar') return partida ? 'ready' : 'enthusiastic';
    if (vista === 'entrenar') return 'ready';
    if (vista === 'progreso') return 'calm';
    if (vista === 'taller') return 'presenting';
    return 'welcome';
  }

  function pintarCoach() {
    const coach = $('#coach');
    const img = $('#coachImg');
    if (!coach || !img) return;
    const mood = estadoCoach();
    const [archivo, alt, titulo, mensaje] = COACH[mood];
    coach.dataset.mood = mood;
    document.body.dataset.mood = mood;
    img.alt = alt;
    const src = `img/coach/${archivo}`;
    if (!img.src.endsWith(src)) img.src = src;
    const bubble = $('#coachBubble');
    if (bubble) bubble.innerHTML = `<b>${esc(titulo)}</b><span>${esc(mensaje)}</span>`;
  }

  /* ==========================================================================
     NAVEGACIÓN
     ======================================================================== */
  function irA(v) {
    // Salir de una partida a medias la abandona: dejar el temporizador
    // corriendo bajo otra vista falsearía la precisión.
    if (partida?.viva && v !== 'jugar') { partida.abandonar(); partida = null; }

    vista = v;
    document.body.dataset.view = v;
    $$('.vista').forEach(el => el.classList.toggle('es-activa', el.dataset.vista === v));

    const [t, n] = ROTULO[v] || ROTULO.recetas;
    $('#tituloTxt').textContent = v === 'jugar' && recetaPorId.get(recetaElegida)
      ? recetaPorId.get(recetaElegida).nombre : t;
    $('#tituloNota').textContent = n;

    $('#btnTaller').setAttribute('aria-pressed', String(v === 'taller'));
    if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);

    pintarVista();
    pintarCoach();

    if (v === 'taller') {
      // El canvas mide 0 mientras la vista está oculta: hay que remedirlo.
      requestAnimationFrame(() => {
        lienzoAcc?._medir(); lienzoGyr?._medir();
        lienzoAcc?.draw();   lienzoGyr?.draw();
      });
    }
  }

  function initNavegacion() {
    $('#btnAtras').addEventListener('click', () => {
      if (partida?.viva) { partida.abandonar(); partida = null; irA('jugar'); return; }
      if (vista === 'taller' || vista === 'jugar') { irA('recetas'); return; }
      location.href = 'index.html';
    });

    // Entrar al taller y volver debe devolverte donde estabas, no al principio.
    $('#btnTaller').addEventListener('click', () => {
      if (vista === 'taller') { irA(vistaPrevia); return; }
      vistaPrevia = vista;
      irA('taller');
    });

    $$('[data-pest]').forEach(p => {
      p.addEventListener('click', () => {
        $$('[data-pest]').forEach(x => { x.classList.remove('es-activa'); x.setAttribute('aria-selected', 'false'); });
        p.classList.add('es-activa');
        p.setAttribute('aria-selected', 'true');
        $$('.panel-t').forEach(x => x.classList.remove('es-activa'));
        $(`#p-${p.dataset.pest}`).classList.add('es-activa');
        requestAnimationFrame(() => {
          lienzoAcc?._medir(); lienzoGyr?._medir();
          lienzoAcc?.draw();   lienzoGyr?.draw();
        });
      });
    });
  }

  /* ==========================================================================
     VISTAS
     ======================================================================== */
  function pintarVista() {
    if (vista === 'recetas')  pintarRecetas();
    if (vista === 'entrenar') pintarEntrenar();
    if (vista === 'jugar')    pintarJugar();
    if (vista === 'progreso') pintarProgreso();
  }

  const icono = (path) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
  const ICON = {
    play: icono('m9 7 8 5-8 5z'),
    stop: icono('M7 7h10v10H7z'),
    repeat: icono('M17 7h3v-3M20 7a8 8 0 1 0 1 7M7 17H4v3M4 17a8 8 0 0 0 1-7'),
    menu: icono('M4 6h16M4 12h16M4 18h16'),
    target: icono('M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l7-7'),
    trash: icono('M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6'),
    pause: icono('M8 5v14M16 5v14'),
    table: icono('M4 5h16v14H4zM4 10h16M10 5v14'),
    record: icono('M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z'),
    download: icono('M12 3v12M8 11l4 4 4-4M5 20h14'),
    close: icono('m6 6 12 12M18 6 6 18'),
  };
  const boton = (ico, texto) => `${ICON[ico] || ''}<span>${esc(texto)}</span>`;
  const ICON_COPA = icono('M4 3h16l-8 9zM12 12v7M8 21h8');
  const COPA = {
    mojito: icono('M5 4c7 0 11 4 11 11-7 0-11-4-11-11zm3 3 9 10M18 3v18'),
    daiquiri: icono('M4 3h16l-8 9zM12 12v7M8 21h8M15 4l4-3'),
    negroni: icono('M5 5h14l-1 16H6zm2 5h10M15 3l4 4'),
    'old-fashioned': icono('M5 6h14l-2 15H7zm1 7h12M15 4l4 3'),
    margarita: icono('M3 4h18l-9 9zM12 13v6M8 21h8M5 2h14'),
  };

  function pintarRecetas() {
    const d = Libreta.resumen();
    $('#rejillaRecetas').innerHTML = d.recetas.map((r, i) => `
      <button class="plato plato--${TONO[r.grado - 1] || 'ambar'} ${r.id === recetaElegida ? 'es-elegida' : ''}"
              type="button" data-receta="${r.id}">
        <span class="plato__medallas" aria-hidden="true">${medallas(r.marca ? r.marca.estrellas : 0)}</span>
        <span class="plato__ico" aria-hidden="true">${COPA[r.id] || ICON_COPA}</span>
        <span class="plato__nombre">${esc(r.nombre)}</span>
        <span class="plato__nota">${esc(r.nota)}</span>
        <span class="plato__grados" aria-label="Dificultad ${r.grado} de 3">${'◆'.repeat(r.grado)}<span class="apagado">${'◆'.repeat(3 - r.grado)}</span></span>
      </button>`).join('');
  }

  function medallas(n) {
    return [0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}">★</i>`).join('');
  }

  const MANO = {
    agitar: icono('M4 8h16M4 8l3-3M4 8l3 3M20 16H4M20 16l-3-3M20 16l-3 3'),
    remover: icono('M18 7a7 7 0 1 0 1 8M18 3v4h-4'),
    servir: icono('m5 5 10 2-3 11-7-2zM15 7l4 3M18 13c0 2-2 3-2 5'),
    macerar: icono('M12 3v13M8 12h8M9 21h6M7 16h10'),
    colar: icono('M5 5h14l-7 8zM12 13v7M8 5l2 3M12 5v4M16 5l-2 3'),
  };

  function pintarEntrenar() {
    const d = Libreta.resumen();
    $('#rejillaGestos').innerHTML = GESTOS.map((c, i) => {
      const g = d.gestos.find(x => x.id === c.id);
      const nota = g && g.media !== null ? `${Math.round(g.media * 100)} % de acierto` : c.desc;
      return `<button class="plato plato--${TONO[i % TONO.length]} ${c.id === gestoElegido ? 'es-elegida' : ''}"
                      type="button" data-gesto="${c.id}">
        <span class="plato__medallas" aria-hidden="true">${medallas(g && g.media !== null ? escalon(g.media) : 0)}</span>
        <span class="plato__ico" aria-hidden="true">${MANO[c.id] || ICON_COPA}</span>
        <span class="plato__nombre">${esc(c.label)}</span>
        <span class="plato__nota">${esc(nota)}</span>
      </button>`;
    }).join('');

    $('#demoEntrenar').innerHTML = cajaDemo();
    $('#btnEntrenar').disabled = !transporte;
    $('#btnEntrenar').innerHTML = transporte
      ? boton('target', 'Empezar práctica')
      : boton('target', 'Conecta la placa en el Taller');
  }

  function escalon(v) { return v >= 0.85 ? 3 : v >= 0.65 ? 2 : v >= 0.4 ? 1 : 0; }

  /* Con el simulador no hay muñeca que mover: estos botones cambian el gesto
     que la "placa" está fingiendo, para poder jugar y enseñar el flujo. */
  function cajaDemo() {
    if (transporte?.nombre !== 'sim') return '';
    return `<div class="demo">
      <p class="demo__txt">Modo simulador — elige qué gesto está haciendo la coctelera</p>
      <div class="demo__fila">
        ${GESTOS.map(c => `<button class="pieza" type="button" data-simgesto="${c.id}"
          aria-pressed="${transporte.gesto === c.id}">${esc(c.label)}</button>`).join('')}
      </div>
    </div>`;
  }

  /* ---------------------------------------------------------------- jugar */
  const RADIO = 52;
  const VUELTA = 2 * Math.PI * RADIO;

  function pintarJugar() {
    const lienzo = $('#lienzoJugar');
    const zocalo = $('#zocaloJugar');
    const r = recetaPorId.get(recetaElegida);

    // Basta con que exista la partida: 'viva' no se enciende hasta arrancar(),
    // y la pantalla tiene que estar montada antes de eso.
    if (partida) {
      lienzo.innerHTML = pantallaJuego(partida.receta);
      zocalo.innerHTML = `<button class="grande grande--suave" type="button" data-abandonar>${boton('stop', 'Abandonar')}</button>`;
      refrescarLista();
      return;
    }

    if (ultimaActa) {
      lienzo.innerHTML = `
        <div class="acta">
          <div class="acta__estrellas">${pintarEstrellas(ultimaActa.estrellas)}</div>
          <p class="acta__pts">${ultimaActa.puntos}</p>
          <p class="acta__pie">${Math.round(ultimaActa.precision * 100)} % de precisión</p>
          <div class="acta__barras barras">
            ${ultimaActa.pasos.map(p => {
              const c = CLASES.find(x => x.id === p.clase);
              return barra(c ? c.label : p.clase, p.precision);
            }).join('')}
          </div>
        </div>`;
      zocalo.innerHTML = `
        <button class="grande grande--suave" type="button" data-ir="recetas" style="flex:0 0 auto">${boton('menu', 'Carta')}</button>
        <button class="grande" type="button" data-servir>${boton('repeat', 'Repetir')}</button>`;
      return;
    }

    lienzo.innerHTML = `
      <div class="juego">
        ${transporte ? '' : '<div class="nota nota--aviso panel">Sin placa no hay juego: el modelo corre en el Arduino y la app solo lee lo que él decide. Conecta desde el <b>Taller</b>, o arranca el <b>simulador</b>.</div>'}
        <h2 class="juego__gesto">${esc(r.nombre)}</h2>
        <p class="juego__texto">${esc(r.nota)}</p>
        <ol class="receta">
          ${r.pasos.map((p, k) => filaPaso(p, k)).join('')}
        </ol>
        ${cajaDemo()}
      </div>`;
    zocalo.innerHTML = `<button class="grande" type="button" data-servir ${transporte ? '' : 'disabled'}>${boton('play', 'Servir')}</button>`;
  }

  function filaPaso(p, k, clase = '') {
    const c = CLASES.find(x => x.id === p.clase);
    return `<li class="${clase}">
      <span class="receta__n">${k + 1}</span>
      <span><b>${esc(c ? c.label : p.clase)}</b> · ${esc(p.texto)}</span>
      <time>${p.seg} s</time>
    </li>`;
  }

  function pantallaJuego(receta) {
    return `
      <div class="juego">
        <div class="juego__cabeza">
          <p class="juego__paso" id="jPaso">—</p>
          <h2 class="juego__gesto" id="jGesto">—</h2>
          <p class="juego__texto" id="jTexto"></p>
        </div>

        <div class="aro" id="jAro">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="aro__via"   cx="60" cy="60" r="${RADIO}"/>
            <circle class="aro__linea" id="jAroLinea" cx="60" cy="60" r="${RADIO}"
                    stroke-dasharray="${VUELTA.toFixed(1)}" stroke-dashoffset="0"/>
          </svg>
          <div class="aro__centro">
            <span class="aro__n" id="jCrono">0.0</span>
            <span class="aro__u">segundos</span>
          </div>
        </div>

        <div class="medidor" id="medidor">
          <div class="medidor__marco"><div class="medidor__liquido" id="medidorLiquido"></div></div>
          <div class="medidor__pie"><span id="medidorQue">confianza</span><b id="medidorNum">0 %</b></div>
        </div>

        <div class="pasos" id="jPasos"></div>
        <ol class="receta" id="jLista">${receta.pasos.map((p, k) => filaPaso(p, k)).join('')}</ol>
        ${cajaDemo()}
      </div>`;
  }

  function refrescarLista() {
    if (!partida) return;
    $$('#jLista li').forEach((li, k) => {
      li.classList.toggle('es-hecho',  k < partida.idx);
      li.classList.toggle('es-actual', k === partida.idx);
    });
    const pasos = $('#jPasos');
    if (pasos) {
      pasos.innerHTML = partida.receta.pasos.map((_, k) =>
        `<span class="pasos__pieza ${k < partida.idx ? 'es-hecho' : k === partida.idx ? 'es-actual' : ''}"></span>`).join('');
    }
  }

  function barra(etiqueta, v) {
    const pct = Math.round(v * 100);
    return `<div class="barra ${v < 0.5 ? 'es-flojo' : ''}">
      <span>${esc(etiqueta)}</span>
      <span class="barra__via"><span class="barra__lleno" style="width:${pct}%"></span></span>
      <span class="barra__n">${pct}%</span>
    </div>`;
  }

  /* -------------------------------------------------------------- libreta */
  function pintarProgreso() {
    const r = Libreta.resumen();
    const lienzo = $('#lienzoProgreso');

    if (!r.partidas && r.gestos.every(g => !g.intentos)) {
      lienzo.innerHTML = '<p class="vacio">La libreta está en blanco.<br>Sirve tu primer cóctel.</p>';
      $('#zocaloProgreso').innerHTML = `<button class="grande" type="button" data-ir="recetas">${boton('menu', 'Ver la carta')}</button>`;
      return;
    }

    lienzo.innerHTML = `
      <div class="cifra">
        <span class="cifra__n">${Math.round((r.global || 0) * 100)}%</span>
        <span class="cifra__pie">precisión media en ${r.partidas} servicio${r.partidas === 1 ? '' : 's'}</span>
        <p class="estrellas" style="margin:10px 0 0">${r.estrellasTotales} / ${r.estrellasPosibles} ★</p>
        ${r.flojo ? `<p class="cifra__pie" style="margin-top:8px">Tu punto flaco: <b>${esc(r.flojo.label)}</b> (${Math.round(r.flojo.media * 100)} %)</p>` : ''}
      </div>

      <span class="rotulo">Precisión por gesto</span>
      <div class="barras">
        ${r.gestos.map(g => g.media === null
          ? `<div class="barra"><span>${esc(g.label)}</span><span class="barra__via"></span><span class="barra__n">—</span></div>`
          : barra(g.label, g.media)).join('')}
      </div>

      <span class="rotulo">Marcas</span>
      <table class="marcas">
        <thead><tr><th>Cóctel</th><th>Estrellas</th><th>Mejor</th></tr></thead>
        <tbody>
          ${r.recetas.map(x => `<tr>
            <td>${esc(x.nombre)}</td>
            <td class="es">${x.marca ? pintarEstrellas(x.marca.estrellas) : '<span class="apagada">★★★</span>'}</td>
            <td>${x.marca ? x.marca.mejorPts : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;

    $('#zocaloProgreso').innerHTML =
      `<button class="grande grande--suave" type="button" data-borrar-libreta>${boton('trash', 'Borrar la libreta')}</button>`;
  }

  /* ==========================================================================
     ACCIONES
     ======================================================================== */
  function initAcciones() {
    document.addEventListener('click', (e) => {
      const ir = e.target.closest('[data-ir]');
      if (ir) { irA(ir.dataset.ir); return; }

      const rec = e.target.closest('[data-receta]');
      if (rec) { recetaElegida = rec.dataset.receta; pintarRecetas(); abrirHoja(true); return; }

      const ges = e.target.closest('[data-gesto]');
      if (ges) { gestoElegido = ges.dataset.gesto; pintarEntrenar(); return; }

      const sim = e.target.closest('[data-simgesto]');
      if (sim) {
        transporte?.setGesto?.(sim.dataset.simgesto);
        $$('[data-simgesto]').forEach(b => b.setAttribute('aria-pressed', String(b === sim)));
        return;
      }

      if (e.target.closest('[data-servir]'))    { abrirHoja(false); empezarPartida(recetaPorId.get(recetaElegida)); return; }
      if (e.target.closest('[data-abandonar]')) { partida?.abandonar(); partida = null; ultimaActa = null; irA('jugar'); return; }

      if (e.target.closest('[data-borrar-libreta]')) {
        if (!confirm('¿Borrar todas tus marcas? No se puede deshacer.')) return;
        Libreta.borrar();
        ultimaActa = null;
        pintarProgreso();
        recado('Libreta en blanco');
      }
    });

    $('#btnEntrenar').addEventListener('click', () => {
      if (partida?.viva) { partida.abandonar(); partida = null; pintarEntrenar(); return; }
      empezarPartida(recetaDePractica(gestoElegido, 10));
    });

    /* --- hoja de receta --- */
    $('#veloHoja').addEventListener('click', () => abrirHoja(false));
    $('[data-cerrar-hoja]').addEventListener('click', () => abrirHoja(false));
    addEventListener('keydown', (e) => { if (e.key === 'Escape') abrirHoja(false); });
  }

  function abrirHoja(si) {
    const hoja = $('#hojaReceta');
    if (si) {
      const r = recetaPorId.get(recetaElegida);
      const total = r.pasos.reduce((a, p) => a + p.seg, 0);
      $('#hojaTitulo').textContent = r.nombre;
      $('#hojaNota').textContent = `${r.nota} · ${total} s en total`;
      $('#hojaPasos').innerHTML = r.pasos.map((p, k) => filaPaso(p, k)).join('');
      $('#btnServirHoja').disabled = !transporte;
      $('#btnServirHoja').innerHTML = transporte ? boton('play', 'Servir') : boton('play', 'Conecta la placa');
    }
    hoja.hidden = !si;
    $('#veloHoja').hidden = !si;
    if (si) $('#btnServirHoja').focus();
  }

  function empezarPartida(receta) {
    if (!transporte) { recado('Conecta la placa o arranca el simulador'); return; }

    ultimaActa = null;
    partida = new Partida(receta, {
      onPaso: (p, i, total) => {
        const c = CLASES.find(x => x.id === p.clase);
        if ($('#jGesto')) $('#jGesto').textContent = c ? c.label : p.clase;
        if ($('#jTexto')) $('#jTexto').textContent = p.texto;
        if ($('#jPaso'))  $('#jPaso').textContent = receta.practica ? 'Practica' : `Paso ${i + 1} de ${total}`;
        refrescarLista();
      },

      onTick: (t) => {
        const crono = $('#jCrono');
        if (crono) crono.textContent = t.restanteS.toFixed(1);

        const linea = $('#jAroLinea');
        if (linea) {
          // El aro se vacía con el tiempo: el hueco crece según lo gastado.
          const gastado = 1 - (t.restanteS / t.paso.seg);
          linea.style.strokeDashoffset = (VUELTA * gastado).toFixed(1);
        }
        $('#jAro')?.classList.toggle('es-poco', t.restanteS < 2);

        moverMedidor(t.conf, t.acierto, t.acierto ? '¡así!' : (t.detectado ? 'otro gesto' : 'sin señal'));
      },

      onFin: (acta) => {
        partida = null;
        ultimaActa = acta;
        if (receta.practica) {
          recado(`${acta.nombre}: ${Math.round(acta.precision * 100)} % de precisión`);
          ultimaActa = null;
          irA('entrenar');
        } else {
          recado(`${acta.puntos} puntos · ${acta.estrellas} estrella${acta.estrellas === 1 ? '' : 's'}`);
          irA('jugar');
        }
      },
    });

    // Montar la pantalla ANTES de arrancar: arrancar() dispara onPaso de
    // inmediato, y si el DOM no está el primer gesto se queda sin pintar.
    irA('jugar');
    partida.arrancar();
  }

  function moverMedidor(conf, bien, etiqueta) {
    const liq = $('#medidorLiquido');
    if (!liq) return;
    liq.style.width = `${Math.round(conf * 100)}%`;
    $('#medidor')?.classList.toggle('es-bueno', Boolean(bien));
    const num = $('#medidorNum');
    if (num) num.textContent = `${Math.round(conf * 100)} %`;
    const que = $('#medidorQue');
    if (que && etiqueta) que.textContent = etiqueta;
  }

  /* ==========================================================================
     CONEXIÓN
     ======================================================================== */
  function initConexion() {
    if (!window.isSecureContext) $('#avisoSeguro').hidden = false;
    if (!BleTransport.soportado)    marcarSinSoporte('ble');
    if (!SerialTransport.soportado) marcarSinSoporte('serial');
    if (location.protocol === 'https:') $('#avisoMixto').hidden = false;

    $('#simGesto').innerHTML = CLASES.map(c => `<option value="${c.id}">${esc(c.label)} — ${esc(c.desc)}</option>`).join('');
    $$('[data-conectar]').forEach(b => b.addEventListener('click', () => conectar(b.dataset.conectar)));
    $('#chapaPlaca').addEventListener('click', () => { if (transporte) desconectar(); else irA('taller'); });
    $$('[data-modo]').forEach(b => b.addEventListener('click', () => pedirModo(b.dataset.modo)));
  }

  /* Pide a la placa que cambie de modo: 'i' inferencia, 's' señal cruda.
     Solo el sketch nano33ble_mixlab_inferencia entiende estos comandos; los
     demás transportes devuelven false y aquí se dice sin drama. */
  async function pedirModo(m) {
    const pista = $('#modoPista');
    if (!transporte) { if (pista) pista.textContent = 'Conecta la placa primero.'; return; }
    const ok = await transporte.send(m);
    if (pista) {
      pista.textContent = ok
        ? (m === 'i' ? 'Pedido: inferencia.' : 'Pedido: señal cruda a 50 Hz.')
        : 'Esta fuente no acepta comandos.';
    }
  }

  function marcarSinSoporte(t) {
    const card = $(`[data-enchufe="${t}"]`);
    card.classList.add('es-muerta');
    card.querySelector('[data-sin-soporte]').hidden = false;
    card.querySelector('[data-conectar]').disabled = true;
  }

  async function conectar(tipo) {
    if (transporte) await desconectar();

    try {
      switch (tipo) {
        case 'ble':    transporte = new BleTransport(); break;
        case 'wifi':   transporte = new WifiTransport($('#wsUrl').value.trim()); break;
        case 'serial': transporte = new SerialTransport(115200); break;
        default:       transporte = new SimTransport($('#simGesto').value, 100);
      }

      splitter = new LineSplitter(procesarLinea);
      transporte.onText(txt => splitter.push(txt));
      transporte.onState(pintarEstado);

      await transporte.connect();

      buffer.clear();
      hz.marcas.length = 0;
      t0Reloj = performance.now();

      $$('.enchufe').forEach(c => c.classList.toggle('es-viva', c.dataset.enchufe === tipo));
      $('#btnGrabar').disabled = false;
      $('#pistaGrabar').textContent = 'Listo para grabar.';
      recado('Placa conectada');
      pintarVista();

    } catch (err) {
      transporte = null;
      // Cerrar el diálogo del navegador no es un error que reportar.
      const cancelado = err?.name === 'NotFoundError' || /User cancelled|cancelad/i.test(err?.message || '');
      pintarEstado(cancelado ? 'off' : 'err', cancelado ? 'Sin placa' : (err.message || 'Falló'));
      if (!cancelado) recado(err.message || 'No se pudo conectar');
    }
  }

  async function desconectar() {
    try { await transporte?.disconnect(); } catch {}
    transporte = null;
    splitter?.reset();
    recorder.cancelar();
    partida?.abandonar();
    partida = null;
    $$('.enchufe').forEach(c => c.classList.remove('es-viva'));
    $('#btnGrabar').disabled = true;
    $('#pistaGrabar').textContent = 'Conecta una fuente para empezar.';
    pintarEstado('off', 'Sin placa');
    pintarVista();
  }

  const LUZ = { on: '🟢', wait: '🟡', err: '🔴', off: '⚫' };

  function pintarEstado(estado, msg) {
    $('#chapaPunto').textContent = LUZ[estado] || LUZ.off;
    // En la chapa cabe poco: el mensaje largo va al title, no cortado.
    $('#chapaTxt').textContent = estado === 'on' ? 'Conectada' : msg;
    $('#chapaPlaca').title = msg;
  }

  /* ==========================================================================
     ENTRADA DE DATOS
     ======================================================================== */
  function procesarLinea(linea) {
    const m = parseLine(linea);
    if (!m) return;

    if (m.tipo === 'hola') { pintarEstado('on', `${m.placa}${m.hz ? ` · ${m.hz} Hz` : ''}`); return; }

    if (m.tipo === 'inferencia') {
      partida?.alimentar(m);
      pintarInferencia(m);
      // Fuera de partida, el medidor de «entrenar» sigue vivo como espejo.
      if (!partida?.viva && vista === 'entrenar') {
        const suyo = m.clase === gestoElegido;
        moverMedidor(suyo ? m.confianza : 0, suyo && m.confianza >= UMBRAL_CONF, suyo ? 'confianza' : 'otro gesto');
      }
      return;
    }

    if (m.t === null || !Number.isFinite(m.t)) m.t = performance.now() - t0Reloj;

    buffer.push(m);
    recorder.alimentar(m);

    const ahora = performance.now();
    hz.marcas.push(ahora);
    while (hz.marcas.length && ahora - hz.marcas[0] > 1000) hz.marcas.shift();
    hz.valor = hz.marcas.length;
  }

  /* ==========================================================================
     TALLER — gráficas
     ======================================================================== */
  function initGraficas() {
    lienzoAcc = new StreamChart($('#lienzoAcc'), { unidad: 'g',   decimales: 2, readout: $('#readoutAcc') });
    lienzoGyr = new StreamChart($('#lienzoGyr'), { unidad: '°/s', decimales: 1, readout: $('#readoutGyr') });

    pintarLeyenda($('#leyendaAcc'), 'acc');
    pintarLeyenda($('#leyendaGyr'), 'gyr');

    $('#btnPausa').addEventListener('click', (e) => {
      pausado = !pausado;
      e.currentTarget.setAttribute('aria-pressed', String(pausado));
      e.currentTarget.innerHTML = pausado ? boton('play', 'Reanudar') : boton('pause', 'Pausar');
    });

    $('#btnTabla').addEventListener('click', (e) => {
      const ver = $('#tablaVivo').hidden;
      $('#tablaVivo').hidden = !ver;
      e.currentTarget.setAttribute('aria-pressed', String(ver));
      e.currentTarget.innerHTML = boton('table', ver ? 'Ocultar tabla' : 'Ver tabla');
    });

    requestAnimationFrame(bucle);
  }

  function pintarLeyenda(cont, pre) {
    cont.innerHTML = SERIES.map(s => `
      <span class="leyenda__it">
        <span class="leyenda__pastilla" style="background:var(${s.varName})"></span>
        Eje ${s.label}
        <span class="leyenda__v" id="${pre}${s.label}">—</span>
      </span>`).join('');
  }

  let ultimoDibujo = 0;
  function bucle(ts) {
    requestAnimationFrame(bucle);
    if (ts - ultimoDibujo < 33) return;          // 30 fps bastan
    ultimoDibujo = ts;

    if (vista !== 'taller' || pausado) return;
    if (!$('#p-vivo').classList.contains('es-activa')) return;

    const ventana = Number($('#selVentana').value) * 1000;
    const ult = buffer.last();
    if (!ult) { lienzoAcc.draw(); lienzoGyr.draw(); return; }

    const ms = buffer.since(ult.t - ventana);
    lienzoAcc.setDatos(ms.map(m => ({ t: m.t, v: [m.ax, m.ay, m.az] })), ventana);
    lienzoGyr.setDatos(ms.map(m => ({ t: m.t, v: [m.gx, m.gy, m.gz] })), ventana);
    lienzoAcc.draw();
    lienzoGyr.draw();

    $('#nMuestras').textContent = buffer.n.toLocaleString('es-CO');
    $('#nHz').textContent  = hz.valor;
    $('#nAcc').textContent = magnitud(ult.ax, ult.ay, ult.az).toFixed(2);
    $('#nGyr').textContent = magnitud(ult.gx, ult.gy, ult.gz).toFixed(0);

    $('#accX').textContent = ult.ax.toFixed(2);
    $('#accY').textContent = ult.ay.toFixed(2);
    $('#accZ').textContent = ult.az.toFixed(2);
    $('#gyrX').textContent = ult.gx.toFixed(0);
    $('#gyrY').textContent = ult.gy.toFixed(0);
    $('#gyrZ').textContent = ult.gz.toFixed(0);

    if (!$('#tablaVivo').hidden) pintarTabla();
  }

  function pintarTabla() {
    const filas = [];
    for (let i = buffer.length - 1; i >= Math.max(0, buffer.length - 12); i--) {
      const m = buffer.at(i);
      filas.push(`<tr><td>${m.t.toFixed(0)}</td>
        <td>${m.ax.toFixed(3)}</td><td>${m.ay.toFixed(3)}</td><td>${m.az.toFixed(3)}</td>
        <td>${m.gx.toFixed(1)}</td><td>${m.gy.toFixed(1)}</td><td>${m.gz.toFixed(1)}</td></tr>`);
    }
    $('#cuerpoTablaVivo').innerHTML = filas.join('');
  }

  /* ==========================================================================
     TALLER — grabador
     ======================================================================== */
  function initGrabador() {
    $('#recClase').innerHTML = CLASES.map(c => `<option value="${c.id}">${esc(c.label)} — ${esc(c.desc)}</option>`).join('');

    recorder.onCambio = ({ aviso }) => { if (aviso) recado(aviso); pintarTomas(); };
    recorder.onTick = pintarTablado;

    $('#btnGrabar').addEventListener('click', async () => {
      if (recorder.activa) { recorder.cancelar(); return; }
      if (!transporte) { recado('Conecta una fuente primero'); return; }

      $('#btnGrabar').innerHTML = boton('close', 'Cancelar');
      try {
        const take = await recorder.grabar({
          clase: $('#recClase').value,
          duracionS: Math.max(1, Number($('#recDur').value) || 3),
          cuentaAtrasS: Math.max(0, Number($('#recEspera').value) || 0),
          quien: $('#recQuien').value.trim(),
          hz: hz.valor || 100,
        });
        if (take) recado(`Toma guardada · ${take.n} muestras a ${take.hzReal} Hz`);
      } finally {
        $('#btnGrabar').innerHTML = boton('record', 'Grabar toma');
      }
    });

    $('#btnCsv').addEventListener('click',  () => exportarTakes(recorder.takes, 'csv'));
    $('#btnJson').addEventListener('click', () => exportarTakes(recorder.takes, 'json'));

    $('#btnBorrarTomas').addEventListener('click', () => {
      if (!confirm(`¿Borrar las ${recorder.takes.length} tomas guardadas? No se puede deshacer.`)) return;
      recorder.borrarTodas();
      recado('Tomas borradas');
    });

    $('#tomas').addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) { recorder.borrar(del.dataset.del); return; }
      const dl = e.target.closest('[data-dl]');
      if (dl) {
        const t = recorder.takes.find(x => x.id === dl.dataset.dl);
        if (t) exportarTakes([t], 'csv');
      }
    });

    pintarTomas();
  }

  function pintarTablado(ev) {
    const caja = $('#tablado');
    caja.classList.toggle('es-contando', ev.fase === 'cuenta');
    caja.classList.toggle('es-grabando', ev.fase === 'grabando');

    if (ev.fase === 'cuenta') {
      $('#tabladoN').textContent = Math.ceil(ev.restante);
      $('#tabladoT').textContent = 'Prepárate…';
      $('#tabladoLleno').style.width = `${ev.progreso * 100}%`;
    } else if (ev.fase === 'grabando') {
      $('#tabladoN').textContent = ev.restante.toFixed(1);
      $('#tabladoT').textContent = `Grabando · ${ev.n} muestras`;
      $('#tabladoLleno').style.width = `${ev.progreso * 100}%`;
    } else {
      $('#tabladoN').textContent = ev.fase === 'lista' ? '✓' : '—';
      $('#tabladoT').textContent =
          ev.fase === 'lista'     ? `${ev.take.n} muestras · ${ev.take.hzReal} Hz`
        : ev.fase === 'vacia'     ? 'No llegó ninguna muestra. ¿Sigue conectada la placa?'
        : ev.fase === 'cancelada' ? 'Cancelada'
        : 'Sin grabar';
      $('#tabladoLleno').style.width = '0%';
      if (ev.fase === 'lista') pintarTomas();
    }
  }

  function pintarTomas() {
    const takes = recorder.takes;
    $('#nTomas').textContent = takes.length;
    $('#tomasVacio').hidden = takes.length > 0;
    $('#btnCsv').disabled = !takes.length;
    $('#btnJson').disabled = !takes.length;
    $('#btnBorrarTomas').hidden = !takes.length;

    const conteo = recorder.conteoPorClase();
    const max = Math.max(1, ...Object.values(conteo));
    $('#equilibrio').innerHTML = CLASES.map(c => {
      const n = conteo[c.id];
      // Menos de un tercio de la clase más grande: el dataset va torcido.
      const flaca = n < max / 3;
      return `<div class="barra ${flaca ? 'es-flojo' : ''}">
        <span>${esc(c.label)}</span>
        <span class="barra__via"><span class="barra__lleno" style="width:${(n / max) * 100}%"></span></span>
        <span class="barra__n">${n}</span>
      </div>`;
    }).join('');

    $('#tomas').innerHTML = takes.slice().reverse().map(t => {
      const label = CLASES.find(c => c.id === t.clase)?.label || t.clase;
      const hora = new Date(t.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
      return `<div class="panel toma">
        <div>
          <div class="toma__n">${esc(label)} · ${esc(t.quien)}</div>
          <div class="toma__m">${t.n} muestras · ${(t.duracionMs / 1000).toFixed(1)} s · ${t.hzReal} Hz · ${hora}</div>
        </div>
        <button class="pieza" type="button" data-dl="${t.id}">${ICON.download}<span>CSV</span></button>
        <button class="toma__x" type="button" data-del="${t.id}" aria-label="Borrar toma">${ICON.trash}</button>
      </div>`;
    }).join('');
  }

  /* ==========================================================================
     TALLER — inferencia
     ======================================================================== */
  function pintarInferencia(m) {
    ultimaInf = { ...m, ts: Date.now() };
    const label = CLASES.find(c => c.id === m.clase)?.label || m.clase;

    $('#infClase').textContent = label;
    $('#infConf').textContent = `${Math.round(m.confianza * 100)} %`;
    $('#infLleno').style.width = `${m.confianza * 100}%`;
    $('#medidorTaller').classList.toggle('es-bueno', m.confianza >= UMBRAL_CONF);

    historia.unshift({ label, conf: m.confianza, ts: Date.now() });
    historia.length = Math.min(historia.length, 40);

    $('#infVacio').hidden = true;
    $('#infHistoria').innerHTML = historia.map(h =>
      `<li><span>${esc(h.label)}</span>
           <span><b>${Math.round(h.conf * 100)} %</b>
           <time>${new Date(h.ts).toLocaleTimeString('es-CO')}</time></span></li>`
    ).join('');
  }

  setInterval(() => {
    if (!ultimaInf) return;
    const s = (Date.now() - ultimaInf.ts) / 1000;
    $('#infEdad').textContent = s < 2 ? 'ahora mismo' : `hace ${s.toFixed(0)} s`;
  }, 1000);

  /* ==========================================================================
     VARIOS
     ======================================================================== */
  let recadoTimer;
  function recado(txt) {
    const el = $('#recado');
    el.textContent = txt;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('es-visible'));
    clearTimeout(recadoTimer);
    recadoTimer = setTimeout(() => {
      el.classList.remove('es-visible');
      setTimeout(() => { el.hidden = true; }, 200);
    }, 2400);
  }

  addEventListener('beforeunload', () => { try { transporte?.disconnect(); } catch {} });

  function init() {
    initNavegacion();
    initAcciones();
    initConexion();
    initGraficas();
    initGrabador();

    // La portada enlaza a consola.html#recetas, #jugar, #taller…
    const destino = (location.hash || '').replace('#', '');
    irA(['recetas', 'entrenar', 'jugar', 'progreso', 'taller'].includes(destino) ? destino : 'recetas');
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();

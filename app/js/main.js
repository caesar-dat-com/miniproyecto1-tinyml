/* ============================================================================
   main.js — cableado del salón (consola) y del taller (banco de trabajo)
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

  let vista = 'menu';
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

  /* ==========================================================================
     NAVEGACIÓN DEL SALÓN
     ======================================================================== */
  function irA(v) {
    // Salir de una partida a medias la abandona: dejar el temporizador
    // corriendo bajo otra vista falsearía la precisión.
    if (partida?.viva && v !== 'jugar' && v !== 'entrenar') {
      partida.abandonar();
      partida = null;
    }
    vista = v;
    $$('.vista').forEach(el => el.classList.toggle('es-activa', el.dataset.vista === v));
    pintarVista();
    pintarHud();
  }

  function initNavegacion() {
    document.addEventListener('click', (e) => {
      const ir = e.target.closest('[data-ir]');
      if (ir) { irA(ir.dataset.ir); return; }

      if (e.target.closest('[data-taller]'))       { abrirTaller(true);  return; }
      if (e.target.closest('[data-salir-taller]')) { abrirTaller(false); return; }
    });

    $$('.pest').forEach(p => {
      p.addEventListener('click', () => {
        $$('.pest').forEach(x => { x.classList.remove('es-activa'); x.setAttribute('aria-selected', 'false'); });
        p.classList.add('es-activa');
        p.setAttribute('aria-selected', 'true');
        $$('.panel').forEach(x => x.classList.remove('es-activa'));
        $(`#p-${p.dataset.pest}`).classList.add('es-activa');
        // El canvas mide 0 mientras el panel está oculto: hay que remedirlo.
        requestAnimationFrame(() => {
          lienzoAcc?._medir(); lienzoGyr?._medir();
          lienzoAcc?.draw();   lienzoGyr?.draw();
        });
      });
    });
  }

  function abrirTaller(si) {
    if (si && partida?.viva) { partida.abandonar(); partida = null; }
    document.body.classList.toggle('es-taller', si);
    if (si) {
      requestAnimationFrame(() => {
        lienzoAcc?._medir(); lienzoGyr?._medir();
        lienzoAcc?.draw();   lienzoGyr?.draw();
      });
    } else {
      pintarVista(); pintarHud();
    }
  }

  /* ==========================================================================
     PANTALLA SUPERIOR — el escaparate
     ======================================================================== */
  const LUGAR = {
    menu: 'Salón', recetas: 'La carta', entrenar: 'Barra de práctica',
    jugar: 'Servicio', progreso: 'Libreta',
  };

  function pintarHud() {
    $('#hudLugar').textContent = LUGAR[vista] || 'Salón';
    const cuerpo = $('#hudCuerpo');

    if (vista === 'menu')     return void (cuerpo.innerHTML = hudPortada());
    if (vista === 'recetas')  return void (cuerpo.innerHTML = hudReceta());
    if (vista === 'entrenar') return void (cuerpo.innerHTML = hudGesto());
    if (vista === 'progreso') return void (cuerpo.innerHTML = hudLibreta());
    if (vista === 'jugar')    return void (cuerpo.innerHTML = hudJuegoBase());
  }

  function hudPortada() {
    const r = Libreta.resumen();
    return `
      <div class="portada">
        <h1 class="portada__titulo oro">MixLab</h1>
        <p class="portada__lema">La app te dice qué hacer.<br>La coctelera entiende cómo lo hiciste.</p>
        <div class="filete portada__filete"><span>◆</span></div>
        <p class="medidor__pie" style="justify-content:center;gap:18px;margin-top:12px">
          <span>${r.partidas} servicio${r.partidas === 1 ? '' : 's'}</span>
          <span class="estrellas" style="font-size:.8rem">${r.estrellasTotales}/${r.estrellasPosibles} ★</span>
        </p>
      </div>`;
  }

  function hudReceta() {
    const r = recetaPorId.get(recetaElegida);
    const total = r.pasos.reduce((a, p) => a + p.seg, 0);
    return `
      <div>
        <div class="filete"><span>◆</span></div>
        <h2 class="gesto__nombre serif" style="text-align:center;margin:10px 0 2px">${esc(r.nombre)}</h2>
        <p class="gesto__pista" style="text-align:center;margin-bottom:10px">${esc(r.nota)} · ${total} s</p>
        <ol class="receta-pasos">
          ${r.pasos.map(p => {
            const c = CLASES.find(x => x.id === p.clase);
            return `<li><b>${esc(c ? c.label : p.clase)}</b><time>${p.seg} s</time></li>`;
          }).join('')}
        </ol>
      </div>`;
  }

  function hudGesto() {
    const c = CLASES.find(x => x.id === gestoElegido);
    return `
      <div class="gesto">
        <p class="gesto__paso versalita">Practica</p>
        <h2 class="gesto__nombre oro">${esc(c.label)}</h2>
        <p class="gesto__pista">${esc(c.desc)}</p>
        <div class="medidor" id="medidor">
          <div class="medidor__marco"><div class="medidor__liquido" id="medidorLiquido"></div></div>
          <div class="medidor__pie"><span id="medidorQue">confianza</span><span id="medidorNum">0 %</span></div>
        </div>
      </div>`;
  }

  function hudJuegoBase() {
    return `
      <div class="gesto">
        <p class="gesto__paso versalita" id="jPaso">—</p>
        <h2 class="gesto__nombre oro" id="jGesto">Listo</h2>
        <p class="gesto__pista" id="jTexto">Pulsa «Servir» para empezar</p>
        <div class="medidor" id="medidor">
          <div class="medidor__marco"><div class="medidor__liquido" id="medidorLiquido"></div></div>
          <div class="medidor__pie"><span id="medidorQue">confianza</span><span id="medidorNum">0 %</span></div>
        </div>
        <div class="marcador">
          <span class="crono" id="jCrono">0.0</span>
          <span class="estrellas" id="jEstrellas">${pintarEstrellas(0)}</span>
        </div>
        <div class="pasos" id="jPasos"></div>
      </div>`;
  }

  function hudLibreta() {
    const r = Libreta.resumen();
    if (r.global === null) {
      return `<div class="cifra">
                <span class="cifra__num oro">—</span>
                <span class="cifra__pie">Todavía no has servido nada.<br>Empieza por una receta fácil.</span>
              </div>`;
    }
    return `
      <div class="cifra">
        <span class="cifra__num oro">${Math.round(r.global * 100)}%</span>
        <span class="cifra__pie">precisión media en ${r.partidas} servicio${r.partidas === 1 ? '' : 's'}</span>
        <p class="estrellas" style="margin:10px 0 0">${r.estrellasTotales}/${r.estrellasPosibles} ★</p>
        ${r.flojo ? `<p class="gesto__pista" style="margin-top:8px">Tu punto flaco: <b>${esc(r.flojo.label)}</b> (${Math.round(r.flojo.media * 100)} %)</p>` : ''}
      </div>`;
  }

  /* --- medidor compartido: lo usan entrenar, jugar e inferencia --- */
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
     PANTALLA INFERIOR — las vistas
     ======================================================================== */
  function pintarVista() {
    if (vista === 'recetas')  pintarRecetas();
    if (vista === 'entrenar') pintarEntrenar();
    if (vista === 'jugar')    pintarJugar();
    if (vista === 'progreso') pintarProgreso();
  }

  function pintarRecetas() {
    const d = Libreta.resumen();
    $('#listaRecetas').innerHTML = d.recetas.map(r => `
      <button class="ficha ${r.id === recetaElegida ? 'es-elegida' : ''}" type="button" data-receta="${r.id}">
        <span>
          <span class="ficha__nombre">${esc(r.nombre)}</span>
          <span class="ficha__nota">${esc(r.nota)}</span>
        </span>
        <span class="ficha__dcha">
          <span class="grados">${'◆'.repeat(r.grado)}<span class="apagado">${'◆'.repeat(3 - r.grado)}</span></span><br>
          <span class="ficha__estrellas">${r.marca ? pintarEstrellas(r.marca.estrellas) : '<span class="apagada">★★★</span>'}</span>
        </span>
      </button>`).join('');

    $('#pieRecetas').innerHTML =
      `<button class="btn btn--laton btn--bloque" type="button" data-servir>Servir este cóctel</button>`;
  }

  function pintarEntrenar() {
    $('#listaGestos').innerHTML = GESTOS.map(c => `
      <button class="ficha ${c.id === gestoElegido ? 'es-elegida' : ''}" type="button" data-gesto="${c.id}">
        <span>
          <span class="ficha__nombre">${esc(c.label)}</span>
          <span class="ficha__nota">${esc(c.desc)}</span>
        </span>
      </button>`).join('');

    $('#demoEntrenar').innerHTML = cajaDemo();
    $('#btnEntrenar').disabled = !transporte;
    $('#btnEntrenar').textContent = partida?.viva ? 'Dejarlo' : 'Empezar práctica';
  }

  /* Con el simulador no hay muñeca que mover: estos botones cambian el gesto
     que la "placa" está fingiendo, para poder jugar y enseñar el flujo. */
  function cajaDemo() {
    if (transporte?.nombre !== 'sim') return '';
    return `<div class="demo">
      <span class="demo__txt">Modo simulador: elige qué gesto está haciendo la coctelera.</span>
      ${GESTOS.map(c => `<button class="demo__btn" type="button" data-simgesto="${c.id}"
        aria-pressed="${transporte.gesto === c.id}">${esc(c.label)}</button>`).join('')}
    </div>`;
  }

  function pintarJugar() {
    const cuerpo = $('#cuerpoJugar');
    const pie = $('#pieJugar');
    const r = recetaPorId.get(recetaElegida);
    $('#tituloJugar').textContent = r ? r.nombre : 'Servicio';

    if (partida?.viva) {
      // La pantalla táctil lleva la receta entera con el paso en curso
      // marcado: arriba va el gesto grande, aquí el sitio donde estás.
      cuerpo.innerHTML = `
        <ol class="receta-pasos" id="jLista">
          ${r.pasos.map((p, k) => {
            const c = CLASES.find(x => x.id === p.clase);
            return `<li class="${k < partida.idx ? 'es-hecho' : k === partida.idx ? 'es-actual' : ''}">
                      <b>${esc(c ? c.label : p.clase)}</b> ${esc(p.texto)}<time>${p.seg} s</time>
                    </li>`;
          }).join('')}
        </ol>
        ${cajaDemo()}`;
      pie.innerHTML = `<button class="btn btn--bloque" type="button" data-abandonar>Abandonar el servicio</button>`;
      return;
    }

    if (ultimaActa && ultimaActa.recetaId === recetaElegida) {
      cuerpo.innerHTML = `
        <div class="acta">
          <div class="acta__estrellas">${pintarEstrellas(ultimaActa.estrellas)}</div>
          <p class="acta__pts serif oro">${ultimaActa.puntos}</p>
          <p class="acta__pie">${Math.round(ultimaActa.precision * 100)} % de precisión</p>
          <div class="acta__detalle barras">
            ${ultimaActa.pasos.map(p => {
              const c = CLASES.find(x => x.id === p.clase);
              return barraHtml(c ? c.label : p.clase, p.precision);
            }).join('')}
          </div>
        </div>`;
      pie.innerHTML = `
        <button class="btn btn--laton btn--bloque" type="button" data-servir>Repetir</button>
        <button class="btn btn--bloque btn--fantasma" type="button" data-ir="recetas" style="margin-top:7px">Elegir otra receta</button>`;
      return;
    }

    cuerpo.innerHTML = `
      ${transporte ? '' : '<p class="aviso">Sin placa conectada no hay juego: el modelo corre en el Arduino y la app solo lee lo que él decide. Conecta desde el <b>Taller</b>, o arranca el <b>simulador</b>.</p>'}
      <ol class="receta-pasos">
        ${r.pasos.map(p => {
          const c = CLASES.find(x => x.id === p.clase);
          return `<li><b>${esc(c ? c.label : p.clase)}</b> ${esc(p.texto)}<time>${p.seg} s</time></li>`;
        }).join('')}
      </ol>
      ${cajaDemo()}`;
    pie.innerHTML = `<button class="btn btn--laton btn--bloque" type="button" data-servir ${transporte ? '' : 'disabled'}>Servir</button>`;
  }

  function barraHtml(etiqueta, v) {
    const pct = Math.round(v * 100);
    return `<div class="barra ${v < 0.5 ? 'es-flojo' : ''}">
      <span>${esc(etiqueta)}</span>
      <span class="barra__via"><span class="barra__lleno" style="width:${pct}%"></span></span>
      <span class="barra__n">${pct}%</span>
    </div>`;
  }

  function pintarProgreso() {
    const r = Libreta.resumen();

    if (!r.partidas && r.gestos.every(g => !g.intentos)) {
      $('#cuerpoProgreso').innerHTML = '<p class="vacio">La libreta está en blanco.<br>Sirve tu primer cóctel.</p>';
      $('#pieProgreso').innerHTML = '<button class="btn btn--laton btn--bloque" type="button" data-ir="recetas">Ver la carta</button>';
      return;
    }

    /* Precisión por gesto: la misma medida repetida entre categorías, así que
       va en un solo tono. Una paleta categórica aquí daría a entender que el
       color significa algo. */
    $('#cuerpoProgreso').innerHTML = `
      <p class="versalita" style="color:var(--laton-hondo);margin:0 0 8px">Precisión por gesto</p>
      <div class="barras">
        ${r.gestos.map(g => g.media === null
          ? `<div class="barra"><span>${esc(g.label)}</span><span class="barra__via"></span><span class="barra__n">—</span></div>`
          : barraHtml(g.label, g.media)).join('')}
      </div>

      <p class="versalita" style="color:var(--laton-hondo);margin:16px 0 8px">Marcas</p>
      <table class="libreta">
        <thead><tr><th>Cóctel</th><th>★</th><th>Mejor</th></tr></thead>
        <tbody>
          ${r.recetas.map(x => `<tr>
            <td>${esc(x.nombre)}</td>
            <td class="ficha__estrellas">${x.marca ? pintarEstrellas(x.marca.estrellas) : '<span class="apagada">★★★</span>'}</td>
            <td>${x.marca ? x.marca.mejorPts : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;

    $('#pieProgreso').innerHTML =
      '<button class="btn btn--bloque btn--fantasma" type="button" data-borrar-libreta>Borrar la libreta</button>';
  }

  /* ==========================================================================
     ACCIONES DEL SALÓN
     ======================================================================== */
  function initAcciones() {
    document.addEventListener('click', (e) => {
      const rec = e.target.closest('[data-receta]');
      if (rec) { recetaElegida = rec.dataset.receta; pintarRecetas(); pintarHud(); return; }

      const ges = e.target.closest('[data-gesto]');
      if (ges) { gestoElegido = ges.dataset.gesto; pintarEntrenar(); pintarHud(); return; }

      const sim = e.target.closest('[data-simgesto]');
      if (sim) {
        transporte?.setGesto?.(sim.dataset.simgesto);
        $$('[data-simgesto]').forEach(b => b.setAttribute('aria-pressed', String(b === sim)));
        return;
      }

      if (e.target.closest('[data-servir]'))    { empezarPartida(recetaPorId.get(recetaElegida)); return; }
      if (e.target.closest('[data-abandonar]')) { partida?.abandonar(); partida = null; irA('jugar'); return; }

      if (e.target.closest('[data-borrar-libreta]')) {
        if (!confirm('¿Borrar todas tus marcas? No se puede deshacer.')) return;
        Libreta.borrar();
        ultimaActa = null;
        pintarProgreso(); pintarHud();
        recado('Libreta en blanco');
        return;
      }
    });

    $('#btnEntrenar').addEventListener('click', () => {
      if (partida?.viva) { partida.abandonar(); partida = null; pintarEntrenar(); pintarHud(); return; }
      empezarPartida(recetaDePractica(gestoElegido, 10), 'entrenar');
    });

    $('#btnConectarRapido').addEventListener('click', () => {
      if (transporte) { desconectar(); return; }
      abrirTaller(true);
    });
  }

  function empezarPartida(receta, destino = 'jugar') {
    if (!transporte) { recado('Conecta la placa o arranca el simulador'); return; }

    ultimaActa = null;
    irA(destino);

    partida = new Partida(receta, {
      onPaso: (p, i, total) => {
        const c = CLASES.find(x => x.id === p.clase);
        $('#jGesto')  && ($('#jGesto').textContent = c ? c.label : p.clase);
        $('#jTexto')  && ($('#jTexto').textContent = p.texto);
        $('#jPaso')   && ($('#jPaso').textContent = receta.practica ? 'Practica' : `Paso ${i + 1} de ${total}`);
        const pasos = $('#jPasos');
        if (pasos) {
          pasos.innerHTML = Array.from({ length: total }, (_, k) =>
            `<span class="pasos__pieza ${k < i ? 'es-hecho' : k === i ? 'es-actual' : ''}"></span>`).join('');
        }
        // En «entrenar» el HUD es el del gesto: hay que cambiarlo al de juego.
        if (destino === 'entrenar' && !$('#jGesto')) {
          $('#hudCuerpo').innerHTML = hudJuegoBase();
        }

        // Repintar solo las clases de la lista de abajo. Rehacer la vista
        // entera destruiría los botones del simulador a media partida.
        $$('#jLista li').forEach((li, k) => {
          li.classList.toggle('es-hecho',  k < i);
          li.classList.toggle('es-actual', k === i);
        });
      },

      onTick: (t) => {
        const crono = $('#jCrono');
        if (crono) {
          crono.textContent = t.restanteS.toFixed(1);
          crono.classList.toggle('es-poco', t.restanteS < 2);
        }
        moverMedidor(t.conf, t.acierto, t.acierto ? '¡así!' : (t.detectado ? 'otro gesto' : 'sin señal'));
        const est = $('#jEstrellas');
        if (est) est.innerHTML = pintarEstrellas(estrellasDe(t.precision));
      },

      onFin: (acta) => {
        partida = null;
        ultimaActa = acta;
        if (receta.practica) {
          recado(`${acta.nombre}: ${Math.round(acta.precision * 100)} % de precisión`);
          irA('entrenar');
        } else {
          recado(`${acta.puntos} puntos · ${acta.estrellas} estrella${acta.estrellas === 1 ? '' : 's'}`);
          irA('jugar');
        }
      },
    });

    // El HUD de juego hace falta también cuando la práctica arranca desde
    // «entrenar», donde el HUD por defecto es el del gesto elegido.
    $('#hudCuerpo').innerHTML = hudJuegoBase();
    partida.arrancar();
    pintarVista();
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
    $('#btnDesconectar').addEventListener('click', desconectar);
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

      $('#btnDesconectar').hidden = false;
      $$('.enchufe').forEach(c => c.classList.toggle('es-viva', c.dataset.enchufe === tipo));
      $('#btnGrabar').disabled = false;
      $('#pistaGrabar').textContent = 'Listo para grabar.';
      recado('Placa conectada');
      pintarVista();

    } catch (err) {
      transporte = null;
      // Cerrar el diálogo del navegador no es un error que reportar.
      const cancelado = err?.name === 'NotFoundError' || /User cancelled|cancelad/i.test(err?.message || '');
      pintarEstado(cancelado ? 'off' : 'err', cancelado ? 'Sin conexión' : (err.message || 'Falló la conexión'));
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
    $('#btnDesconectar').hidden = true;
    $$('.enchufe').forEach(c => c.classList.remove('es-viva'));
    $('#btnGrabar').disabled = true;
    $('#pistaGrabar').textContent = 'Conecta una fuente para empezar.';
    pintarEstado('off', 'Sin conexión');
    pintarVista();
  }

  function pintarEstado(estado, msg) {
    $('#punto').dataset.estado = estado;
    $('#luz').dataset.estado = estado;
    $('#estadoTaller').textContent = msg;
    $('#hudEstado').textContent = msg;
    $('#pieEstado').textContent = estado === 'on' ? msg : 'sin placa';
    $('#btnConectarRapido').textContent = estado === 'on' ? 'Desconectar' : 'Conectar placa';
  }

  /* ==========================================================================
     ENTRADA DE DATOS
     ======================================================================== */
  function procesarLinea(linea) {
    const m = parseLine(linea);
    if (!m) return;

    if (m.tipo === 'hola') {
      pintarEstado('on', `${m.placa}${m.hz ? ` · ${m.hz} Hz` : ''}`);
      return;
    }

    if (m.tipo === 'inferencia') {
      partida?.alimentar(m);
      pintarInferencia(m);
      // Fuera de partida, el medidor de «entrenar» sigue vivo como espejo.
      if (!partida?.viva && vista === 'entrenar') {
        moverMedidor(m.clase === gestoElegido ? m.confianza : 0,
                     m.clase === gestoElegido && m.confianza >= UMBRAL_CONF,
                     m.clase === gestoElegido ? 'confianza' : 'otro gesto');
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
     TALLER — gráficas en vivo
     ======================================================================== */
  function initGraficas() {
    lienzoAcc = new StreamChart($('#lienzoAcc'), { unidad: 'g',   decimales: 2, readout: $('#readoutAcc') });
    lienzoGyr = new StreamChart($('#lienzoGyr'), { unidad: '°/s', decimales: 1, readout: $('#readoutGyr') });

    pintarLeyenda($('#leyendaAcc'), 'acc');
    pintarLeyenda($('#leyendaGyr'), 'gyr');

    $('#btnPausa').addEventListener('click', (e) => {
      pausado = !pausado;
      e.currentTarget.setAttribute('aria-pressed', String(pausado));
      e.currentTarget.textContent = pausado ? 'Reanudar' : 'Pausar';
    });

    $('#btnTabla').addEventListener('click', (e) => {
      const ver = $('#tablaVivo').hidden;
      $('#tablaVivo').hidden = !ver;
      e.currentTarget.setAttribute('aria-pressed', String(ver));
      e.currentTarget.textContent = ver ? 'Ocultar tabla' : 'Ver tabla';
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

    if (!document.body.classList.contains('es-taller')) return;
    if (pausado || !$('#p-vivo').classList.contains('es-activa')) return;

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

      $('#btnGrabar').textContent = 'Cancelar';
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
        $('#btnGrabar').textContent = 'Grabar toma';
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
    caja.classList.toggle('es-contando',  ev.fase === 'cuenta');
    caja.classList.toggle('es-grabando',  ev.fase === 'grabando');

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
      return `<div class="toma">
        <div>
          <div class="toma__n">${esc(label)} · ${esc(t.quien)}</div>
          <div class="toma__m">${t.n} muestras · ${(t.duracionMs / 1000).toFixed(1)} s · ${t.hzReal} Hz · ${hora}</div>
        </div>
        <button class="btn btn--mini" type="button" data-dl="${t.id}">CSV</button>
        <button class="toma__x" type="button" data-del="${t.id}" aria-label="Borrar toma">✕</button>
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
    pintarVista();
    pintarHud();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();

/* ============================================================
   main.js — cableado de la interfaz
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const THEME_KEY = 'mixlab.theme.v1';

  /* ---------- estado ---------- */
  const buffer   = new RingBuffer(6000);
  const recorder = new Recorder();

  let transporte = null;
  let splitter   = null;
  let pausado    = false;
  let t0Reloj    = 0;                 // origen para muestras sin marca de tiempo
  let ultimaInferencia = null;

  const hz = { ventana: [], valor: 0 };   // marcas para medir frecuencia real

  let chartAcc, chartGyr;

  /* ============================================================
     TEMA Y PESTAÑAS
     ============================================================ */
  function initTema() {
    let guardado = null;
    try { guardado = localStorage.getItem(THEME_KEY); } catch {}
    if (guardado === 'dark' || guardado === 'light') document.documentElement.dataset.theme = guardado;

    $('#themeBtn').addEventListener('click', () => {
      const oscuroSO = matchMedia('(prefers-color-scheme: dark)').matches;
      const actual = document.documentElement.dataset.theme || (oscuroSO ? 'dark' : 'light');
      const nuevo = actual === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = nuevo;
      try { localStorage.setItem(THEME_KEY, nuevo); } catch {}
      chartAcc?.draw(); chartGyr?.draw();
    });
  }

  function initTabs() {
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        $$('.panel').forEach(p => p.classList.remove('is-active'));
        $(`#tab-${tab.dataset.tab}`).classList.add('is-active');
        // El canvas mide 0 mientras el panel está oculto: hay que redibujar al mostrarlo.
        requestAnimationFrame(() => { chartAcc?._medir(); chartGyr?._medir(); chartAcc?.draw(); chartGyr?.draw(); });
      });
    });
  }

  function irA(tab) { $(`.tab[data-tab="${tab}"]`)?.click(); }

  /* ============================================================
     CONEXIÓN
     ============================================================ */
  function initConexion() {
    // Web Bluetooth y Web Serial exigen contexto seguro.
    if (!window.isSecureContext) $('#secureWarn').hidden = false;

    if (!BleTransport.soportado) marcarNoSoportado('ble');
    if (!SerialTransport.soportado) marcarNoSoportado('serial');
    if (location.protocol === 'https:') $('#wsMixedWarn').hidden = false;

    const sel = $('#simGesture');
    sel.innerHTML = CLASES.map(c => `<option value="${c.id}">${c.label} — ${c.desc}</option>`).join('');

    $$('[data-connect]').forEach(btn => {
      btn.addEventListener('click', () => conectar(btn.dataset.connect));
    });

    $('#disconnectBtn').addEventListener('click', desconectar);
  }

  function marcarNoSoportado(t) {
    const card = $(`.conn[data-transport="${t}"]`);
    card.classList.add('is-unsupported');
    card.querySelector('.card__unsupported').hidden = false;
    card.querySelector('[data-connect]').disabled = true;
  }

  async function conectar(tipo) {
    if (transporte) await desconectar();

    try {
      switch (tipo) {
        case 'ble':    transporte = new BleTransport(); break;
        case 'wifi':   transporte = new WifiTransport($('#wsUrl').value.trim()); break;
        case 'serial': transporte = new SerialTransport(115200); break;
        default:       transporte = new SimTransport($('#simGesture').value, 100);
      }

      splitter = new LineSplitter(procesarLinea);
      transporte.onText(txt => splitter.push(txt));
      transporte.onState(pintarEstado);

      await transporte.connect();

      buffer.clear();
      hz.ventana.length = 0;
      t0Reloj = performance.now();

      $('#disconnectBtn').hidden = false;
      $$('.conn').forEach(c => c.classList.toggle('is-active', c.dataset.transport === tipo));
      $('#recBtn').disabled = false;
      $('#recHint').textContent = 'Listo para grabar.';
      irA('vivo');
      toast('Conectado');

    } catch (err) {
      transporte = null;
      // El usuario cerrando el diálogo del navegador no es un error que reportar.
      const cancelado = err?.name === 'NotFoundError' || /User cancelled|cancelad/i.test(err?.message || '');
      pintarEstado(cancelado ? 'off' : 'err', cancelado ? 'Sin conexión' : (err.message || 'Falló la conexión'));
      if (!cancelado) toast(err.message || 'No se pudo conectar');
    }
  }

  async function desconectar() {
    try { await transporte?.disconnect(); } catch {}
    transporte = null;
    splitter?.reset();
    recorder.cancelar();
    $('#disconnectBtn').hidden = true;
    $$('.conn').forEach(c => c.classList.remove('is-active'));
    $('#recBtn').disabled = true;
    $('#recHint').textContent = 'Conecta una fuente para empezar.';
    pintarEstado('off', 'Sin conexión');
  }

  function pintarEstado(estado, msg) {
    $('#statusDot').dataset.state = estado;
    $('#statusText').textContent = msg;
  }

  /* ============================================================
     ENTRADA DE DATOS
     ============================================================ */
  function procesarLinea(linea) {
    const m = parseLine(linea);
    if (!m) return;

    if (m.tipo === 'hola') {
      pintarEstado('on', `${m.placa}${m.hz ? ` · ${m.hz} Hz nominales` : ''}`);
      return;
    }

    if (m.tipo === 'inferencia') { pintarInferencia(m); return; }

    // Sin marca de tiempo propia, el reloj lo pone la app.
    if (m.t === null || !Number.isFinite(m.t)) m.t = performance.now() - t0Reloj;

    buffer.push(m);
    recorder.alimentar(m);

    const ahora = performance.now();
    hz.ventana.push(ahora);
    while (hz.ventana.length && ahora - hz.ventana[0] > 1000) hz.ventana.shift();
    hz.valor = hz.ventana.length;
  }

  /* ============================================================
     GRÁFICAS EN VIVO
     ============================================================ */
  function initGraficas() {
    chartAcc = new StreamChart($('#chartAcc'), { unidad: 'g',   decimales: 2, readout: $('#readoutAcc') });
    chartGyr = new StreamChart($('#chartGyr'), { unidad: '°/s', decimales: 1, readout: $('#readoutGyr') });

    pintarLeyenda($('#legendAcc'), 'acc');
    pintarLeyenda($('#legendGyr'), 'gyr');

    $('#pauseBtn').addEventListener('click', (e) => {
      pausado = !pausado;
      e.currentTarget.setAttribute('aria-pressed', String(pausado));
      e.currentTarget.textContent = pausado ? 'Reanudar' : 'Pausar';
    });

    $('#tableBtn').addEventListener('click', (e) => {
      const ver = $('#liveTable').hidden;
      $('#liveTable').hidden = !ver;
      e.currentTarget.setAttribute('aria-pressed', String(ver));
      e.currentTarget.textContent = ver ? 'Ocultar tabla' : 'Ver tabla';
    });

    $('#windowSel').addEventListener('change', bucle);
    requestAnimationFrame(bucle);
  }

  function pintarLeyenda(cont, pre) {
    cont.innerHTML = SERIES.map(s => `
      <span class="legend__item">
        <span class="legend__swatch" style="background:var(${s.varName})"></span>
        Eje ${s.label}
        <span class="legend__val" id="${pre}${s.label}">—</span>
      </span>`).join('');
  }

  let ultimoDibujo = 0;
  function bucle(ts) {
    requestAnimationFrame(bucle);
    // 30 fps bastan y dejan CPU libre para el parser.
    if (ts - ultimoDibujo < 33) return;
    ultimoDibujo = ts;
    if (pausado || !$('#tab-vivo').classList.contains('is-active')) return;

    const ventana = Number($('#windowSel').value) * 1000;
    const ult = buffer.last();
    if (!ult) { chartAcc.draw(); chartGyr.draw(); return; }

    const muestras = buffer.since(ult.t - ventana);

    chartAcc.setDatos(muestras.map(m => ({ t: m.t, v: [m.ax, m.ay, m.az] })), ventana);
    chartGyr.setDatos(muestras.map(m => ({ t: m.t, v: [m.gx, m.gy, m.gz] })), ventana);
    chartAcc.draw();
    chartGyr.draw();

    $('#statCount').textContent  = buffer.n.toLocaleString('es-CO');
    $('#statHz').textContent     = hz.valor;
    $('#statAccMag').textContent = magnitud(ult.ax, ult.ay, ult.az).toFixed(2);
    $('#statGyrMag').textContent = magnitud(ult.gx, ult.gy, ult.gz).toFixed(0);

    $('#accX').textContent = ult.ax.toFixed(2);
    $('#accY').textContent = ult.ay.toFixed(2);
    $('#accZ').textContent = ult.az.toFixed(2);
    $('#gyrX').textContent = ult.gx.toFixed(0);
    $('#gyrY').textContent = ult.gy.toFixed(0);
    $('#gyrZ').textContent = ult.gz.toFixed(0);

    if (!$('#liveTable').hidden) pintarTabla();
  }

  function pintarTabla() {
    const filas = [];
    for (let i = buffer.length - 1; i >= Math.max(0, buffer.length - 12); i--) {
      const m = buffer.at(i);
      filas.push(`<tr><td>${m.t.toFixed(0)}</td>
        <td>${m.ax.toFixed(3)}</td><td>${m.ay.toFixed(3)}</td><td>${m.az.toFixed(3)}</td>
        <td>${m.gx.toFixed(1)}</td><td>${m.gy.toFixed(1)}</td><td>${m.gz.toFixed(1)}</td></tr>`);
    }
    $('#liveTableBody').innerHTML = filas.join('');
  }

  /* ============================================================
     GRABADOR
     ============================================================ */
  function initGrabador() {
    $('#recClass').innerHTML = CLASES.map(c => `<option value="${c.id}">${c.label} — ${c.desc}</option>`).join('');

    recorder.onCambio = ({ aviso }) => { if (aviso) toast(aviso); pintarTomas(); };
    recorder.onTick = pintarEscenario;

    $('#recBtn').addEventListener('click', async () => {
      if (recorder.activa) { recorder.cancelar(); return; }
      if (!transporte) { toast('Conecta una fuente primero'); return; }

      $('#recBtn').textContent = 'Cancelar';
      try {
        const take = await recorder.grabar({
          clase: $('#recClass').value,
          duracionS: Math.max(1, Number($('#recDur').value) || 3),
          cuentaAtrasS: Math.max(0, Number($('#recDelay').value) || 0),
          quien: $('#recWho').value.trim(),
          hz: hz.valor || 100,
        });
        if (take) toast(`Toma guardada · ${take.n} muestras a ${take.hzReal} Hz`);
      } finally {
        $('#recBtn').textContent = 'Grabar toma';
      }
    });

    $('#exportAllBtn').addEventListener('click',  () => exportarTakes(recorder.takes, 'csv'));
    $('#exportJsonBtn').addEventListener('click', () => exportarTakes(recorder.takes, 'json'));

    $('#clearTakesBtn').addEventListener('click', () => {
      if (!confirm(`¿Borrar las ${recorder.takes.length} tomas guardadas? No se puede deshacer.`)) return;
      recorder.borrarTodas();
      toast('Tomas borradas');
    });

    $('#takes').addEventListener('click', (e) => {
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

  function pintarEscenario(ev) {
    const stage = $('#recStage');
    const big   = $('#recBig');
    const meta  = $('#recMeta');
    const fill  = $('#recFill');

    stage.classList.toggle('is-counting',  ev.fase === 'cuenta');
    stage.classList.toggle('is-recording', ev.fase === 'grabando');

    if (ev.fase === 'cuenta') {
      big.textContent = Math.ceil(ev.restante);
      meta.textContent = 'Prepárate…';
      fill.style.width = `${ev.progreso * 100}%`;
    } else if (ev.fase === 'grabando') {
      big.textContent = ev.restante.toFixed(1);
      meta.textContent = `Grabando · ${ev.n} muestras`;
      fill.style.width = `${ev.progreso * 100}%`;
    } else {
      big.textContent = ev.fase === 'lista' ? '✓' : '—';
      meta.textContent = ev.fase === 'lista'   ? `${ev.take.n} muestras · ${ev.take.hzReal} Hz`
                       : ev.fase === 'vacia'   ? 'No llegó ninguna muestra. ¿Sigue conectada la placa?'
                       : ev.fase === 'cancelada' ? 'Cancelada'
                       : 'Sin grabar';
      fill.style.width = '0%';
      if (ev.fase === 'lista') pintarTomas();
    }
  }

  function pintarTomas() {
    const takes = recorder.takes;
    $('#takeCount').textContent = takes.length;
    $('#takesEmpty').hidden = takes.length > 0;
    $('#exportAllBtn').disabled  = !takes.length;
    $('#exportJsonBtn').disabled = !takes.length;
    $('#clearTakesBtn').hidden   = !takes.length;

    const conteo = recorder.conteoPorClase();
    const max = Math.max(1, ...Object.values(conteo));
    $('#balance').innerHTML = CLASES.map(c => {
      const n = conteo[c.id];
      // Una clase con menos de un tercio de la más grande desequilibra el modelo.
      const flaca = n < max / 3;
      return `<div class="bal${flaca ? ' is-thin' : ''}">
        <span>${c.label}</span>
        <span class="bal__track"><span class="bal__fill" style="width:${(n / max) * 100}%"></span></span>
        <span class="bal__n">${n}</span>
      </div>`;
    }).join('');

    $('#takes').innerHTML = takes.slice().reverse().map(t => {
      const label = CLASES.find(c => c.id === t.clase)?.label || t.clase;
      const hora = new Date(t.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
      return `<div class="take">
        <div>
          <div class="take__name">${label} · ${t.quien}</div>
          <div class="take__meta">${t.n} muestras · ${(t.duracionMs / 1000).toFixed(1)} s · ${t.hzReal} Hz · ${hora}</div>
        </div>
        <button class="btn btn--ghost btn--sm" type="button" data-dl="${t.id}">CSV</button>
        <button class="take__del" type="button" data-del="${t.id}" aria-label="Borrar toma">✕</button>
      </div>`;
    }).join('');
  }

  /* ============================================================
     INFERENCIA
     ============================================================ */
  const historial = [];

  function pintarInferencia(m) {
    ultimaInferencia = { ...m, ts: Date.now() };
    const label = CLASES.find(c => c.id === m.clase)?.label || m.clase;

    $('#inferClass').textContent = label;
    $('#inferConf').textContent = `${Math.round(m.confianza * 100)} %`;
    const fill = $('#inferFill');
    fill.style.width = `${m.confianza * 100}%`;
    fill.classList.toggle('is-low', m.confianza < 0.6);

    historial.unshift({ label, conf: m.confianza, ts: Date.now() });
    historial.length = Math.min(historial.length, 40);

    $('#inferEmpty').hidden = true;
    $('#inferHistory').innerHTML = historial.map(h =>
      `<li><span>${h.label}</span>
           <span><b>${Math.round(h.conf * 100)} %</b>
           <time>${new Date(h.ts).toLocaleTimeString('es-CO')}</time></span></li>`
    ).join('');
  }

  setInterval(() => {
    const el = $('#inferAge');
    if (!ultimaInferencia) return;
    const s = (Date.now() - ultimaInferencia.ts) / 1000;
    el.textContent = s < 2 ? 'ahora mismo' : `hace ${s.toFixed(0)} s`;
  }, 1000);

  /* ============================================================
     VARIOS
     ============================================================ */
  let toastTimer;
  function toast(txt) {
    const el = $('#toast');
    el.textContent = txt;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('is-on');
      setTimeout(() => { el.hidden = true; }, 200);
    }, 2200);
  }

  addEventListener('beforeunload', () => { try { transporte?.disconnect(); } catch {} });

  function init() {
    initTema();
    initTabs();
    initConexion();
    initGraficas();
    initGrabador();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();

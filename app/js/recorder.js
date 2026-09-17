/* ============================================================
   recorder.js — grabación de tomas y exportación del dataset
   Formatos de salida: CSV y el JSON de adquisición de Edge Impulse.
   Se empaquetan en un .zip construido a mano para no arrastrar
   ninguna librería (la app tiene que abrir sin red).
   ============================================================ */

const TAKES_KEY = 'mixlab.takes.v1';

class Recorder {
  constructor() {
    this.takes = this._cargar();
    this.activa = null;        // toma en curso
    this.onCambio = () => {};
    this.onTick = () => {};
  }

  /* ---------- persistencia ---------- */
  _cargar() {
    try { return JSON.parse(localStorage.getItem(TAKES_KEY)) || []; }
    catch { return []; }
  }

  _guardar() {
    try {
      localStorage.setItem(TAKES_KEY, JSON.stringify(this.takes));
    } catch {
      // Cuota llena: las tomas siguen vivas en memoria, pero no sobreviven
      // a un refresco. Mejor avisar que perderlas en silencio.
      this.onCambio({ aviso: 'No caben más tomas en el almacenamiento del navegador. Exporta y borra.' });
      return;
    }
    this.onCambio({});
  }

  /* ---------- grabar ----------
     Fases: cuenta atrás → grabando → guardada.
     Devuelve una promesa que resuelve con la toma. */
  grabar({ clase, duracionS, cuentaAtrasS, quien, hz }) {
    if (this.activa) return Promise.reject(new Error('Ya hay una grabación en curso.'));

    return new Promise((resolve) => {
      const t0 = performance.now();
      const cuentaMs = cuentaAtrasS * 1000;
      const duraMs = duracionS * 1000;

      this.activa = {
        clase, quien: quien || 'anon', hz,
        fase: cuentaAtrasS > 0 ? 'cuenta' : 'grabando',
        muestras: [],
        _t0: t0, _cuentaMs: cuentaMs, _duraMs: duraMs,
        _resolve: resolve,
      };

      const paso = () => {
        const a = this.activa;
        if (!a) return;                      // cancelada
        const dt = performance.now() - a._t0;

        if (dt < a._cuentaMs) {
          a.fase = 'cuenta';
          this.onTick({ fase: 'cuenta', restante: (a._cuentaMs - dt) / 1000, progreso: dt / a._cuentaMs });
        } else if (dt < a._cuentaMs + a._duraMs) {
          a.fase = 'grabando';
          const p = (dt - a._cuentaMs) / a._duraMs;
          this.onTick({ fase: 'grabando', restante: (a._cuentaMs + a._duraMs - dt) / 1000, progreso: p, n: a.muestras.length });
        } else {
          this._cerrar();
          return;
        }
        a._raf = requestAnimationFrame(paso);
      };
      this.activa._raf = requestAnimationFrame(paso);
    });
  }

  /* Cada muestra que llega del transporte pasa por aquí. */
  alimentar(m) {
    const a = this.activa;
    if (!a || a.fase !== 'grabando') return;
    a.muestras.push([m.t, m.ax, m.ay, m.az, m.gx, m.gy, m.gz]);
  }

  _cerrar() {
    const a = this.activa;
    if (!a) return;
    cancelAnimationFrame(a._raf);
    this.activa = null;

    if (!a.muestras.length) {
      this.onTick({ fase: 'vacia' });
      a._resolve(null);
      return;
    }

    // Tiempos relativos al inicio de la toma: Edge Impulse espera que
    // cada muestra empiece en 0, no en el reloj de la placa.
    const base = a.muestras[0][0];
    const filas = a.muestras.map(f => [Math.round(f[0] - base), ...f.slice(1)]);

    // Intervalo real medido, no el nominal: si la placa entregó a 87 Hz
    // declarar 100 Hz descuadra el preprocesado del modelo.
    const span = filas[filas.length - 1][0];
    const intervalo = filas.length > 1 ? span / (filas.length - 1) : 1000 / (a.hz || 100);

    const take = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      clase: a.clase,
      quien: a.quien,
      fecha: new Date().toISOString(),
      n: filas.length,
      duracionMs: span,
      intervaloMs: Number(intervalo.toFixed(3)),
      hzReal: Number((1000 / intervalo).toFixed(1)),
      filas,
    };

    this.takes.push(take);
    this._guardar();
    this.onTick({ fase: 'lista', take });
    a._resolve(take);
  }

  cancelar() {
    if (!this.activa) return;
    cancelAnimationFrame(this.activa._raf);
    const r = this.activa._resolve;
    this.activa = null;
    this.onTick({ fase: 'cancelada' });
    r(null);
  }

  borrar(id) {
    this.takes = this.takes.filter(t => t.id !== id);
    this._guardar();
  }

  borrarTodas() {
    this.takes = [];
    this._guardar();
  }

  conteoPorClase() {
    const c = Object.fromEntries(CLASES.map(k => [k.id, 0]));
    for (const t of this.takes) if (c[t.clase] !== undefined) c[t.clase]++;
    return c;
  }
}

/* ============================================================
   Formatos de salida
   ============================================================ */

/* CSV con la cabecera que espera el asistente de Edge Impulse. */
function takeACsv(take) {
  const cab = 'timestamp,accX,accY,accZ,gyrX,gyrY,gyrZ';
  const filas = take.filas.map(f =>
    [f[0], f[1].toFixed(4), f[2].toFixed(4), f[3].toFixed(4),
           f[4].toFixed(2), f[5].toFixed(2), f[6].toFixed(2)].join(',')
  );
  return cab + '\n' + filas.join('\n') + '\n';
}

/* JSON de adquisición de Edge Impulse (ingestion API, v1 sin firma). */
function takeAJson(take) {
  return JSON.stringify({
    protected: { ver: 'v1', alg: 'none' },
    signature: '',
    payload: {
      device_name: take.quien,
      device_type: 'ARDUINO_IMU',
      interval_ms: take.intervaloMs,
      sensors: [
        { name: 'accX', units: 'g' },
        { name: 'accY', units: 'g' },
        { name: 'accZ', units: 'g' },
        { name: 'gyrX', units: 'deg/s' },
        { name: 'gyrY', units: 'deg/s' },
        { name: 'gyrZ', units: 'deg/s' },
      ],
      values: take.filas.map(f => f.slice(1)),
    },
  });
}

/* Edge Impulse saca la etiqueta del nombre del archivo, de lo que va
   antes del primer punto. Por eso la clase abre el nombre. */
function nombreArchivo(take, ext) {
  const fecha = take.fecha.slice(0, 19).replace(/[:T]/g, '-');
  const quien = take.quien.replace(/[^a-z0-9_-]/gi, '') || 'anon';
  return `${take.clase}.${quien}_${fecha}_${take.id.slice(-5)}.${ext}`;
}

/* ============================================================
   ZIP mínimo (método "stored", sin compresión).
   Suficiente para CSV/JSON y evita depender de una librería.
   ============================================================ */

const CRC_TABLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLA[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function construirZip(archivos) {
  const enc = new TextEncoder();
  const partes = [];
  const central = [];
  let offset = 0;

  const u16 = n => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = n => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

  for (const { nombre, texto } of archivos) {
    const datos = enc.encode(texto);
    const nom = enc.encode(nombre);
    const crc = crc32(datos);

    // Cabecera local. Fecha/hora MS-DOS en cero: los descompresores
    // lo aceptan y evita depender de la zona horaria.
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc), ...u32(datos.length), ...u32(datos.length),
      ...u16(nom.length), ...u16(0),
      ...nom,
    ]);

    partes.push(local, datos);

    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc), ...u32(datos.length), ...u32(datos.length),
      ...u16(nom.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
      ...nom,
    ]));

    offset += local.length + datos.length;
  }

  const tamCentral = central.reduce((a, c) => a + c.length, 0);
  const fin = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(archivos.length), ...u16(archivos.length),
    ...u32(tamCentral), ...u32(offset), ...u16(0),
  ]);

  return new Blob([...partes, ...central, fin], { type: 'application/zip' });
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Liberar de inmediato cancela la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function exportarTakes(takes, formato) {
  if (!takes.length) return;
  const ext = formato === 'json' ? 'json' : 'csv';
  const aTexto = formato === 'json' ? takeAJson : takeACsv;

  if (takes.length === 1) {
    const t = takes[0];
    descargar(new Blob([aTexto(t)], { type: 'text/plain' }), nombreArchivo(t, ext));
    return;
  }

  const zip = construirZip(takes.map(t => ({ nombre: nombreArchivo(t, ext), texto: aTexto(t) })));
  const sello = new Date().toISOString().slice(0, 10);
  descargar(zip, `mixlab-dataset-${sello}-${ext}.zip`);
}

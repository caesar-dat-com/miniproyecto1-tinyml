/* ============================================================
   protocol.js — formato de línea, buffer circular y configuración
   ============================================================ */

/* Clases del proyecto. El orden manda en la interfaz y en los exports;
   'reposo' va al final porque no cuenta como clase evaluable. */
const CLASES = [
  { id: 'agitar',  label: 'Agitar',  desc: 'Shake de coctelera' },
  { id: 'remover', label: 'Remover', desc: 'Stir con cuchara' },
  { id: 'servir',  label: 'Servir',  desc: 'Inclinar para verter' },
  { id: 'macerar', label: 'Macerar', desc: 'Golpes verticales cortos' },
  { id: 'colar',   label: 'Colar',   desc: 'Giro e inclinación final' },
  { id: 'reposo',  label: 'Reposo',  desc: 'Coctelera quieta' },
];

const SERIES = [
  { key: 'x', label: 'X', varName: '--series-1' },
  { key: 'y', label: 'Y', varName: '--series-2' },
  { key: 'z', label: 'Z', varName: '--series-3' },
];

/* ------------------------------------------------------------
   Parser tolerante.
   Devuelve { tipo, ... } o null si la línea no dice nada útil.
   Nunca lanza: una línea corrupta por ruido de radio no debe
   tumbar el stream entero.
   ------------------------------------------------------------ */
function parseLine(linea) {
  const s = String(linea).trim();
  if (!s || s.startsWith('#')) return null;

  // JSON, por si alguien prefiere emitirlo así desde el firmware.
  if (s[0] === '{') {
    try {
      const o = JSON.parse(s);
      if (o.clase !== undefined) {
        return { tipo: 'inferencia', clase: String(o.clase), confianza: clamp01(Number(o.conf ?? o.confianza ?? 0)) };
      }
      const n = [o.ax, o.ay, o.az, o.gx, o.gy, o.gz].map(Number);
      if (n.every(Number.isFinite)) {
        return { tipo: 'muestra', t: Number(o.t) || null, ax: n[0], ay: n[1], az: n[2], gx: n[3], gy: n[4], gz: n[5] };
      }
    } catch { /* línea JSON partida a la mitad: se descarta */ }
    return null;
  }

  const p = s.split(',').map(x => x.trim());
  const cab = p[0].toUpperCase();

  if (cab === 'I' && p.length >= 3) {
    return { tipo: 'inferencia', clase: p[1], confianza: clamp01(parseFloat(p[2])) };
  }

  if (cab === 'H') {
    return { tipo: 'hola', placa: p[1] || 'desconocida', hz: Number(p[2]) || null };
  }

  // 'D' con marca de tiempo, o seis números sueltos.
  const campos = cab === 'D' ? p.slice(1) : p;
  const n = campos.map(Number);

  if (cab === 'D' && n.length >= 7 && n.every(Number.isFinite)) {
    return { tipo: 'muestra', t: n[0], ax: n[1], ay: n[2], az: n[3], gx: n[4], gy: n[5], gz: n[6] };
  }
  if (n.length === 6 && n.every(Number.isFinite)) {
    return { tipo: 'muestra', t: null, ax: n[0], ay: n[1], az: n[2], gx: n[3], gy: n[4], gz: n[5] };
  }
  return null;
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  // Acepta confianza en 0..1 o en porcentaje 0..100.
  const x = v > 1 ? v / 100 : v;
  return Math.min(1, Math.max(0, x));
}

/* ------------------------------------------------------------
   Troceador de flujo: los transportes entregan pedazos
   arbitrarios, no líneas. Acumula hasta el \n.
   ------------------------------------------------------------ */
class LineSplitter {
  constructor(onLine) {
    this.buf = '';
    this.onLine = onLine;
  }
  push(texto) {
    this.buf += texto;
    let i;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const linea = this.buf.slice(0, i).replace(/\r$/, '');
      this.buf = this.buf.slice(i + 1);
      if (linea) this.onLine(linea);
    }
    // Una línea sin \n que crece sin freno sería una fuga de memoria.
    if (this.buf.length > 4096) this.buf = '';
  }
  reset() { this.buf = ''; }
}

/* ------------------------------------------------------------
   Buffer circular de muestras.
   Tamaño fijo: a 100 Hz, 6000 muestras = 60 s de historia.
   ------------------------------------------------------------ */
class RingBuffer {
  constructor(capacidad = 6000) {
    this.cap = capacidad;
    this.t  = new Float64Array(capacidad);
    this.ax = new Float32Array(capacidad);
    this.ay = new Float32Array(capacidad);
    this.az = new Float32Array(capacidad);
    this.gx = new Float32Array(capacidad);
    this.gy = new Float32Array(capacidad);
    this.gz = new Float32Array(capacidad);
    this.n = 0;      // total de muestras vistas (no se reinicia al dar la vuelta)
  }

  push(m) {
    const i = this.n % this.cap;
    this.t[i]  = m.t;
    this.ax[i] = m.ax; this.ay[i] = m.ay; this.az[i] = m.az;
    this.gx[i] = m.gx; this.gy[i] = m.gy; this.gz[i] = m.gz;
    this.n++;
  }

  get length() { return Math.min(this.n, this.cap); }

  /* Muestra i contando desde la más antigua disponible. */
  at(i) {
    const base = this.n > this.cap ? this.n - this.cap : 0;
    const k = (base + i) % this.cap;
    return {
      t: this.t[k],
      ax: this.ax[k], ay: this.ay[k], az: this.az[k],
      gx: this.gx[k], gy: this.gy[k], gz: this.gz[k],
    };
  }

  last() { return this.n ? this.at(this.length - 1) : null; }

  /* Muestras con t >= desde, en orden cronológico. */
  since(desde) {
    const out = [];
    for (let i = this.length - 1; i >= 0; i--) {
      const m = this.at(i);
      if (m.t < desde) break;
      out.push(m);
    }
    return out.reverse();
  }

  clear() { this.n = 0; }
}

function magnitud(x, y, z) { return Math.sqrt(x * x + y * y + z * z); }

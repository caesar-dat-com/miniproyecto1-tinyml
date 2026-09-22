/* ============================================================================
   game.js — la parte de bar: recetas, partidas, práctica y libreta
   El modelo corre en la placa; aquí solo se juzga lo que llega en las líneas
   "I,<clase>,<confianza>". Sin inferencia no hay juego, y eso es a propósito:
   la app no reimplementa el clasificador.
   ========================================================================== */

/* Confianza mínima para dar un gesto por bueno. Por debajo se considera que
   el modelo está dudando y no suma tiempo. */
const UMBRAL_CONF = 0.60;

/* Una inferencia más vieja que esto se considera muerta: si la placa deja de
   enviar, el contador no puede seguir premiando el último valor recibido. */
const VIDA_INFERENCIA_MS = 1500;

/* Una clase puede seguir formando parte de la experiencia aunque todavía no
   exista en el modelo. En ese caso el paso avanza por tiempo, no se compara
   con la inferencia y queda fuera de precisión, estrellas y libreta. */
function pasoEsMedible(paso) {
  const clase = CLASES.find(c => c.id === paso.clase);
  return paso.medible !== false && clase?.medible !== false;
}

const RECETAS = [
  {
    id: 'mojito', nombre: 'Mojito', grado: 1,
    nota: 'Hierbabuena, limón y ron blanco',
    pasos: [
      { clase: 'macerar', seg: 6, texto: 'Macera la hierbabuena con el limón' },
      { clase: 'remover', seg: 8, texto: 'Remueve con el hielo pilé' },
      { clase: 'servir',  seg: 4, texto: 'Sirve en el vaso alto' },
    ],
  },
  {
    id: 'daiquiri', nombre: 'Daiquirí', grado: 2,
    nota: 'Ron, lima y azúcar — nada más',
    pasos: [
      { clase: 'agitar', seg: 8, texto: 'Agita fuerte y en seco' },
      { clase: 'colar',  seg: 4, texto: 'Cuela con el gusanillo' },
      { clase: 'servir', seg: 4, texto: 'Sirve en copa fría' },
    ],
  },
  {
    id: 'negroni', nombre: 'Negroni', grado: 2,
    nota: 'Partes iguales, paciencia desigual',
    pasos: [
      { clase: 'remover', seg: 12, texto: 'Remueve en vaso mezclador, sin prisa' },
      { clase: 'colar',   seg: 3,  texto: 'Cuela sobre hielo grande' },
      { clase: 'servir',  seg: 4,  texto: 'Sirve y perfuma con naranja' },
    ],
  },
  {
    id: 'old-fashioned', nombre: 'Old Fashioned', grado: 3,
    nota: 'El más viejo de la carta, el menos perdonador',
    pasos: [
      { clase: 'macerar', seg: 5,  texto: 'Machaca el azúcar con el amargo' },
      { clase: 'remover', seg: 10, texto: 'Remueve hasta que se enfríe el vaso' },
      { clase: 'colar',   seg: 3,  texto: 'Cuela sobre el hielo tallado' },
      { clase: 'servir',  seg: 4,  texto: 'Sirve con la piel de naranja' },
    ],
  },
  {
    id: 'margarita', nombre: 'Margarita', grado: 3,
    nota: 'Tequila, triple seco y pulso firme',
    pasos: [
      { clase: 'agitar',  seg: 10, texto: 'Agita con hielo hasta escarchar' },
      { clase: 'macerar', seg: 4,  texto: 'Machaca la lima para el borde' },
      { clase: 'colar',   seg: 3,  texto: 'Cuela doble' },
      { clase: 'servir',  seg: 4,  texto: 'Sirve en copa con sal' },
    ],
  },
];

const recetaPorId = new Map(RECETAS.map(r => [r.id, r]));

/* ============================================================================
   Estrellas y puntos
   ========================================================================== */
function estrellasDe(precision) {
  if (precision >= 0.85) return 3;
  if (precision >= 0.65) return 2;
  if (precision >= 0.40) return 1;
  return 0;
}

function puntosDe(precision, grado) {
  return Math.round(precision * 1000 * (1 + (grado - 1) * 0.25));
}

function pintarEstrellas(n, total = 3) {
  let s = '';
  for (let i = 0; i < total; i++) s += i < n ? '★' : '<span class="apagada">★</span>';
  return s;
}

/* ============================================================================
   Partida — sirve tanto para una receta completa como para practicar un gesto
   suelto (una receta de un solo paso montada al vuelo).
   ========================================================================== */
class Partida {
  /**
   * @param {{id:string,nombre:string,grado:number,pasos:Array}} receta
   * @param {{onTick:Function, onPaso:Function, onFin:Function}} eventos
   */
  constructor(receta, eventos = {}) {
    this.receta = receta;
    this.ev = eventos;
    this.idx = 0;
    this.resultados = [];
    this.ultimaInf = null;
    this.viva = false;
    this.acierto = false;      // si el gesto actual está siendo correcto
    this.conf = 0;
  }

  arrancar() {
    this.viva = true;
    this._abrirPaso();
    this._ultimoTick = performance.now();
    this._timer = setInterval(() => this._tick(), 100);
  }

  _abrirPaso() {
    const p = this.receta.pasos[this.idx];
    this.restanteMs = p.seg * 1000;
    this.aciertoMs = 0;
    this.ev.onPaso?.(p, this.idx, this.receta.pasos.length);
  }

  /* Cada línea "I," que llega del transporte entra por aquí. */
  alimentar(inf) {
    this.ultimaInf = { ...inf, ts: performance.now() };
  }

  _tick() {
    if (!this.viva) return;

    const ahora = performance.now();
    const dt = ahora - this._ultimoTick;
    this._ultimoTick = ahora;

    const p = this.receta.pasos[this.idx];
    const inf = this.ultimaInf;
    const fresca = inf && (ahora - inf.ts) < VIDA_INFERENCIA_MS;

    const medible = pasoEsMedible(p);
    this.acierto = medible && Boolean(fresca && inf.clase === p.clase && inf.confianza >= UMBRAL_CONF);
    this.conf = medible && fresca && inf.clase === p.clase ? inf.confianza : 0;

    if (this.acierto) this.aciertoMs += dt;
    this.restanteMs -= dt;

    this.ev.onTick?.({
      paso: p,
      idx: this.idx,
      total: this.receta.pasos.length,
      restanteS: Math.max(0, this.restanteMs / 1000),
      precision: Math.min(1, this.aciertoMs / (p.seg * 1000)),
      acierto: this.acierto,
      conf: this.conf,
      detectado: fresca ? inf.clase : null,
      medible,
    });

    if (this.restanteMs <= 0) this._cerrarPaso();
  }

  _cerrarPaso() {
    const p = this.receta.pasos[this.idx];
    const medible = pasoEsMedible(p);
    this.resultados.push({
      clase: p.clase,
      medible,
      precision: medible ? Math.min(1, this.aciertoMs / (p.seg * 1000)) : null,
    });

    this.idx++;
    if (this.idx < this.receta.pasos.length) this._abrirPaso();
    else this._terminar();
  }

  _terminar() {
    clearInterval(this._timer);
    this.viva = false;

    const medidos = this.resultados.filter(r => r.medible && Number.isFinite(r.precision));
    const media = medidos.length
      ? medidos.reduce((a, r) => a + r.precision, 0) / medidos.length
      : null;
    const acta = {
      recetaId: this.receta.id,
      nombre: this.receta.nombre,
      practica: Boolean(this.receta.practica),
      precision: media,
      estrellas: media === null ? 0 : estrellasDe(media),
      puntos: media === null ? 0 : puntosDe(media, this.receta.grado || 1),
      pasos: this.resultados,
      fecha: Date.now(),
    };

    Libreta.anotar(acta);
    this.ev.onFin?.(acta);
  }

  abandonar() {
    clearInterval(this._timer);
    this.viva = false;
  }
}

/* ============================================================================
   Libreta — las marcas, en localStorage
   ========================================================================== */
const Libreta = {
  LLAVE: 'mixlab.libreta.v1',

  _leer() {
    try {
      return JSON.parse(localStorage.getItem(this.LLAVE)) || { recetas: {}, gestos: {}, partidas: 0 };
    } catch {
      return { recetas: {}, gestos: {}, partidas: 0 };
    }
  },

  _escribir(d) {
    try { localStorage.setItem(this.LLAVE, JSON.stringify(d)); } catch { /* sin memoria, el juego sigue */ }
  },

  anotar(acta) {
    const d = this._leer();

    // Una práctica entrena el gesto pero no es una partida: no cuenta como
    // marca de receta ni infla el contador de servicios.
    if (!acta.practica) {
      d.partidas = (d.partidas || 0) + 1;

      const r = d.recetas[acta.recetaId] || { mejorPts: 0, estrellas: 0, veces: 0 };
      r.veces++;
      r.mejorPts = Math.max(r.mejorPts, acta.puntos);
      r.estrellas = Math.max(r.estrellas, acta.estrellas);
      r.ultima = acta.fecha;
      d.recetas[acta.recetaId] = r;
    }

    // La precisión por gesto se acumula paso a paso, no por partida: así una
    // receta larga no pesa más que una corta al juzgar un gesto concreto.
    for (const p of acta.pasos) {
      if (!p.medible || !Number.isFinite(p.precision)) continue;
      const g = d.gestos[p.clase] || { intentos: 0, suma: 0, mejor: 0 };
      g.intentos++;
      g.suma += p.precision;
      g.mejor = Math.max(g.mejor, p.precision);
      d.gestos[p.clase] = g;
    }

    this._escribir(d);
    return d;
  },

  resumen() {
    const d = this._leer();

    const gestos = CLASES.filter(c => c.id !== 'reposo').map(c => {
      const g = d.gestos[c.id];
      return {
        id: c.id,
        label: c.label,
        intentos: g ? g.intentos : 0,
        media: g && g.intentos ? g.suma / g.intentos : null,
        mejor: g ? g.mejor : 0,
      };
    });

    const conDatos = gestos.filter(g => g.media !== null);
    const global = conDatos.length
      ? conDatos.reduce((a, g) => a + g.media, 0) / conDatos.length
      : null;

    return {
      partidas: d.partidas || 0,
      global,
      gestos,
      recetas: RECETAS.map(r => ({ ...r, marca: d.recetas[r.id] || null })),
      estrellasTotales: RECETAS.reduce((a, r) => a + (d.recetas[r.id]?.estrellas || 0), 0),
      estrellasPosibles: RECETAS.length * 3,
      /* El gesto más flojo con al menos dos intentos: con uno solo, un mal
         intento suelto lo señalaría injustamente. */
      flojo: conDatos.filter(g => g.intentos >= 2).sort((a, b) => a.media - b.media)[0] || null,
    };
  },

  borrar() {
    try { localStorage.removeItem(this.LLAVE); } catch {}
  },
};

/* Práctica de un gesto suelto: una receta de un paso, montada al vuelo. */
function recetaDePractica(claseId, seg = 10) {
  const c = CLASES.find(x => x.id === claseId);
  return {
    id: `practica-${claseId}`,
    nombre: c ? c.label : claseId,
    grado: 1,
    practica: true,
    pasos: [{ clase: claseId, seg, texto: c ? c.desc : 'Repite el gesto', medible: c?.medible !== false }],
  };
}

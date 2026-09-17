/* ============================================================
   chart.js — gráfica de líneas en vivo sobre canvas
   Tres series (X, Y, Z) en un único eje Y: son la misma magnitud
   y las mismas unidades. Acelerómetro y giroscopio van en
   gráficas separadas, nunca en dos escalas sobre el mismo marco.
   ============================================================ */

class StreamChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{unidad:string, readout:HTMLElement, decimales:number}} opts
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.unidad = opts.unidad || '';
    this.dec = opts.decimales ?? 2;
    this.readoutEl = opts.readout || null;

    this.pad = { t: 10, r: 34, b: 20, l: 46 };  // r deja sitio a la etiqueta directa
    this.datos = [];         // [{t, v:[x,y,z]}]
    this.ventanaMs = 5000;
    this.hover = null;       // posición del cursor en px
    this.escalaSuave = 1;

    this._medir();
    this._observarTamano();
    this._eventos();
  }

  /* ---------- tamaño y nitidez ---------- */
  _medir() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.canvas.width  = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _observarTamano() {
    if (typeof ResizeObserver === 'undefined') {
      addEventListener('resize', () => { this._medir(); this.draw(); });
      return;
    }
    this._ro = new ResizeObserver(() => { this._medir(); this.draw(); });
    this._ro.observe(this.canvas);
  }

  /* ---------- interacción ---------- */
  _eventos() {
    const mover = (e) => {
      const r = this.canvas.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      this.hover = { x: p.clientX - r.left, y: p.clientY - r.top };
      this.draw();
    };
    const salir = () => { this.hover = null; if (this.readoutEl) this.readoutEl.hidden = true; this.draw(); };

    this.canvas.addEventListener('pointermove', mover);
    this.canvas.addEventListener('pointerleave', salir);
    this.canvas.addEventListener('touchmove', mover, { passive: true });
    this.canvas.addEventListener('touchend', salir);
  }

  /* ---------- color desde los tokens CSS ---------- */
  _color(varName) {
    const raiz = this.canvas.closest('.viz-root') || document.documentElement;
    return getComputedStyle(raiz).getPropertyValue(varName).trim() || '#888';
  }

  setDatos(datos, ventanaMs) {
    this.datos = datos;
    if (ventanaMs) this.ventanaMs = ventanaMs;
  }

  /* ---------- escala Y ---------- */
  _escala() {
    let max = 0;
    for (const d of this.datos) {
      for (const v of d.v) { const a = Math.abs(v); if (a > max) max = a; }
    }
    if (!Number.isFinite(max) || max === 0) max = 1;

    // Paso "bonito" para que las etiquetas no bailen entre 1.37 y 1.41.
    const exp = Math.pow(10, Math.floor(Math.log10(max)));
    const norm = max / exp;
    const paso = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    const destino = paso * exp * 1.15;

    // Suavizado: el eje crece rápido y se encoge despacio. Sin esto,
    // un pico aislado hace saltar toda la gráfica al desaparecer.
    this.escalaSuave = destino > this.escalaSuave
      ? destino
      : this.escalaSuave + (destino - this.escalaSuave) * 0.08;

    return this.escalaSuave;
  }

  draw() {
    const { ctx, w, h, pad } = this;
    ctx.clearRect(0, 0, w, h);

    const gw = w - pad.l - pad.r;
    const gh = h - pad.t - pad.b;
    if (gw <= 0 || gh <= 0) return;

    const grid = this._color('--viz-grid');
    const axis = this._color('--viz-axis');
    const ink2 = this._color('--text-secondary');

    const max = this._escala();
    const yPx = v => pad.t + gh / 2 - (v / max) * (gh / 2);

    /* --- rejilla, deliberadamente recesiva --- */
    ctx.lineWidth = 1;
    ctx.strokeStyle = grid;
    ctx.fillStyle = ink2;
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (const frac of [1, 0.5, 0, -0.5, -1]) {
      const v = max * frac;
      const y = Math.round(yPx(v)) + 0.5;
      ctx.globalAlpha = frac === 0 ? 1 : 0.6;
      ctx.strokeStyle = frac === 0 ? axis : grid;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + gw, y); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillText(v.toFixed(max < 5 ? 1 : 0), pad.l - 7, y);
    }

    if (!this.datos.length) {
      ctx.textAlign = 'center';
      ctx.fillStyle = ink2;
      ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Sin datos todavía', pad.l + gw / 2, pad.t + gh / 2);
      return;
    }

    /* --- eje de tiempo --- */
    const tFin = this.datos[this.datos.length - 1].t;
    const tIni = tFin - this.ventanaMs;
    const xPx = t => pad.l + ((t - tIni) / this.ventanaMs) * gw;

    ctx.textAlign = 'center';
    ctx.fillStyle = ink2;
    ctx.font = '10px ui-monospace, Menlo, monospace';
    for (let k = 0; k <= 4; k++) {
      const x = pad.l + (gw * k) / 4;
      const seg = -(this.ventanaMs / 1000) * (1 - k / 4);
      ctx.fillText(seg === 0 ? 'ahora' : `${seg.toFixed(1)}s`, x, h - pad.b / 2 + 2);
    }

    /* --- líneas, 2px, sin marcadores por punto --- */
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.l, pad.t - 2, gw, gh + 4);
    ctx.clip();

    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const ultimos = [];
    SERIES.forEach((s, si) => {
      const col = this._color(s.varName);
      ctx.strokeStyle = col;
      ctx.beginPath();
      let primero = true;
      for (const d of this.datos) {
        const x = xPx(d.t), y = yPx(d.v[si]);
        primero ? (ctx.moveTo(x, y), primero = false) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      const fin = this.datos[this.datos.length - 1];
      ultimos.push({ label: s.label, color: col, y: yPx(fin.v[si]), v: fin.v[si] });
    });
    ctx.restore();

    /* --- etiquetas directas al final de cada línea ---
       La identidad no queda solo en el color: el aqua de la serie Z
       no alcanza 3:1 contra la superficie clara, así que la etiqueta
       visible es obligatoria, no decorativa. */
    this._etiquetasDirectas(ultimos, pad, gw);

    /* --- capa de hover --- */
    if (this.hover) this._dibujarHover(xPx, yPx, tIni, gw, gh);
  }

  _etiquetasDirectas(ultimos, pad, gw) {
    const { ctx } = this;
    // Separa etiquetas que se pisarían: mínimo 11 px entre centros.
    const orden = ultimos.map((u, i) => ({ ...u, i })).sort((a, b) => a.y - b.y);
    for (let k = 1; k < orden.length; k++) {
      if (orden[k].y - orden[k - 1].y < 11) orden[k].y = orden[k - 1].y + 11;
    }
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const u of orden) {
      ctx.fillStyle = u.color;
      ctx.fillText(u.label, pad.l + gw + 6, u.y);
    }
  }

  _dibujarHover(xPx, yPx, tIni, gw, gh) {
    const { ctx, pad } = this;
    const x = this.hover.x;
    if (x < pad.l || x > pad.l + gw) { if (this.readoutEl) this.readoutEl.hidden = true; return; }

    const tCursor = tIni + ((x - pad.l) / gw) * this.ventanaMs;

    // Búsqueda lineal: son unos cientos de puntos, no vale la pena binaria.
    let mejor = this.datos[0], dist = Infinity;
    for (const d of this.datos) {
      const dd = Math.abs(d.t - tCursor);
      if (dd < dist) { dist = dd; mejor = d; }
    }

    const mx = xPx(mejor.t);
    ctx.save();
    ctx.strokeStyle = this._color('--viz-axis');
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(mx, pad.t); ctx.lineTo(mx, pad.t + gh); ctx.stroke();
    ctx.setLineDash([]);

    // Anillo de 2px del color de la superficie: separa el punto de la línea.
    SERIES.forEach((s, si) => {
      const y = yPx(mejor.v[si]);
      ctx.beginPath(); ctx.arc(mx, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = this._color(s.varName); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = this._color('--surface-1'); ctx.stroke();
    });
    ctx.restore();

    if (!this.readoutEl) return;
    const seg = (mejor.t - (tIni + this.ventanaMs)) / 1000;
    this.readoutEl.innerHTML =
      `<div class="readout__t">${seg.toFixed(2)} s</div>` +
      SERIES.map((s, si) =>
        `<div class="readout__row">
           <span style="color:${this._color(s.varName)}">${s.label}</span>
           <b>${mejor.v[si].toFixed(this.dec)} ${this.unidad}</b>
         </div>`).join('');
    this.readoutEl.hidden = false;

    // Salta al otro lado del cursor antes de salirse por la derecha.
    const ancho = this.readoutEl.offsetWidth || 130;
    const izq = mx + 12 + ancho > this.w ? mx - 12 - ancho : mx + 12;
    this.readoutEl.style.left = `${Math.max(0, izq)}px`;
  }
}

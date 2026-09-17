/* ============================================================
   transports.js — de dónde salen los datos
   Cuatro caminos, una sola interfaz:
     connect() / disconnect() / onText(cb) / onState(cb)
   Todos entregan TEXTO crudo; el troceo en líneas lo hace main.js.
   ============================================================ */

/* UUID del servicio UART de Nordic. Es el de facto para "puerto serie
   sobre BLE" y el que usan los sketches de firmware/. */
const NUS = {
  service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  tx:      '6e400003-b5a3-f393-e0a9-e50e24dcca9e', // periférico → app (notify)
  rx:      '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // app → periférico (write)
};

class Transport {
  constructor() {
    this._text  = () => {};
    this._state = () => {};
    this.nombre = 'ninguno';
    this.conectado = false;
  }
  onText(cb)  { this._text  = cb; return this; }
  onState(cb) { this._state = cb; return this; }
  _emit(estado, msg) { this.conectado = estado === 'on'; this._state(estado, msg); }
  async connect()    { throw new Error('sin implementar'); }
  async disconnect() {}
}

/* ------------------------------------------------------------
   BLE — Web Bluetooth
   ------------------------------------------------------------ */
class BleTransport extends Transport {
  constructor() { super(); this.nombre = 'ble'; }

  static get soportado() { return typeof navigator !== 'undefined' && !!navigator.bluetooth; }

  async connect() {
    if (!BleTransport.soportado) throw new Error('Este navegador no tiene Web Bluetooth.');
    this._emit('wait', 'Buscando dispositivo…');

    // requestDevice() exige un gesto del usuario; se llama desde el clic.
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [NUS.service] }],
      optionalServices: [NUS.service],
    });

    this._onDisc = () => this._emit('off', 'El dispositivo se desconectó.');
    this.device.addEventListener('gattserverdisconnected', this._onDisc);

    this._emit('wait', 'Conectando…');
    const server  = await this.device.gatt.connect();
    const service = await server.getPrimaryService(NUS.service);
    this.txChar   = await service.getCharacteristic(NUS.tx);

    this.decoder = new TextDecoder();
    this._onNotif = (e) => this._text(this.decoder.decode(e.target.value));
    this.txChar.addEventListener('characteristicvaluechanged', this._onNotif);
    await this.txChar.startNotifications();

    this._emit('on', `BLE · ${this.device.name || 'dispositivo'}`);
  }

  async disconnect() {
    try { this.txChar?.removeEventListener('characteristicvaluechanged', this._onNotif); } catch {}
    try { this.device?.removeEventListener('gattserverdisconnected', this._onDisc); } catch {}
    try { if (this.device?.gatt?.connected) this.device.gatt.disconnect(); } catch {}
    this._emit('off', 'Sin conexión');
  }
}

/* ------------------------------------------------------------
   WiFi — WebSocket
   ------------------------------------------------------------ */
class WifiTransport extends Transport {
  constructor(url) { super(); this.nombre = 'wifi'; this.url = url; }

  async connect() {
    // Página en HTTPS + ws:// sin cifrar = el navegador lo bloquea sin aviso claro.
    if (location.protocol === 'https:' && this.url.startsWith('ws://')) {
      throw new Error('La página está en HTTPS: el navegador bloquea ws:// sin cifrar. Sirve la app por HTTP local o usa wss://.');
    }

    this._emit('wait', `Conectando a ${this.url}…`);

    await new Promise((resolve, reject) => {
      let resuelto = false;
      const ws = this.ws = new WebSocket(this.url);
      ws.binaryType = 'arraybuffer';

      // WebSocket no tiene timeout propio: si la IP no existe, el evento
      // 'error' puede tardar más de un minuto en llegar.
      const timeout = setTimeout(() => {
        if (resuelto) return;
        resuelto = true;
        try { ws.close(); } catch {}
        reject(new Error('Sin respuesta en 8 s. Revisa la IP y que el PC esté en la misma red.'));
      }, 8000);

      ws.onopen = () => {
        if (resuelto) return;
        resuelto = true; clearTimeout(timeout);
        this._emit('on', `WiFi · ${this.url}`);
        resolve();
      };

      ws.onerror = () => {
        if (resuelto) return;
        resuelto = true; clearTimeout(timeout);
        reject(new Error('No se pudo abrir el WebSocket. Revisa la dirección.'));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        if (resuelto) this._emit('off', 'El WebSocket se cerró.');
      };

      ws.onmessage = (e) => {
        if (typeof e.data === 'string') this._text(e.data);
        else this._text(new TextDecoder().decode(e.data));
      };
    });
  }

  async disconnect() {
    try { if (this.ws) { this.ws.onclose = null; this.ws.close(); } } catch {}
    this._emit('off', 'Sin conexión');
  }
}

/* ------------------------------------------------------------
   Serial — Web Serial
   ------------------------------------------------------------ */
class SerialTransport extends Transport {
  constructor(baud = 115200) { super(); this.nombre = 'serial'; this.baud = baud; }

  static get soportado() { return typeof navigator !== 'undefined' && !!navigator.serial; }

  async connect() {
    if (!SerialTransport.soportado) throw new Error('Este navegador no tiene Web Serial.');
    this._emit('wait', 'Eligiendo puerto…');

    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: this.baud });

    this._emit('on', `Serial · ${this.baud} baudios`);
    this._leer();   // a propósito sin await: el bucle vive hasta desconectar
  }

  async _leer() {
    const decoder = new TextDecoderStream();
    this._cerrado = this.port.readable.pipeTo(decoder.writable).catch(() => {});
    this.reader = decoder.readable.getReader();

    try {
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) this._text(value);
      }
    } catch {
      this._emit('err', 'Se perdió el puerto serial.');
    }
  }

  async disconnect() {
    try { await this.reader?.cancel(); } catch {}
    try { await this._cerrado; } catch {}
    try { await this.port?.close(); } catch {}
    this._emit('off', 'Sin conexión');
  }
}

/* ------------------------------------------------------------
   Simulador — gestos sintéticos
   Sirve para probar interfaz y exports sin hardware. Las firmas
   imitan lo que se espera de cada clase, con ruido encima.
   ------------------------------------------------------------ */
class SimTransport extends Transport {
  constructor(gesto = 'agitar', hz = 100) {
    super();
    this.nombre = 'sim';
    this.gesto = gesto;
    this.hz = hz;
  }

  setGesto(g) { this.gesto = g; }

  async connect() {
    this.t0 = performance.now();
    this.k = 0;

    this.timer = setInterval(() => {
      const t = this.k * (1000 / this.hz);
      const m = this._muestra(t / 1000);
      this._text(`D,${t.toFixed(0)},${m.join(',')}\n`);

      // Una inferencia por segundo, como haría la placa.
      if (this.k % this.hz === 0) {
        const conf = 0.72 + Math.random() * 0.26;
        this._text(`I,${this.gesto},${conf.toFixed(3)}\n`);
      }
      this.k++;
    }, 1000 / this.hz);

    this._emit('on', `Simulador · ${this.gesto} @ ${this.hz} Hz`);
  }

  _muestra(s) {
    const r = (a = 0.04) => (Math.random() - 0.5) * 2 * a;
    let ax, ay, az, gx, gy, gz;

    switch (this.gesto) {
      case 'agitar':  // oscilación fuerte y periódica ~4 Hz
        ax = 1.9 * Math.sin(2 * Math.PI * 4 * s);
        ay = 0.5 * Math.sin(2 * Math.PI * 4 * s + 1.1);
        az = 1 + 1.6 * Math.cos(2 * Math.PI * 4 * s);
        gx = 190 * Math.cos(2 * Math.PI * 4 * s); gy = 60 * Math.sin(2 * Math.PI * 4 * s); gz = 35 * r(1);
        break;
      case 'remover': // rotación suave y sostenida ~1.5 Hz
        ax = 0.32 * Math.sin(2 * Math.PI * 1.5 * s);
        ay = 0.32 * Math.cos(2 * Math.PI * 1.5 * s);
        az = 1 + 0.06 * Math.sin(2 * Math.PI * 3 * s);
        gx = 22 * Math.sin(2 * Math.PI * 1.5 * s); gy = 22 * Math.cos(2 * Math.PI * 1.5 * s); gz = 96;
        break;
      case 'servir':  // inclinación mantenida: la gravedad cambia de eje
        { const a = Math.min(1, s / 1.4) * (Math.PI / 2.4);
          ax = Math.sin(a); ay = 0.05 * Math.sin(2 * Math.PI * 0.6 * s); az = Math.cos(a);
          gx = s < 1.4 ? 42 : 3; gy = r(4); gz = r(4); }
        break;
      case 'macerar': // impactos verticales cortos ~2.5 Hz
        { const f = Math.pow(Math.abs(Math.sin(2 * Math.PI * 2.5 * s)), 9);
          ax = r(0.12); ay = r(0.12); az = 1 + 3.4 * f;
          gx = r(14); gy = r(14); gz = r(9); }
        break;
      case 'colar':   // giro marcado y parada
        { const act = s < 1.6;
          const a = Math.min(1, s / 1.6) * (Math.PI / 2);
          ax = Math.sin(a) * 0.9; ay = r(0.1); az = Math.cos(a) * 0.9 + 0.15;
          gx = act ? 118 : r(3); gy = act ? 28 : r(3); gz = r(5); }
        break;
      default:        // reposo: solo gravedad y ruido del sensor
        ax = r(0.02); ay = r(0.02); az = 1 + r(0.02);
        gx = r(0.8); gy = r(0.8); gz = r(0.8);
    }

    return [
      (ax + r(0.05)).toFixed(4), (ay + r(0.05)).toFixed(4), (az + r(0.05)).toFixed(4),
      (gx + r(2.5)).toFixed(2),  (gy + r(2.5)).toFixed(2),  (gz + r(2.5)).toFixed(2),
    ];
  }

  async disconnect() {
    clearInterval(this.timer);
    this._emit('off', 'Sin conexión');
  }
}

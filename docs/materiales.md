# 🛒 Materiales y presupuesto — Coctelera TinyML

Arquitectura actual: **coctelera instrumentada + TinyML + BLE + app**.  
El dispositivo se centra en adquisición de movimiento, inferencia local y envío de resultados a la app. La OLED y el RGB son opcionales como feedback local.

> Precios aproximados en Mercado Libre Colombia. Pueden cambiar y no incluyen necesariamente envío.

| Cant. | Componente | Tipo | Precio aprox. | Función | Compra |
|---:|---|---|---:|---|---|
| 1 | Coctelera metálica / kit básico | Esencial | $37.211 | Recipiente donde se realizan los movimientos | [Mercado Libre](https://www.mercadolibre.com.co/kit-cocteleria-5pzs-coctelera-350ml-set-bartender-jigger-bar/p/MCO2104417372) |
| 1 | Arduino Nano 33 BLE Rev2 | Esencial | $160.482 | IMU + TinyML + BLE | [Mercado Libre](https://www.mercadolibre.com.co/arduino-nano-33-ble-rev2-nrf52840-iot-ble-33v/p/MCO2101503980) |
| 1 | OLED SSD1306 0.96" I²C | Opcional | $32.900 | Feedback local de estado/gesto | [Mercado Libre](https://www.mercadolibre.com.co/display-pantalla-oled-096-blanco-white-i2c/p/MCO2043117585) |
| 1 | LED RGB WS2812B | Opcional | $11.000 | Estado de captura/BLE/error | [Mercado Libre](https://listado.mercadolibre.com.co/ws2812b) |
| 1 | Batería LiPo 3.7 V 1000 mAh | Esencial | $29.000 | Alimentación autónoma | [Mercado Libre](https://listado.mercadolibre.com.co/bateria-lipo-3.7v-1000-mah) |
| 1 | TP4056 USB-C con protección | Esencial | $9.638 | Carga y protección de batería | [Mercado Libre](https://listado.mercadolibre.com.co/tp4056-usb-c) |
| 1 | MT3608 Step-Up | Esencial | $7.699 | Conversión de tensión | [Mercado Libre](https://www.mercadolibre.com.co/modulo-mt3608-elevador-usb-tipo-c-convertidor-dc-2a-regulado/p/MCO2044123550) |
| 1 | Interruptor ON/OFF mini | Esencial | $6.000 | Encendido físico | [Mercado Libre](https://listado.mercadolibre.com.co/interruptor-deslizante) |
| 1 | Conector JST | Esencial | $4.416 | Desconexión de batería | [Mercado Libre](https://listado.mercadolibre.com.co/kit-conectores-jst) |
| 1 | Carcasa lateral impresa en 3D | Esencial | $15.000 est. | Encerrar y proteger electrónica | [Mercado Libre](https://listado.mercadolibre.com.co/impresion-3d-servicio) |
| 1 | Velcro / abrazadera | Esencial | $11.305 | Fijación sin perforar la coctelera | [Mercado Libre](https://listado.mercadolibre.com.co/cinta-velcro) |
| 1 | Cables, Dupont y conectores | Esencial | $13.300 | Cableado y prototipo | [Mercado Libre](https://listado.mercadolibre.com.co/cables-hembra-hembra-arduino) |

## 💰 Escenarios de costo

| Escenario | Costo aprox. |
|---|---:|
| Todo desde cero | **$337.951 COP** |
| Reutilizando el Arduino del grupo | **$177.469 COP** |
| MVP mínimo: sin comprar Arduino + sin OLED + sin RGB | **$133.569 COP** |
| MVP mínimo + margen de $25.000 | **$158.569 COP** |

## ✅ Qué comprar primero

Para arrancar la captura de datos no hace falta tener toda la interfaz terminada. Prioridad:

1. Arduino Nano 33 BLE del grupo.
2. Batería + sistema de carga.
3. Coctelera.
4. Sistema de fijación/carcasa.
5. Cableado.
6. OLED y RGB después, si se decide conservar feedback local.

## ⚠️ Nota del alcance

Servo, relé, motor vibrador y otros actuadores quedaron **fuera de la lista principal** porque el diseño actual está centrado en que la coctelera capture y clasifique los movimientos y que la **app represente la interacción**.

Sin embargo, la guía guardada en `docs/requisitos.md` todavía menciona un actuador distinto por clase. Antes de cerrar el diseño hay que confirmar con el profesor si la representación en la app reemplaza ese requisito o si deben conservarse actuadores adicionales para evaluación.

# 📊 Decisión del grupo

## 🏆 Idea seleccionada

La propuesta elegida para el Miniproyecto 1 es:

### 🍸 **Bartender TinyML — coctelera inteligente + app interactiva**

La decisión se tomó porque combina un problema claro, gestos inerciales distinguibles, una demo visual y un espacio de investigación suficientemente original para el paper.

## ✅ Razones principales

| Criterio | Lectura final |
|---|---|
| Gestos fáciles de separar | Alta: agitar, remover, servir, macerar y colar tienen patrones distintos |
| Encaje con TinyML | Muy alto: IMU + clasificación en dispositivo |
| Facilidad de capturar dataset | Alta: puede hacerse en casa/laboratorio |
| Originalidad | Alta frente a propuestas típicas de HAR |
| Demo | Muy visual y fácil de explicar |
| Experiencia de usuario | App estilo juego de cocina paso a paso |

## 🧠 Arquitectura elegida

La coctelera será principalmente un **dispositivo autónomo de toma de datos e inferencia**:

```text
IMU del Arduino Nano 33 BLE
        ↓
modelo TinyML
        ↓
gesto + confianza
        ↓ BLE
app móvil / tablet
```

La app mostrará recetas, gesto solicitado, temporizador, confianza, puntuación y progreso.

La OLED y el RGB quedan como **feedback local opcional**. Servo, relé, motor vibrador y otros actuadores dejan de ser el centro del diseño.

## 📱 Concepto visual

La experiencia se inspira en juegos de cocina: menú de recetas, modo práctica, modo juego y puntuación por estrellas.

Nombre visual provisional: **MixLab**.

## 🤲 Clases

1. `agitar`
2. `remover`
3. `servir`
4. `macerar`
5. `colar`
6. `reposo`

## ⚠️ Validaciones pendientes con el profesor

1. La guía guardada actualmente exige **un actuador distinto por clase**. Hay que confirmar si la representación de la respuesta en la app puede sustituir ese requisito.
2. Confirmar si usar la app como parte central del MVP consume el comodín de aplicación móvil.
3. Confirmar que la comunicación BLE placa → app cumple completamente el requisito de autonomía durante la demostración.

## 📝 Acta

- **Fecha de la decisión:** 12-sep-2026
- **Idea elegida:** Bartender TinyML / coctelera inteligente + app
- **Por qué:** mejor balance entre originalidad, viabilidad, calidad del dataset y experiencia de demostración.
- **Hardware principal:** Arduino Nano 33 BLE + IMU integrada + batería autónoma.
- **Interfaz:** app móvil/tablet por BLE; OLED/RGB opcionales.
- **Primera prioridad:** construir módulo lateral y capturar dataset propio.

### Reparto de trabajo

- **César:** integración del proyecto, TinyML/app/documentación.
- **Díaz Rangel:** por definir con el grupo.
- **Santana:** hardware/Nano 33 BLE y apoyo en captura; por cerrar con el grupo.

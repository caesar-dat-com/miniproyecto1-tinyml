# 🔬 Estado del arte

Búsqueda hecha el 8-sep-2026 para saber contra qué competimos y qué ya está resuelto.
Sirve para dos cosas: elegir idea con criterio y tener referencias que citar en el paper IEEE.

---

## 🎾 Reconocimiento de golpes de tenis con IMU

**Veredicto: resuelto, muy publicado, precisión alta.** Riesgo técnico bajo,
originalidad baja.

| Trabajo | Qué hizo | Resultado |
|---|---|---|
| *A Robust Deep Learning Framework for Skill Level Discrimination in Tennis Strokes Using Bilateral IMU Measurements* (Sensors, 2026) | 39 jugadores en cancha real, IMU en ambas muñecas, 20 drives / 20 revés / 10 saques / 10 voleas cada uno. Arquitectura CNN-BiLSTM | **95,54 %** de accuracy |
| *Tennis Stroke Detection and Classification Using Miniature Wearable IMU Device* | Detección y clasificación de los tres golpes más comunes | **98,1 %** de accuracy |
| Estudios con acelerómetro ±16 g y giroscopio ±2000 °/s en muñeca | SVM sobre saque, drive y revés en distintos niveles de juego | **f1 > 0,90** |
| *Tennis Stroke Classification: Comparing Wrist and Racket as IMU Sensor Position* (Aalto) | Compara poner el sensor en la muñeca o en la raqueta | Ambas posiciones sirven |

**Lo que nos dice:**
- Configurar el acelerómetro a **±16 g**: un golpe de tenis satura los rangos bajos.
- El **giroscopio** es el que separa drive de revés, que son movimientos espejo.
- Con modelos clásicos (SVM, random forest) ya se pasa del 90 %. No hace falta deep
  learning para el miniproyecto.
- Como está tan publicado, el paper necesita un aporte propio para no ser una réplica.

---

## 🍸 Gestos de coctelería y de servir con IMU

**Veredicto: poco explorado. Hay precedentes que citar, pero no un proyecto igual.**
Originalidad alta.

| Trabajo | Qué hizo | Para qué nos sirve |
|---|---|---|
| *Cocktail: Exploiting Bartenders' Gestures for Mobile Interaction* | Usa gestos de bartender (servir, agitar) como interacción con el móvil: se "sirven" datos de un equipo a otro y se "agita" para mezclar música | Precedente directo de que los gestos de bartender son reconocibles y distinguibles |
| Patente US 11.383.967 — *Monitoring beverage pours* | Motor cinemático por IMU que muestrea una servida, le genera una firma y busca coincidencias en una base de datos: identifica **quién** sirvió | Confirma que la servida tiene una firma inercial estable y personal |
| *InGesture: An eight-class inertial sensor dataset for fluid intake and hand-gesture recognition* | Dataset inercial público de 8 clases de gestos con líquidos | Referencia metodológica de cómo etiquetar gestos con bebidas |
| *Proactive Conversational Assistant for a Procedural Manual Task based on Audio and IMU* (arXiv) | Smartwatch en la muñeca dominante, audio + IMU a una red neuronal, reconoce actividades de cocina incluida la de servir | Es exactamente el patrón "Cooking Mama": guiar una tarea procedimental paso a paso |

**Lo que nos dice:**
- Servir, agitar y remover ya se han reconocido por separado en la literatura. **Nadie
  los ha juntado en un tutor de coctelería embebido.** Ahí está el hueco.
- El problema recurrente en esta línea es distinguir **movimientos visualmente
  parecidos** (beber vs llevarse la mano a la cara). Para nosotros la lección es directa:
  `agitar` y `macerar` son los dos que hay que vigilar, y se separan por **eje dominante
  y frecuencia**, no por amplitud.
- Un asistente que guía una tarea paso a paso es un patrón validado. No estamos
  inventando la metodología, solo el dominio.

---

## 🧠 Metodología común

- Modelos usados en la literatura: Naive Bayes, SVM, árboles, random forest, kNN, redes
  neuronales, regresión logística. **Para 5 clases con gestos bien separados, una red
  densa pequeña sobre features espectrales sobra** — que es justo lo que da Edge Impulse.
- Ventana típica: 1–2 s. Frecuencia: 50–100 Hz.
- Repartir la captura entre varias personas mejora la generalización.

---

## 📚 Fuentes

- [A Robust Deep Learning Framework for Skill Level Discrimination in Tennis Strokes Using Bilateral IMU Measurements](https://doi.org/10.3390/s26103273) — Sensors, 2026
- [Versión en PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13210761/)
- [Tennis Stroke Detection and Classification Using Miniature Wearable IMU Device](https://www.researchgate.net/publication/303522415_Tennis_Stroke_Detection_and_Classification_Using_Miniature_Wearable_IMU_Device)
- [Tennis Stroke Classification: Comparing Wrist and Racket as IMU Sensor Position](https://ambientintelligence.aalto.fi/paper/Tennis_Stroke_Recognition.pdf) — Aalto University
- [A real-time tennis level evaluation and strokes classification system based on the IoT](https://www.sciencedirect.com/science/article/abs/pii/S2542660521001335)
- [Cocktail: Exploiting Bartenders' Gestures for Mobile Interaction](https://www.researchgate.net/publication/220586490_Cocktail_Exploiting_Bartenders'_Gestures_for_Mobile_Interaction)
- [Monitoring beverage pours — US 11.383.967](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11383967)
- [InGesture: An eight-class inertial sensor dataset for fluid intake and hand-gesture recognition](https://pmc.ncbi.nlm.nih.gov/articles/PMC13136770/)
- [Proactive Conversational Assistant for a Procedural Manual Task based on Audio and IMU](https://arxiv.org/pdf/2602.15707)
- [Awesome-IMU-Sensing](https://github.com/rh20624/Awesome-IMU-Sensing) — recopilación de datasets y papers de HAR con IMU

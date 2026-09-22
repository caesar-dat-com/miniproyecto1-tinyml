---
title: "MixLab: coctelera inteligente con TinyML para el reconocimiento de gestos de cocteleria"
authors:
  - Cesar Armando Reyes Oliveros
  - Juan Camilo Diaz Rangel
  - Sebastian Santana
affiliation: Facultad de Ingenieria, Universidad Autonoma de Occidente, Cali, Colombia
lang: es
---

# Resumen

El aprendizaje de tecnicas de cocteleria requiere retroalimentacion de un experto
que no siempre esta disponible. Este trabajo presenta MixLab, una coctelera
inteligente que reconoce cinco gestos de cocteleria (agitar, macerar, remover,
servir y reposo de mano) mas la clase reposo, mediante una red neuronal
convolucional 1D entrenada sobre datos del sensor inercial del Arduino Nano 33
BLE Sense y desplegada en la propia placa con TensorFlow Lite Micro. El modelo
final alcanza 98,7% de exactitud en validacion cruzada agrupada por toma,
recall >= 97% en las seis clases, y ocupa 15,25 KB cuantizado a int8, dentro de
los 256 KB de RAM del Nano 33 BLE. La coctelera transmite cada gesto reconocido
por Bluetooth Low Energy a una aplicacion web que guia la preparacion de la
receta paso a paso. El sistema cumple las restricciones del curso: la placa
opera con bateria y sin computador conectado, y toda la comunicacion es
inalambrica. Este proyecto contribuye al ODS 4 (educacion de calidad) al
democratizar el acceso a retroalimentacion de calidad en el aprendizaje
motor de cocteleria.

**Palabras clave** — TinyML, reconocimiento de actividad, IMU, BLE, Edge Impulse,
Arduino Nano 33 BLE Sense, educacion.

# 1. Introduccion

Aprender a preparar cocteles correctamente exige retroalimentacion continua:
la diferencia entre agitar y remover cambia la textura de la bebida, y un
practicante sin bartender experto a su lado no sabe si ejecuto bien el gesto.
La literatura de aprendizaje motor muestra que la retroalimentacion inmediata
es el factor mas determinante de la mejora; sin ella, el principiante repite
errores.

MixLab aborda ese problema con TinyML: un modelo de clasificacion de ventanas
de acelerometro corre dentro de la propia coctelera (el Arduino Nano 33 BLE
Sense montado en ella), reconoce el gesto en tiempo real y lo transmite por
Bluetooth Low Energy (BLE) a una aplicacion web que compara lo ejecutado con
la receta pedida. El usuario ve al instante si agito correctamente o si debe
repetir.

El proyecto se alinea con el ODS 4 (educacion de calidad) al hacer accesible
la retroalimentacion experta en un aprendizaje normalmente reservado a quien
paga clases o trabaja en un bar.

Contribuciones:

1. Dataset propio de 60 tomas de IMU con 6 clases de gestos de cocteleria,
   capturado con la misma placa usada para el despliegue.
2. Evaluacion honesta del pipeline: particion por toma (no por ventana) y
   exclusion del magnetometro, con medicion del efecto de ambas decisiones.
3. Despliegue funcional end-to-end: inferencia a bordo con TFLM int8, transmision
   BLE y aplicacion web de guia de recetas con simulador para desarrollo sin
   hardware.

# 2. Trabajos relacioneados

El reconocimiento de actividad humana (HAR) con acelerometros es un campo
maduro [1], [2], y su variante embebida (TinyML) se popularizo con Pete Warden
y Daniel Situnayake [3]. Edge Impulse [4] industrializo el flujo de captura,
etiquetado y despliegue para microcontroladores. En el aula, el material del
curso (clasificacion de movimiento con RNA denso sobre 39 caracteristicas
manuales [5]) establece la linea base que este proyecto compara contra una
CNN 1D sobre la senal cruda. A diferencia de HAR clasico (caminar, correr,
estar de pie), MixLab ataca gestos finos de manipulacion con un solo objeto en
la mano, donde clases como remover y reposo difieren por decimas de g.

# 3. Sistema propuesto

Bloques del sistema:

1. **Captura:** el IMU del Nano 33 BLE Sense a 62,5 Hz muestrea acelerometro
   (y giroscopio/magnetometro en captura) mientras el usuario ejecuta el
   gesto con la coctelera.
2. **Modelo:** ventana de 2 s (125 muestras, 3 ejes), normalizada, atraviesa
   una CNN 1D cuantizada a int8.
3. **Inferencia a bordo:** TensorFlow Lite Micro interpreta el modelo en la
   placa; el resultado (gesto y confianza) sale por BLE (servicio UART de
   Nordic, UUID 6e400001-...) como linea JSON.
4. **App MixLab:** aplicacion web (HTML/CSS/JS sin dependencias) que recibe el
   JSON por Web Bluetooth y guia la receta paso a paso; incluye simulador de
   los seis gestos para desarrollo sin hardware, y transportes alternativos
   (WiFi, serial) para depuracion.
5. **Alimentacion:** power bank USB; la placa no se conecta al PC durante el
   uso, cumpliendo la restriccion del curso.

# 4. Recoleccion de datos

Se capturaron 60 tomas (10 por clase) con Edge Impulse usando el firmware de
captura del repo (nano33ble_imu_ble), a 62,5 Hz y 9 ejes (acc/gyr/mag), 10 s
por toma excepto remover (4 s, ver seccion 8). Clases: agitar, macerar,
remover, servir, reposo y reposo_mano. La guia del curso exige cinco clases
de movimiento mas reposo; el grupo decidio sustituir la clase colar (ver
seccion 8) por reposo_mano, decision documentada con sus limitaciones.

# 5. Metodologia de entrenamiento

Dos vias, siguiendo la metodologia del curso [5]:

- **Via A — caracteristicas manuales:** por ventana de 2 s se extraen
  3 RMS + 3 asimetria + 3 kurtosis + 9 amplitudes FFT + 9 picos de frecuencia
  + 12 PSD = 39 caracteristicas, que alimentan una red densa 20-10-softmax.
- **Via B — CNN 1D:** la ventana cruda normalizada (125x3) entra a una CNN 1D.

Decisiones metodologicas medidas (no supuestas):

- **Particion por toma, no por ventana.** Las ventanas se solapan (paso 25
  sobre 125); si el azar reparte ventanas de una misma toma entre train y
  test, la exactitud se infla +13,3 puntos. Se uso GroupShuffleSplit agrupando
  por archivo de origen, con verificacion asertiva de no-fuga.
- **Exclusion del magnetometro.** Incluirlo eleva la exactitud aparente
  (0,87 a 0,99 en Via A), pero esa ganancia proviene de la orientacion del
  sitio de captura, no del gesto: es fuga. Se excluyo.
- **Ponderacion de clases (class_weight):** remover aporta 60 de 1020
  ventanas (5,9%) por su duracion de 4 s; se pondero para no penalizarla.
- **Ventana de 2 s = 125 muestras:** los datos se capturaron a 62,5 Hz, no a
  100 Hz como el ejemplo del curso; copiar ventana=200 habria sido un error
  de 1,6 s. Se verifica con assert sobre interval_ms=16.0.

Entrenamiento en Google Colab (runtime T4), replicando el flujo de la clase
del curso.

# 6. Resultados

Validacion cruzada agrupada por toma, 5 pliegues:

| Metrica | Via A (39 caract.) | Via B (CNN 1D) |
|---|---|---|
| Exactitud CV | 0,951 ± 0,031 | **0,987 ± 0,012** |
| Media de recall por clase | 0,960 | **0,990** |
| Tamanio int8 | 4,41 KB | 15,25 KB |
| Perdida por cuantizacion | -1,2 pp | 0,0 pp |

Recall por clase (Via B, tras regrabar remover): agitar 1,00, macerar 0,97,
remover 1,00, reposo 1,00, reposo_mano 1,00, servir 0,97.

La Via B gana y cabe en la placa: 15,25 KB de flash y ~13-15 KB de RAM de los
256 KB disponibles. La cuantizacion int8 no degrada la Via B.

# 7. Despliegue

El firmware nano33ble_mixlab_inferencia corre TFLM a bordo: llena la ventana
125x3 al ritmo del IMU, normaliza con las constantes del entrenamiento,
ejecuta la inferencia y transmite {"g":"agitar","p":0.87} por BLE. La app
MixLab lo recibe por Web Bluetooth (contexto seguro: https o localhost) y
guia la receta. Compila a 61% de flash y 39% de RAM del Nano 33 BLE. Durante
la demostracion la placa se alimenta de power bank, sin computador, y la app
corre en un telefono o laptop conectado solo por BLE.

# 8. Problemas encontrados y solucion

1. **Etiquetas por toma (D1):** el export de Edge Impulse trae 60 etiquetas
   distintas (Agitar 01, Agitar 02...); se regenero info-6clases.labels con
   6 clases normalizadas.
2. **Sin particion de test (D3):** todas las tomas estaban en training/; se
   adopto validacion cruzada agrupada por toma como medida honesta y quedo
   pendiente un test capturado aparte.
3. **Desbalance de remover (D4):** las tomas de remover duran 4 s frente a
   10 s del resto; aporta 3,5x menos ventanas. Mitigado con class_weight;
   queda parcialmente abierto.
4. **Magnetometro sesgado por sitio (D5):** su inclusion elevaba la metrica
   por orientacion del sitio, no por gesto; excluido y documentada la medida.
5. **Senal plana en remover (D7):** las 10 tomas originales de remover tenian
   std_acc 0,032-0,106, igual que reposo: no habia movimiento real y el modelo
   clasificaba la postura, no el gesto. Se regrabaron las 10 tomas con
   movimiento real (std_acc 0,38-1,32, frecuencia dominante 3,24 Hz) y el
   recall subio de 0,90 a 1,00.
6. **Sustitucion de colar:** la guia exige cinco movimientos; el grupo decidio
   sustituir colar (gesto dificil de diferenciar de servir en la senal del
   acelerometro) por reposo_mano. Decision del grupo, documentada; el
   requisito 2 queda parcialmente cubierto y es el pendiente principal.

# 9. Conclusiones y trabajo futuro

MixLab demuestra el ciclo completo de TinyML con datos propios: captura,
entrenamiento honesto (particion por toma, exclusion de fugas), cuantizacion,
despliegue a bordo y aplicacion final. El modelo reconoce seis clases con
97% de recall en la placa y la aplicacion cierra el ciclo de
retroalimentacion. Trabajo futuro: capturar la clase colar y un test aparte,
explorar la inclusion del giroscopio (que mejoro la Via B en ablacion,
0,995, y se pospuso a un dia de la entrega), integrar los actuadores fisicos
por clase, y publicar el proyecto de Edge Impulse con el enlace en el informe.

# Referencias

[1] L. Bao and S. Intille, "Activity recognition from user-annotated
acceleration data," Pervasive Computing, 2004.
[2] J. R. Kwapisz, G. M. Weiss, and S. Moore, "Activity recognition using
cell phone accelerometers," ACM SIGKDD, 2011.
[3] P. Warden and D. Situnayake, TinyML: Machine Learning with TensorFlow
Lite on Arduino and Ultra-Low-Power Microcontrollers. O'Reilly, 2020.
[4] Edge Impulse, "Edge Impulse documentation," edgeimpulse.com.
[5] J. A. Lopez y J. C. Giraldo, "Un ejemplo de clasificacion de movimiento,"
material del curso IA en Dispositivos Moviles y Embebidos, UAO, 2025.
[6] N. Nordic Semiconductor, "Nordic UART Service (NUS)," developer.nordicsemi.com.

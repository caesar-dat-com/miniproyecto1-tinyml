# Auditoría de entrega — MixLab

Revisión del 22 de septiembre de 2026. Fuente primaria: texto de
`Miniproyecto_1_TinyML_Guia_2026.docx`, no solo el resumen anterior.
Alcance: inspección estática de app, firmware, dataset, notebooks, paper y documentación.
No equivale a una prueba física ni a una certificación de cumplimiento.

| Requisito | Evidencia del repositorio | Estado / acción necesaria |
|---|---|---|
| Dataset propio inercial | 60 rutas válidas en `info-6clases.labels`, 10 por clase | Existe; conservar evidencias de captura del equipo |
| Cinco movimientos + reposo | Modelo: agitar, macerar, remover, servir, reposo, reposo_mano | **No cumple**: cuatro movimientos; capturar y entrenar colar |
| Acción observable por movimiento | Recetas y puntuación responden a clase/confianza | Parcial: mostrar acciones diferenciadas de los cinco movimientos en demo |
| Entrenar en Edge Impulse y enlace público en informe | `edge-impulse/README.md` todavía dice pendiente | **Pendiente**; Colab no sustituye este entregable |
| Alimentación y datos sin PC conectado | Firmware de inferencia con BLE, arranque sin esperar Serial | Implementado en código; verificar físicamente con batería |
| MVP funcional | App, firmware, modelo y simulador presentes | Pendiente demo real; simulador no demuestra inferencia del vaso |
| Paper IEEE | `paper/paper.tex` usa IEEEtran; hay PDF | Parcial: corregir afirmaciones y regenerar PDF final |
| Código | App, cuatro sketches, notebooks y modelos | Presente |
| Sustentación de máximo 15 minutos | No se verificó ensayo ni presentación final | Ensayar problema, solución, entrenamiento y pruebas |
| Comodín móvil | Interfaz web adaptable | Acordar uso del comodín si la demo se realiza como app móvil |
| ODS | Paper menciona ODS 4 | Recomendado, no obligatorio |

## Corrección importante sobre actuadores

La sección 3.2 de la guía **permite acciones distintas dentro de un videojuego**
como actuadores. No exige necesariamente cinco motores físicos diferentes.
Los LEDs solos no sirven. Documentar qué acción observable dispara cada clase;
no presentar el paso temporizado colar como una acción reconocida por TinyML.

## Hallazgos técnicos

- `colar` continúa como paso guiado sin medición: solución válida de interfaz,
  pero no satisface la quinta clase del dataset.
- `reposo_mano` sí se recibe por el parser y se muestra como texto de respaldo;
  falta en el catálogo de clases de captura/práctica. No cuenta como quinto gesto.
- Header del modelo y export del notebook coinciden en la revisión previa;
  mantener normalización, orden de etiquetas y unidades juntos al reentrenar.
- Los tres notebooks tienen salidas guardadas sin objetos de error. Esto no
  demuestra que una ejecución nueva sea reproducible ni mide latencia en placa.
- Persisten archivos `info.labels` históricos incorrectos: usar exclusivamente
  `info-6clases.labels` para el dataset actual.
- Captura web a 50 Hz en g frente a entrenamiento de 62,5 Hz en m/s²:
  no mezclar nuevas tomas sin convertir unidades y remuestrear o reentrenar.
- `remover` tiene 10 tomas pero menos ventanas: no confundir igualdad de tomas
  con igualdad de duración o balance efectivo.

## Paper: corregir antes de entregar

El abstract de `paper.tex` afirma cinco gestos + reposo, pero el modelo tiene
cuatro gestos + dos reposos. También afirma despliegue funcional y uso de batería
sin adjuntar en esta revisión evidencia de pruebas físicas. El paper cita +13,3 pp
de inflación por fuga mientras `notebooks/README.md` reporta +9,4 pp: reconciliar
con la corrida elegida. Verificar las cifras 61% flash / 39% RAM con un log de
compilación. Añadir el enlace público Edge Impulse y el diagrama de bloques al
informe final. No entregar el PDF antiguo como si incluyera estas correcciones.

## Checklist de cierre

- [ ] Capturar colar y reentrenar; comprobar su salida antes de habilitar medición.
- [ ] Publicar entrenamiento Edge Impulse y enlazarlo en README e informe.
- [ ] Probar cada gesto con varias personas; guardar resultados y errores.
- [ ] Registrar compilación, RAM/flash, latencia, desconexión y reconexión BLE.
- [ ] Demostrar batería + BLE sin USB al PC, incluyendo receta completa.
- [ ] Corregir paper y regenerar PDF; ensayar una presentación de hasta 15 min.

## Cambios de interfaz de esta revisión

Nueva capa `app/css/motion.css`: entradas escalonadas, respuesta de iconos,
transiciones de medidores, estado conectado, aparición de resultados y estrellas.
Controles con foco visible y ajustes móviles. Colar oculta la barra de confianza
en vez de aparentar 0%. Movimiento reducido desactiva todas las animaciones.
No se modificaron firmware, transportes ni pesos del modelo.

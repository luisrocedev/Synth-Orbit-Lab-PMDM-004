# Actividad 004 · Síntesis de sonido

**Alumno:** Luis Jahir Rodriguez Cedeño  
**DNI:** 53945291X  
**Curso:** DAM2 - Programación multimedia y en dispositivos móviles  
**Unidad:** 301-Actividades final de unidad - Segundo trimestre  
**Actividad:** 004-Sintesis de sonido

## 1) Base didáctica respetada
El desarrollo parte de ejercicios reales de clase:
- `001-sintesis musical.html` (osciladores y reproducción por notas)
- `002-pentagrama.html` (editor visual de notas)
- `006-audio buffer.html` y `008-mejoras visuales.html` (pelotas rebotando y disparo sonoro)

Se mantiene la temática de síntesis por computadora y su relación con interfaces visuales animadas.

## 2) Modificaciones estéticas y visuales (alto impacto)
- Rediseño completo tipo dashboard interactivo.
- Escenario principal en canvas con doble órbita musical (graves y agudos).
- Celdas de secuenciador visual 16x7 con resaltado en tiempo real.
- Panel lateral de analítica con KPIs, ranking y biblioteca de composiciones.

## 3) Modificaciones funcionales (alto calado, segundo curso)
Se transforma una demo frontend en una solución full-stack:

### Backend y base de datos
- API REST con Flask.
- SQLite con cuatro tablas relacionales:
  - `performers`
  - `compositions`
  - `jam_sessions`
  - `synth_events`

### Funcionalidad avanzada implementada
- Registro de performer (nombre + DNI) con sesiones persistentes.
- Motor físico de rebotes con síntesis por colisión en dos escalas.
- Secuenciador por pasos con BPM y tipo de oscilador configurables.
- Guardado/carga de composiciones completas (`grid` + `scene` física).
- Trazabilidad de eventos de síntesis (`note`, `spawn_ball`) en BD.
- Métricas globales y leaderboard de rendimiento musical.

Este alcance añade modelado de datos, API, telemetría y recuperación de estado, justificando el nivel funcional requerido en segundo curso.

## 4) Cobertura de los 4 puntos de rúbrica
1. Respeto al ejercicio de clase y su temática.
2. Mejora visual clara y contundente.
3. Mejora funcional de gran calado con base de datos.
4. Entrega completa, ejecutable y documentada.

## 5) Ejecución
```bash
pip install -r requirements.txt
python app.py
```
URL: `http://127.0.0.1:5080`

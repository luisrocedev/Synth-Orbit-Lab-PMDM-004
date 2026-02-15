# Synth Orbit Lab · PMDM Actividad 004

Proyecto de síntesis sonora basado en los ejercicios de clase de:
- síntesis musical por osciladores,
- editor de pentagrama/partitura,
- pelotas rebotando que disparan notas.

Se amplía a un prototipo full-stack con Flask + SQLite, secuenciador de 16 pasos y persistencia de composiciones/sesiones/eventos.

## Stack
- Python + Flask
- SQLite
- HTML/CSS/JavaScript
- Web Audio API + Canvas

## Funcionalidades
- Rebotes musicales en 2 órbitas (graves/agudos) con notas sintetizadas.
- Secuenciador visual 16x7 (partitura simplificada) con BPM configurable.
- Selector de tipo de oscilador (`sine`, `triangle`, `sawtooth`, `square`).
- Registro de performer y sesiones de jam.
- Persistencia de composiciones (grid + escena física) y recarga desde BD.
- Telemetría de eventos sonoros (`note`, `spawn_ball`) y métricas globales.
- Ranking por uso musical (sesiones, hits y notas).

## Arranque
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Abrir: `http://127.0.0.1:5080`

## Autor
- Luis Jahir Rodriguez Cedeño
- DNI: 53945291X

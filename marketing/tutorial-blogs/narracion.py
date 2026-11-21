#!/usr/bin/env python3
"""Locución del tutorial con Piper (voz neuronal local, sin coste) a partir de guion.json.

  python3 narracion.py --voces /ruta/a/voces      escribe narracion/<id>.wav, narracion.wav y tiempos.json

Cada segmento se sintetiza aparte (para sincronizar la imagen con la frase exacta), se recortan los silencios
de los bordes y se colocan uno tras otro con una pausa fija entre ellos. tiempos.json guarda inicio y fin de
cada segmento; video.html lo usa para que cada escena empiece cuando empieza su frase.
Las voces se descargan de huggingface.co/rhasspy/piper-voices (es_AR/daniela/high).
"""
import argparse, json, os, subprocess, wave, array

AQUI = os.path.dirname(os.path.abspath(__file__))
SR = 48000
INICIO = 1.2     # silencio antes de la primera frase (entra la música)
COLA = 2.6       # silencio final (cierra la música)

def leer(ruta):
    with wave.open(ruta) as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2
        return w.getframerate(), array.array('h', w.readframes(w.getnframes()))

def recortar(m, umbral=260, margen=0.04, sr=SR):
    i = next((k for k, v in enumerate(m) if abs(v) > umbral), 0)
    j = len(m) - next((k for k, v in enumerate(reversed(m)) if abs(v) > umbral), 0)
    a, b = max(0, i - int(margen * sr)), min(len(m), j + int(margen * sr))
    return m[a:b]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--voces', required=True); ap.add_argument('--velocidad', type=float, default=1.0)
    a = ap.parse_args()
    g = json.load(open(os.path.join(AQUI, 'guion.json'), encoding='utf-8'))
    modelo = os.path.join(a.voces, g['voz'] + '.onnx')
    os.makedirs(os.path.join(AQUI, 'narracion'), exist_ok=True)
    total, tiempos, t = array.array('h', [0] * int(INICIO * SR)), [], INICIO
    for s in g['segmentos']:
        crudo = os.path.join(AQUI, 'narracion', s['id'] + '.crudo.wav'), os.path.join(AQUI, 'narracion', s['id'] + '.wav')
        texto = s['texto'].replace('«', '').replace('»', '')
        subprocess.run(['python3', '-m', 'piper', '-m', modelo, '-f', crudo[0], '--length-scale', str(a.velocidad), '--sentence-silence', '0.28'],
                       input=texto.encode('utf-8'), check=True, stderr=subprocess.DEVNULL)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', crudo[0], '-ar', str(SR), '-ac', '1', crudo[1]], check=True)
        os.remove(crudo[0])
        _, m = leer(crudo[1]); m = recortar(m)
        dur = len(m) / SR
        tiempos.append({'id': s['id'], 'escena': s['escena'], 'texto': s['texto'], 'inicio': round(t, 3), 'fin': round(t + dur, 3)})
        total.extend(m); t += dur
        pausa = g['pausa'] + (0.35 if s is not g['segmentos'][-1] and g['segmentos'][g['segmentos'].index(s) + 1]['escena'] != s['escena'] else 0)   # un respiro más entre escenas
        total.extend([0] * int(pausa * SR)); t += pausa
    total.extend([0] * int(COLA * SR)); t += COLA
    with wave.open(os.path.join(AQUI, 'narracion.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(total.tobytes())
    json.dump({'duracion': round(t, 3), 'segmentos': tiempos}, open(os.path.join(AQUI, 'tiempos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'Narración: {t:.1f} s · {len(tiempos)} segmentos')

if __name__ == '__main__':
    main()

// Сканер QR-кодов камерой (работает и на iPhone — распознавание через jsQR).
// Если камеры нет — код можно вставить вручную.
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { GameButton, Modal } from './kit';
import { sound } from '../audio/sound';

export function QRScanner({ title, hint, onResult, onClose }: { title: string; hint?: string; onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const scan = () => {
      const v = video.current;
      if (!v || done.current) return;
      if (v.readyState >= 2 && v.videoWidth) {
        const w = Math.min(960, v.videoWidth);
        const h = Math.round((v.videoHeight * w) / v.videoWidth);
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(v, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
        if (code && code.data) {
          done.current = true;
          sound.play('pop');
          onResult(code.data);
          return;
        }
      }
      timer = setTimeout(scan, 160);
    };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Камера недоступна в этом браузере. Вставьте код вручную.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const v = video.current;
        if (!v) return;
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true');
        await v.play();
        scan();
      } catch {
        setError('Нет доступа к камере. Разрешите доступ в настройках браузера или вставьте код вручную.');
      }
    })();
    return () => {
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <Modal title={title} onClose={onClose} width="min(26rem, 94vw)">
      <div className="col" style={{ alignItems: 'center' }}>
        {!error ? (
          <div className="scanner">
            <video ref={video} muted playsInline />
            <div className="scanner__frame" />
          </div>
        ) : (
          <div className="hint" style={{ textAlign: 'center' }}>{error}</div>
        )}
        {hint && <div className="hint" style={{ textAlign: 'center' }}>{hint}</div>}
        <textarea className="g-input" rows={2} placeholder="…или вставьте код сюда" value={manual} onChange={(e) => setManual(e.target.value)} style={{ fontSize: '0.8rem', resize: 'none' }} />
        <GameButton color="green" icon="check" block center disabled={!manual.trim()} onClick={() => onResult(manual.trim())}>
          ГОТОВО
        </GameButton>
      </div>
    </Modal>
  );
}

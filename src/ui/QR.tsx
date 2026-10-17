import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { STATIC_SITE, siteBase } from '../net/staticMode';

export function QR({ text, size = 9 }: { text: string; size?: number }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    // Длинные коды (подключение без интернета) — крупнее и с меньшей избыточностью, чтобы читались камерой
    const long = text.length > 200;
    QRCode.toDataURL(text, { margin: 1, width: long ? 640 : 320, errorCorrectionLevel: long ? 'L' : 'M', color: { dark: '#1c0f4f', light: '#ffffff' } })
      .then(setUrl)
      .catch(() => setUrl(''));
  }, [text]);
  return <div className="qr-box" style={{ width: `${size}rem`, height: `${size}rem` }}>{url && <img src={url} alt="QR-код" />}</div>;
}

/** Адрес, который нужно открыть на других устройствах */
export function shareUrl(urls: string[] | undefined, code?: string) {
  if (STATIC_SITE) {
    const base = siteBase();
    return code ? `${base}?room=${code}` : base;
  }
  const isLocal = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  const base = (isLocal ? urls?.[0] : undefined) ?? location.origin;
  return code ? `${base}/?room=${code}` : base;
}

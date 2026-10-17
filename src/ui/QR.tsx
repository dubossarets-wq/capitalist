import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QR({ text, size = 9 }: { text: string; size?: number }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 320, color: { dark: '#1c0f4f', light: '#ffffff' } })
      .then(setUrl)
      .catch(() => setUrl(''));
  }, [text]);
  return <div className="qr-box" style={{ width: `${size}rem`, height: `${size}rem` }}>{url && <img src={url} alt="QR-код" />}</div>;
}

/** Адрес, который нужно открыть на других устройствах */
export function shareUrl(urls: string[] | undefined, code?: string) {
  const isLocal = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  const base = (isLocal ? urls?.[0] : undefined) ?? location.origin;
  return code ? `${base}/?room=${code}` : base;
}

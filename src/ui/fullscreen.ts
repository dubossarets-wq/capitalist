export function toggleFullscreen() {
  const d = document as any;
  const el = document.documentElement as any;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
    } else {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el, { navigationUI: 'hide' });
    }
  } catch {
    /* браузер не поддерживает полноэкранный режим (например, Safari на iPhone) */
  }
}

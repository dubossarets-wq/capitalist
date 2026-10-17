import { createRoot } from 'react-dom/client';
import '@fontsource/rubik/cyrillic-400.css';
import '@fontsource/rubik/cyrillic-700.css';
import '@fontsource/rubik/cyrillic-900.css';
import '@fontsource/rubik/latin-900.css';
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/russo-one/cyrillic-400.css';
import '@fontsource/russo-one/latin-400.css';
import './styles/game.css';
import { App } from './App';

// Запуск с ярлыка на экране «Домой» iPhone/iPad
// Высоту берём по размеру экрана: в этом режиме iOS занижает высоту страницы на строку состояния
if ((navigator as any).standalone) {
  const root = document.documentElement;
  root.classList.add('ios-standalone');
  const fit = () => {
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    root.style.setProperty('--app-h', `${Math.max(full, window.innerHeight)}px`);
  };
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 300));
}

createRoot(document.getElementById('root')!).render(<App />);

// Установка как приложения (работает на localhost и по HTTPS; по IP-адресу браузеры
// обычно разрешают только ярлык «На главный экран»)
if ('serviceWorker' in navigator && window.isSecureContext && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}

// Запрет контекстного меню и масштабирования страницы жестами — управляет игра
document.addEventListener('contextmenu', (e) => {
  if ((e.target as HTMLElement)?.tagName === 'CANVAS') e.preventDefault();
});
document.addEventListener('gesturestart', (e) => e.preventDefault());

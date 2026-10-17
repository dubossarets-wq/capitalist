import { createRoot } from 'react-dom/client';
import '@fontsource/rubik/cyrillic-400.css';
import '@fontsource/rubik/cyrillic-700.css';
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/russo-one/cyrillic-400.css';
import '@fontsource/russo-one/latin-400.css';
import './styles/game.css';
import { App } from './App';

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

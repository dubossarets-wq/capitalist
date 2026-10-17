// Сборка для статического хостинга (GitHub Pages): локального сервера нет,
// поэтому доступна только игра с ботами, а Wi-Fi режим требует запуска сервера на компьютере.
export const STATIC_SITE = import.meta.env.VITE_STATIC === '1';
export const REPO_URL = (import.meta.env.VITE_REPO_URL as string | undefined) || 'https://github.com/dubossarets-wq/capitalist';

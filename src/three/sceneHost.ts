// Единственный экземпляр 3D-сцены на всё приложение
import { BoardScene, type Quality } from './BoardScene';
import { WORLD_BOARD } from '../../shared/boards';
import type { ThemeId } from '../../shared/types';

let scene: BoardScene | null = null;

export function initScene(container: HTMLElement, quality: Quality) {
  if (!scene) scene = new BoardScene(container, quality);
  return scene;
}

export function getScene(): BoardScene | null {
  return scene;
}

let menuKey = '';

/** Декоративная доска для главного меню */
export function showMenuScene(theme: ThemeId) {
  const s = scene;
  if (!s) return;
  const key = `menu|${theme}`;
  if (menuKey !== key) {
    s.setBoard(WORLD_BOARD, theme, 'classic', 200);
    s.setPlayers([
      { id: 'd1', token: 'car', color: '#FF4757' },
      { id: 'd2', token: 'rocket', color: '#1E90FF' },
      { id: 'd3', token: 'crown', color: '#2ED573' },
      { id: 'd4', token: 'duck', color: '#FFA502' },
    ]);
    ['d1', 'd2', 'd3', 'd4'].forEach((id, k) => s.placeToken(id, [0, 10, 20, 30][k], false));
    s.relayout(true);
    menuKey = key;
  }
  // В меню поле всегда объёмное — это витрина игры
  s.setViewMode('3d');
  s.setSafeArea(0, 0);
  s.setMenuMode(true);
}

export function leaveMenuScene() {
  menuKey = '';
  scene?.setMenuMode(false);
}

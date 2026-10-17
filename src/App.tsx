import { useEffect, useRef, useState } from 'react';
import { useStore, store } from './store';
import { initScene, showMenuScene, getScene } from './three/sceneHost';
import { THEMES } from './three/themes';
import { sound } from './audio/sound';
import { MainMenu } from './ui/screens/MainMenu';
import { SetupScreen } from './ui/screens/SetupScreen';
import { JoinScreen } from './ui/screens/JoinScreen';
import { LobbyScreen } from './ui/screens/LobbyScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { RulesScreen } from './ui/screens/RulesScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { RecordsScreen } from './ui/screens/RecordsScreen';
import { BoardEditor } from './ui/screens/BoardEditor';
import { GameScreen } from './ui/game/GameScreen';
import { Toasts } from './ui/game/Overlays';
import { net } from './net/netClient';
import { joinByCode, resumeWifi, joinOffline } from './net/wifi';
import { act } from './game/session';
import { getHost } from './net/p2p';
import { LoungeBand, BAR } from './audio/music';

// Доступ для автотестов интерфейса (только чтение состояния и служебные действия)
(window as any).__cap = { store: useStore, act, net, getHost, joinOffline, LoungeBand, BAR };

export function App() {
  const screen = useStore((s) => s.screen);
  const prefs = useStore((s) => s.prefs);
  const game = useStore((s) => s.game);
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // 3D-сцена создаётся один раз и живёт под всеми экранами
  useEffect(() => {
    if (!host.current) return;
    let cancelled = false;
    const fontsReady = Promise.race([
      Promise.all([document.fonts.load('400 40px "Russo One"'), document.fonts.load('700 40px Rubik'), document.fonts.load('900 40px Rubik'), document.fonts.load('400 40px Rubik')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
    fontsReady.then(() => {
      if (cancelled || !host.current) return;
      try {
        const scene = initScene(host.current, store().prefs.quality);
        // Устройство не справляется — автоматически упрощаем графику
        scene.onSlow = () => {
          const q = store().prefs.quality;
          if (q === 'low') return;
          const next = q === 'high' ? 'medium' : 'low';
          store().setPrefs({ quality: next });
          scene.setQuality(next);
          store().toast(`Графика упрощена до «${next === 'low' ? 'Низкое' : 'Среднее'}» для плавности`, 'info');
        };
      } catch (e) {
        console.error(e);
        store().toast('Не удалось запустить 3D-графику (WebGL). Обновите браузер.', 'error');
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Декоративная доска в меню
  useEffect(() => {
    if (!ready) return;
    if (screen !== 'game') showMenuScene(prefs.menuTheme);
  }, [ready, screen, prefs.menuTheme]);

  // Звук разрешается только после первого действия пользователя
  useEffect(() => {
    const unlock = () => {
      sound.unlock();
      sound.setVolumes(store().prefs.sfx, store().prefs.music);
      sound.setMusicEnabled(true);
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    sound.setVolumes(prefs.sfx, prefs.music);
  }, [prefs.sfx, prefs.music]);

  // Переключение 2D/3D во время партии
  useEffect(() => {
    if (ready && screen === 'game') getScene()?.setViewMode(prefs.view);
  }, [ready, screen, prefs.view]);

  // Облегчённые стили интерфейса на слабых устройствах
  useEffect(() => {
    document.body.classList.toggle('perf-low', prefs.quality === 'low');
  }, [prefs.quality]);

  // Ссылка вида /?room=КОД — сразу входим в комнату
  // Иначе, если раньше были в сетевой партии, — возвращаемся в неё автоматически.
  // Один обработчик на оба случая: два параллельных подключения обрывали бы друг друга.
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('room');
    if (!code) {
      resumeWifi();
      return;
    }
    history.replaceState(null, '', location.pathname);
    store().go('join');
    joinByCode(code).catch((e) => store().toast(e.message, 'error'));
  }, []);

  const themeId = screen === 'game' && game ? game.settings.theme : prefs.menuTheme;
  const theme = THEMES[themeId] ?? THEMES.classic;

  return (
    <div className="app">
      <div className="scene-bg" style={{ background: theme.pageBg }} />
      <div className="scene-host" ref={host} />
      <div className="vignette" />
      {screen !== 'game' && screen !== 'menu' && <div className="dim" />}
      {!ready && (
        <div className="loading-screen">
          <div className="logo__title" style={{ fontSize: '3rem' }}>КАПИТАЛИСТ</div>
          <div className="spinner" />
        </div>
      )}
      <div className="ui-layer">
        {ready && (
          <>
            {screen === 'menu' && <MainMenu />}
            {screen === 'setup' && <SetupScreen />}
            {screen === 'join' && <JoinScreen />}
            {screen === 'lobby' && <LobbyScreen />}
            {screen === 'settings' && <SettingsScreen />}
            {screen === 'rules' && <RulesScreen />}
            {screen === 'profile' && <ProfileScreen />}
            {screen === 'records' && <RecordsScreen />}
            {screen === 'editor' && <BoardEditor />}
            {screen === 'game' && <GameScreen />}
          </>
        )}
        <Toasts />
      </div>
    </div>
  );
}

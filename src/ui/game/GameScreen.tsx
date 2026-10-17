import { useEffect } from 'react';
import { useStore, store } from '../../store';
import { getScene } from '../../three/sceneHost';
import { PlayersPanel, BottomDock, TopRight, TurnTimer, LogPanel } from './HUD';
import { BuyDialog, AuctionDialog, DebtDialog, CellInfo, PropsDialog } from './Dialogs';
import { TradeDialog, IncomingTrade } from './Trade';
import { CardPopup, WheelPopup, OrderPopup, Banner, NetBadge } from './Overlays';
import { GameOver, PauseMenu, LogDialog } from './EndAndPause';

export function GameScreen() {
  const game = useStore((x) => x.game);

  useEffect(() => {
    const scene = getScene();
    if (!scene) return;
    scene.onCellClick = (i) => store().set({ selectedCell: i });
    return () => {
      scene.onCellClick = null;
      scene.setSafeArea(0, 0);
    };
  }, []);

  // Поле вписывается в область между верхними панелями и нижними кнопками
  useEffect(() => {
    if (!game) return;
    const measure = () => {
      const scene = getScene();
      if (!scene) return;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const portrait = vw < vh;
      let top = 0;
      if (portrait) {
        for (const sel of ['.players-panel', '.top-right']) {
          const el = document.querySelector(sel);
          if (el) top = Math.max(top, el.getBoundingClientRect().bottom + 6);
        }
      }
      const dock = document.querySelector('.dock');
      const bottom = dock ? vh - dock.getBoundingClientRect().top + 6 : 0;
      scene.setSafeArea(top, bottom);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    const dock = document.querySelector('.dock');
    if (ro && dock) ro.observe(dock);
    window.addEventListener('resize', measure);
    const t = setInterval(measure, 1500);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      clearInterval(t);
    };
  }, [!!game]);

  if (!game) {
    return (
      <div className="loading-screen" style={{ background: 'transparent' }}>
        <div className="spinner" />
        <div className="title-font">Раскладываем поле…</div>
      </div>
    );
  }

  return (
    <div className="hud">
      <PlayersPanel />
      <TurnTimer />
      <TopRight />
      <LogPanel />
      <BottomDock />
      <Banner />
      <NetBadge />
      <BuyDialog />
      <AuctionDialog />
      <DebtDialog />
      <IncomingTrade />
      <PropsDialog />
      <TradeDialog />
      <CellInfo />
      <OrderPopup />
      <CardPopup />
      <WheelPopup />
      <GameOver />
      <LogDialog />
      <PauseMenu />
    </div>
  );
}

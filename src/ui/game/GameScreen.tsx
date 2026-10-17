import { useEffect } from 'react';
import { useStore, store } from '../../store';
import { getScene } from '../../three/sceneHost';
import { PlayersPanel, ActionBar, SideActions, TopRight, TurnTimer, LogPanel } from './HUD';
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
    };
  }, []);

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
      <ActionBar />
      <SideActions />
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

import { useState } from 'react';
import { netWorth, ownedCells, playerById } from '../../../shared/engine';
import { useStore, store } from '../../store';
import { GameButton, Modal, money } from '../kit';
import { Avatar, TokenImg } from '../Avatar';
import { Icon } from '../Icon';
import { act, exportSave, leaveGame, restartLocal } from '../../game/session';
import { rankPlayers } from '../../game/records';
import { useGame } from './common';
import { SettingsPanel } from '../screens/SettingsScreen';
import { RulesText } from '../screens/RulesScreen';
import { net } from '../../net/netClient';

export function GameOver() {
  const { s, myId, busy } = useGame();
  const mode = useStore((x) => x.mode);
  const room = useStore((x) => x.room);
  const netId = useStore((x) => x.net.clientId);
  if (s.phase !== 'gameOver' || busy) return null;
  const winner = playerById(s, s.winner);
  const ranking = rankPlayers(s);
  const iWon = winner?.id === myId;
  const isHost = mode === 'net' && room?.hostId === netId;
  const mins = Math.max(1, Math.round((Date.now() - s.startedAt) / 60000));
  return (
    <Modal title={iWon ? 'ПОБЕДА!' : 'ИГРА ОКОНЧЕНА'} width="min(46rem, 96vw)">
      {winner && (
        <div className="col" style={{ alignItems: 'center', marginBottom: '0.8rem' }}>
          <div className="winner-avatar" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-2.2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
              <Icon name="crown" size="3.2rem" />
            </div>
            <Avatar id={winner.avatar} color={winner.color} size={6} bot={winner.isBot} />
          </div>
          <div className="row">
            <TokenImg token={winner.token} color={winner.color} size={3} />
            <div className="title-font" style={{ fontSize: '1.8rem' }}>{iWon ? 'Вы победили!' : `${winner.name} побеждает!`}</div>
          </div>
          <div className="hint">
            {s.turn} ходов · {s.round} кругов · {mins} мин
          </div>
        </div>
      )}
      <table className="stats-table">
        <thead>
          <tr>
            <th>Место</th>
            <th>Капитал</th>
            <th>Участков</th>
            <th>Аренда +</th>
            <th>Аренда −</th>
            <th>Сделок</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((p, k) => (
            <tr key={p.id}>
              <td>
                <span className="row" style={{ gap: '0.4rem' }}>
                  <span className="gold-text">{k + 1}</span>
                  <Avatar id={p.avatar} color={p.color} size={1.6} bot={p.isBot} />
                  {p.name}
                  {p.bankrupt && <span className="tag red">банкрот</span>}
                </span>
              </td>
              <td>{money(p.bankrupt ? p.stats.maxNetWorth : netWorth(s, p.id))}</td>
              <td>{p.bankrupt ? p.stats.propertiesBought : ownedCells(s, p.id).length}</td>
              <td>{money(p.stats.rentReceived)}</td>
              <td>{money(p.stats.rentPaid)}</td>
              <td>{p.stats.tradesDone}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row wrap center-x" style={{ marginTop: '1rem' }}>
        <GameButton color="purple" icon="back" onClick={leaveGame}>
          В МЕНЮ
        </GameButton>
        {mode === 'local' && (
          <GameButton color="green" size="lg" icon="refresh" pulse onClick={restartLocal}>
            РЕВАНШ
          </GameButton>
        )}
        {isHost && (
          <GameButton color="green" size="lg" icon="refresh" pulse onClick={() => net.send({ t: 'backToLobby' })}>
            В ЛОББИ
          </GameButton>
        )}
        <GameButton color="dark" icon="scroll" onClick={() => store().set({ dialog: 'log' })}>
          ИСТОРИЯ
        </GameButton>
      </div>
    </Modal>
  );
}

export function LogDialog() {
  const { s } = useGame();
  const dialog = useStore((x) => x.dialog);
  if (dialog !== 'log') return null;
  return (
    <Modal title="История ходов" onClose={() => store().set({ dialog: null })} width="min(40rem, 96vw)">
      {[...s.log].reverse().map((e, k) => {
        const p = playerById(s, e.player);
        return (
          <div key={k} className="log-entry">
            <span className="muted small">ход {e.turn} · </span>
            {p && <i style={{ display: 'inline-block', width: '0.55rem', height: '0.55rem', borderRadius: '50%', background: p.color, marginRight: '0.35rem' }} />}
            {e.text}
          </div>
        );
      })}
    </Modal>
  );
}

export function PauseMenu() {
  const { s, me } = useGame();
  const dialog = useStore((x) => x.dialog);
  const mode = useStore((x) => x.mode);
  const room = useStore((x) => x.room);
  const netId = useStore((x) => x.net.clientId);
  const [page, setPage] = useState<'main' | 'settings' | 'rules' | 'surrender'>('main');
  if (dialog !== 'pause') return null;
  const close = () => {
    setPage('main');
    store().set({ dialog: null });
  };
  const isHost = mode === 'net' && room?.hostId === netId;
  const offline = s.players.filter((p) => !p.isBot && !p.connected && !p.bankrupt);

  const download = () => {
    const data = exportSave();
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kapitalist-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    store().toast('Файл сохранения скачан', 'success');
  };

  return (
    <Modal title={page === 'settings' ? 'Настройки' : page === 'rules' ? 'Правила' : 'Пауза'} onClose={close} width={page === 'main' ? 'min(24rem, 94vw)' : 'min(44rem, 96vw)'}>
      {page === 'main' && (
        <div className="col">
          <GameButton color="green" size="lg" icon="play" block onClick={close}>
            ПРОДОЛЖИТЬ
          </GameButton>
          <GameButton color="blue" icon="gear" block onClick={() => setPage('settings')}>
            НАСТРОЙКИ
          </GameButton>
          <GameButton color="gold" icon="book" block onClick={() => setPage('rules')}>
            ПРАВИЛА
          </GameButton>
          <GameButton color="dark" icon="scroll" block onClick={() => store().set({ dialog: 'log' })}>
            ИСТОРИЯ ХОДОВ
          </GameButton>
          {mode === 'local' && (
            <GameButton color="teal" icon="download" block onClick={download} sub="партия также сохраняется автоматически">
              СОХРАНИТЬ В ФАЙЛ
            </GameButton>
          )}
          {isHost &&
            offline.map((p) => (
              <GameButton key={p.id} color="orange" icon="robot" block onClick={() => net.send({ t: 'replaceWithBot', seatId: p.id })} sub="игрок не на связи">
                {p.name}: ЗАМЕНИТЬ БОТОМ
              </GameButton>
            ))}
          {me && !me.bankrupt && s.phase !== 'gameOver' && (
            <GameButton color="red" icon="bomb" block onClick={() => setPage('surrender')}>
              СДАТЬСЯ
            </GameButton>
          )}
          <GameButton color="purple" icon="exit" block onClick={leaveGame} sub={mode === 'local' ? 'партия сохранится' : 'за вас будет ходить автопилот'}>
            ВЫЙТИ В МЕНЮ
          </GameButton>
        </div>
      )}
      {page === 'settings' && (
        <>
          <SettingsPanel />
          <div className="row center-x" style={{ marginTop: '0.8rem' }}>
            <GameButton color="purple" icon="back" onClick={() => setPage('main')}>
              НАЗАД
            </GameButton>
          </div>
        </>
      )}
      {page === 'rules' && (
        <>
          <RulesText />
          <div className="row center-x" style={{ marginTop: '0.8rem' }}>
            <GameButton color="purple" icon="back" onClick={() => setPage('main')}>
              НАЗАД
            </GameButton>
          </div>
        </>
      )}
      {page === 'surrender' && (
        <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Icon name="bomb" size="4rem" />
          <div className="title-font" style={{ fontSize: '1.2rem' }}>Объявить себя банкротом?</div>
          <div className="hint">Всё имущество вернётся банку, вы выбываете из партии.</div>
          <div className="row">
            <GameButton
              color="red"
              onClick={() => {
                act({ type: 'bankrupt' });
                close();
              }}
            >
              ДА, СДАЮСЬ
            </GameButton>
            <GameButton color="gray" onClick={() => setPage('main')}>
              НЕТ
            </GameButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

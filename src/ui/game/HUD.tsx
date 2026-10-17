import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../../shared/types';
import {
  canBuild,
  canManage,
  canMortgage,
  canSellBuilding,
  canSellProperty,
  canUnmortgage,
  cellAt,
  jailFine,
  netWorth,
  ownedCells,
  playerById,
} from '../../../shared/engine';
import { useStore, store } from '../../store';
import { GameButton, money } from '../kit';
import { Avatar } from '../Avatar';
import { Icon } from '../Icon';
import { act } from '../../game/session';
import { groupColor, useGame, useServerNow } from './common';
import { getScene } from '../../three/sceneHost';
import { net } from '../../net/netClient';

function CashValue({ value }: { value: number }) {
  const prev = useRef(value);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prev.current === value) return;
    el.classList.remove('up', 'down');
    void el.offsetWidth;
    el.classList.add(value > prev.current ? 'up' : 'down');
    prev.current = value;
  }, [value]);
  return (
    <div ref={ref} className="player-card__cash">
      {money(value)}
    </div>
  );
}

export function PlayersPanel() {
  const { s, myId } = useGame();
  const cash = useStore((x) => x.cashView);
  const emotes = useStore((x) => x.emotes);
  const now = useServerNow(s.settings.turnTimer ? 500 : 60000);
  const ref = useRef<HTMLDivElement>(null);
  // Высота списка игроков — под ним выстраиваются кнопки и уведомления на телефоне
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--players-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="players-panel" style={{ ['--cols' as any]: s.players.length <= 3 ? s.players.length : s.players.length === 4 ? 2 : 3 }}>
      {s.players.map((p, idx) => {
        const active = idx === s.current && s.phase !== 'gameOver';
        const cells = ownedCells(s, p.id);
        const timer = active && s.deadline && s.settings.turnTimer ? Math.max(0, Math.ceil((s.deadline - now) / 1000)) : null;
        return (
          <button
            key={p.id}
            className={`player-card ${active ? 'active' : ''} ${p.bankrupt ? 'bankrupt' : ''} ${p.id === myId ? 'me' : ''}`}
            style={{ ['--c' as any]: p.color }}
            onClick={() => store().set({ dialog: 'props', propsOwner: p.id, propsMode: 'all' })}
            title={`Капитал: ${money(netWorth(s, p.id))}`}
          >
            <Avatar id={p.avatar} color={p.color} size={2.4} bot={p.isBot} />
            <div className="grow">
              <div className="player-card__name">{p.name}</div>
              <CashValue value={p.bankrupt ? 0 : cash[p.id] ?? p.cash} />
              {cells.length > 0 && (
                <div className="player-card__props">
                  {cells.map((i) => (
                    <i key={i} style={{ background: groupColor(s, i), opacity: s.props[i].mortgaged ? 0.35 : 1 }} />
                  ))}
                </div>
              )}
            </div>
            <div className="player-card__icons">
              {p.bankrupt && <Icon name="bomb" />}
              {p.inJail && <Icon name="jail" />}
              {p.jailFreeCards > 0 && <Icon name="key" />}
              {!p.connected && !p.isBot && <Icon name="wifi" className="offline" />}
              {p.autopilot && <Icon name="robot" />}
            </div>
            {timer != null && (
              <span className="tag red timer-ring" style={{ fontSize: '0.75rem' }}>
                {timer}с
              </span>
            )}
            {emotes
              .filter((e) => e.from === p.id)
              .map((e) => (
                <span key={e.id} className="emote-float" style={{ right: '0.5rem', top: '-0.5rem' }}>
                  {e.emote}
                </span>
              ))}
          </button>
        );
      })}
    </div>
  );
}

export function TurnTimer() {
  const { s, isMyTurn } = useGame();
  const now = useServerNow(s.settings.turnTimer ? 250 : 60000);
  if (!s.settings.turnTimer || !s.deadline || s.phase === 'gameOver' || s.phase === 'auction') return null;
  const left = Math.max(0, (s.deadline - now) / 1000);
  if (!isMyTurn) return null;
  return (
    <div className={`turn-timer ${left < 10 ? 'urgent' : ''}`}>
      <Icon name="timer" size="1.6rem" />
      {Math.ceil(left)} с
    </div>
  );
}

function hasAny(s: GameState, pid: string, fn: (s: GameState, pid: string, i: number) => string | null) {
  return ownedCells(s, pid).some((i) => !fn(s, pid, i));
}

/**
 * Нижняя панель: все кнопки в одном потоке, поэтому они никогда не перекрывают друг друга.
 * Верхний ряд — второстепенные действия, нижний — главное действие хода или статус.
 */
export function BottomDock() {
  const { s, me, cur, busy, isMyTurn } = useGame();
  const dialog = useStore((x) => x.dialog);
  const ref = useRef<HTMLDivElement>(null);

  // Сообщаем высоту панели — по ней ограничивается список игроков
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--dock-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (s.phase === 'gameOver') return null;
  const alive = !!me && !me.bankrupt;
  const myMove = alive && isMyTurn && !busy && s.phase !== 'auction' && !(s.phase === 'debt' && s.debt?.player !== me!.id);
  const manage = myMove && canManage(s, me!.id) && (s.phase === 'roll' || s.phase === 'action');
  const canB = manage && hasAny(s, me!.id, canBuild);
  const canS = manage && (hasAny(s, me!.id, canSellBuilding) || hasAny(s, me!.id, canSellProperty));
  const canM = manage && hasAny(s, me!.id, canMortgage);
  const canU = manage && hasAny(s, me!.id, canUnmortgage);
  const open = (mode: 'build' | 'sell' | 'mortgage' | 'unmortgage') => store().set({ dialog: 'props', propsMode: mode, propsOwner: me!.id });
  const outgoing = alive ? s.trades.filter((t) => t.status === 'pending' && t.from === me!.id).length : 0;

  let primary: JSX.Element | null = null;
  if (!alive) {
    primary = (
      <div className="status-pill">
        <Icon name="eye" size="1.8rem" /> {me?.bankrupt ? 'Вы банкрот — наблюдаете за игрой' : 'Наблюдение'}
      </div>
    );
  } else if (!myMove) {
    const who = s.phase === 'debt' ? playerById(s, s.debt?.player) : cur;
    const text = s.phase === 'auction' ? 'Идёт аукцион' : s.phase === 'debt' ? `${who?.name} ищет деньги` : isMyTurn ? 'Ваш ход' : `Ходит ${who?.name}`;
    primary = who ? (
      <div className="status-pill" style={{ boxShadow: `0 0 0 0.16rem ${who.color}, 0 0.4rem 1rem rgba(0,0,0,.35)` }}>
        <Avatar id={who.avatar} color={who.color} size={2} bot={who.isBot} />
        <span className="dots">{text}</span>
      </div>
    ) : null;
  } else if (s.phase === 'roll') {
    primary = (
      <>
        {me!.inJail && (
          <GameButton color="orange" icon="cash" disabled={me!.cash < jailFine(s)} onClick={() => act({ type: 'payJail' })} sub="и бросить кубики">
            ВЫЙТИ ЗА {money(jailFine(s))}
          </GameButton>
        )}
        {me!.inJail && me!.jailFreeCards > 0 && (
          <GameButton color="teal" icon="key" onClick={() => act({ type: 'useJailCard' })} sub={`есть ${me!.jailFreeCards}`}>
            КАРТА
          </GameButton>
        )}
        <GameButton color="green" size="xl" icon="dice" pulse onClick={() => act({ type: 'roll' })} sub={me!.inJail ? `дубль — свобода (${me!.jailTurns + 1} из 3)` : s.rolledThisTurn ? 'дубль — ещё бросок!' : undefined}>
          БРОСИТЬ КУБИКИ
        </GameButton>
      </>
    );
  } else if (s.phase === 'action') {
    primary = (
      <GameButton color="red" size="xl" icon="flag" pulse onClick={() => act({ type: 'endTurn' })}>
        ЗАВЕРШИТЬ ХОД
      </GameButton>
    );
  }

  const hidden = !!dialog;
  return (
    <div className="dock" ref={ref} style={{ visibility: hidden ? 'hidden' : undefined }}>
      {alive && (
        <div className="dock__row dock__secondary">
          {s.settings.rules.trading && (
            <GameButton size="sm" color="orange" icon="handshake" badge={outgoing || undefined} onClick={() => store().set({ dialog: 'trade', tradeDraft: null })}>
              ТОРГОВЛЯ
            </GameButton>
          )}
          <GameButton size="sm" color="purple" icon="briefcase" badge={ownedCells(s, me!.id).length || undefined} onClick={() => store().set({ dialog: 'props', propsMode: 'all', propsOwner: me!.id })}>
            ИМУЩЕСТВО
          </GameButton>
          {canB && (
            <GameButton size="sm" color="blue" icon="hammer" onClick={() => open('build')}>
              ПОСТРОИТЬ
            </GameButton>
          )}
          {canS && (
            <GameButton size="sm" color="pink" icon="sell" onClick={() => open('sell')}>
              ПРОДАТЬ
            </GameButton>
          )}
          {canM && (
            <GameButton size="sm" color="dark" icon="lock" onClick={() => open('mortgage')}>
              ЗАЛОЖИТЬ
            </GameButton>
          )}
          {canU && (
            <GameButton size="sm" color="teal" icon="unlock" onClick={() => open('unmortgage')}>
              ВЫКУПИТЬ
            </GameButton>
          )}
        </div>
      )}
      {primary && <div className="dock__row dock__primary">{primary}</div>}
    </div>
  );
}

const EMOTES = ['👍', '😂', '😮', '😡', '🎉', '💸'];

export function TopRight() {
  const mode = useStore((x) => x.mode);
  const prefs = useStore((x) => x.prefs);
  const [emotes, setEmotes] = useState(false);
  return (
    <div className="top-right">
      {mode === 'net' && (
        <div className="emote-wrap">
          <GameButton round color="pink" icon="chat" title="Эмоции" onClick={() => setEmotes(!emotes)} />
          {emotes && (
            <div className="emote-pop">
              {EMOTES.map((e) => (
                <button
                  key={e}
                  className="emote-btn"
                  onClick={() => {
                    net.send({ t: 'emote', emote: e });
                    setEmotes(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <GameButton round color="teal" icon={prefs.view === '2d' ? 'cube' : 'map'} title={prefs.view === '2d' ? 'Объёмный вид (3D)' : 'Вид сверху (2D)'} onClick={() => store().setPrefs({ view: prefs.view === '2d' ? '3d' : '2d' })} />
      <GameButton round color="dark" icon="scroll" title="Журнал ходов" onClick={() => store().setPrefs({ showLog: !prefs.showLog })} />
      <GameButton round color="dark" icon="eye" title="Обзор поля" onClick={() => getScene()?.overview()} />
      <GameButton round color="purple" icon="menu" title="Меню" onClick={() => store().set({ dialog: 'pause' })} />
    </div>
  );
}

export function LogPanel() {
  const { s } = useGame();
  const show = useStore((x) => x.prefs.showLog);
  const ref = useRef<HTMLDivElement>(null);
  const entries = s.log.slice(-60);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries.length, show]);
  if (!show) return null;
  return (
    <div className="log-panel" ref={ref}>
      {entries.map((e, k) => {
        const p = playerById(s, e.player);
        return (
          <div key={k} className="log-entry" style={{ color: e.kind === 'bankrupt' ? '#ff8a8a' : e.kind === 'win' ? '#ffe259' : undefined }}>
            {p && <i style={{ display: 'inline-block', width: '0.55rem', height: '0.55rem', borderRadius: '50%', background: p.color, marginRight: '0.35rem' }} />}
            {e.text}
          </div>
        );
      })}
    </div>
  );
}

export function cellName(s: GameState, i: number) {
  return cellAt(s, i).name;
}

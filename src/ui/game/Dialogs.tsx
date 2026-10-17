import { useState } from 'react';
import type { GameState } from '../../../shared/types';
import {
  canBuild,
  canManage,
  canMortgage,
  canSellBuilding,
  canSellProperty,
  canUnmortgage,
  cellAt,
  houseCostOf,
  liquidationValue,
  mortgageValue,
  ownedCells,
  playerById,
  priceOf,
  sellValue,
  unmortgageCost,
} from '../../../shared/engine';
import { isOwnable } from '../../../shared/boards';
import { useStore, store, type PropsMode } from '../../store';
import { GameButton, Modal, Tabs, money } from '../kit';
import { Avatar } from '../Avatar';
import { Icon } from '../Icon';
import { act } from '../../game/session';
import { PropCard, groupColor, useGame, useServerNow } from './common';

// ───────────── Покупка ─────────────

export function BuyDialog() {
  const { s, me, isMyTurn, busy } = useGame();
  if (!me || !isMyTurn || busy || s.phase !== 'buy') return null;
  const i = me.position;
  const price = priceOf(s, i);
  const short = price - me.cash;
  return (
    <Modal title="Свободный участок" clear width="auto">
      <div className="col" style={{ alignItems: 'center' }}>
        <PropCard s={s} i={i} />
        <div className="actions-grid" style={{ marginTop: '0.4rem', maxWidth: '22rem' }}>
          <GameButton color="green" size="lg" icon="cart" pulse={short <= 0} disabled={short > 0} onClick={() => act({ type: 'buy' })} sub={short > 0 ? `не хватает ${money(short)}` : `останется ${money(me.cash - price)}`}>
            КУПИТЬ {money(price)}
          </GameButton>
          {s.settings.rules.auctions ? (
            <GameButton color="orange" size="lg" icon="gavel" onClick={() => act({ type: 'decline' })} sub="торги для всех">
              АУКЦИОН
            </GameButton>
          ) : (
            <GameButton color="gray" size="lg" icon="close" onClick={() => act({ type: 'decline' })}>
              ОТКАЗАТЬСЯ
            </GameButton>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ───────────── Аукцион ─────────────

export function AuctionDialog() {
  const { s, me, busy } = useGame();
  const now = useServerNow(s.phase === 'auction' ? 200 : 60000);
  const au = s.auction;
  if (s.phase !== 'auction' || !au || busy) return null;
  const total = 12000 * (s.settings.quickGame ? 0.6 : 1);
  const left = Math.max(0, au.endsAt - now);
  const leader = playerById(s, au.highBidder);
  const inAuction = !!me && au.participants.includes(me.id);
  const bid = (inc: number) => act({ type: 'bid', amount: au.highBid + inc });
  return (
    <Modal title="Аукцион" clear width="min(30rem, 94vw)">
      <div className="col" style={{ alignItems: 'center' }}>
        <PropCard s={s} i={au.cell} compact />
        <div className="muted small">Текущая ставка</div>
        <div className="auction-price">{money(au.highBid)}</div>
        <div className="bidder">
          {leader ? (
            <>
              <Avatar id={leader.avatar} color={leader.color} size={1.8} bot={leader.isBot} /> {leader.name} лидирует
            </>
          ) : (
            'Ставок пока нет'
          )}
        </div>
        <div className="progress" style={{ width: '100%' }}>
          <div style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
        </div>
        <div className="row wrap center-x" style={{ gap: '0.35rem' }}>
          {s.players
            .filter((p) => !p.bankrupt)
            .map((p) => (
              <span key={p.id} style={{ opacity: au.participants.includes(p.id) ? 1 : 0.3 }} title={au.participants.includes(p.id) ? 'Участвует' : 'Вышел'}>
                <Avatar id={p.avatar} color={p.color} size={1.9} bot={p.isBot} />
              </span>
            ))}
        </div>
        {inAuction && me ? (
          <>
            <div className="actions-grid three">
              {[10, 50, 100].map((inc) => (
                <GameButton key={inc} color="green" disabled={au.highBid + inc > me.cash || au.highBidder === me.id} onClick={() => bid(inc)}>
                  +{money(inc)}
                </GameButton>
              ))}
            </div>
            <div className="actions-grid">
              <GameButton span color="red" icon="close" disabled={au.highBidder === me.id} onClick={() => act({ type: 'pass' })}>
                ПАС
              </GameButton>
            </div>
            <div className="hint">Ваши деньги: {money(me.cash)}</div>
          </>
        ) : (
          <div className="hint">{me ? 'Вы вышли из аукциона' : ''}</div>
        )}
      </div>
    </Modal>
  );
}

// ───────────── Долг ─────────────

export function DebtDialog() {
  const { s, me, busy } = useGame();
  const dialog = useStore((x) => x.dialog);
  const [confirm, setConfirm] = useState(false);
  const d = s.debt;
  if (!me || busy || s.phase !== 'debt' || !d || d.player !== me.id || dialog) return null;
  const creditor = playerById(s, d.creditor);
  const liq = liquidationValue(s, me.id);
  return (
    <Modal title="Нужно заплатить" clear width="min(28rem, 94vw)">
      <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
        <Icon name="bomb" size="4rem" />
        <div className="auction-price" style={{ color: '#ff8a8a' }}>{money(d.amount)}</div>
        <div>
          {d.reason}
          {creditor ? ` → ${creditor.name}` : ''}
        </div>
        <div className="hint">
          У вас наличными {money(me.cash)}. Продав и заложив всё, можно собрать до {money(liq)}.
        </div>
        <div className="actions-grid">
          <GameButton color="green" icon="cash" disabled={me.cash < d.amount} onClick={() => act({ type: 'payDebt' })}>
            ЗАПЛАТИТЬ
          </GameButton>
          <GameButton color="purple" icon="briefcase" onClick={() => store().set({ dialog: 'props', propsMode: 'mortgage', propsOwner: me.id })}>
            ДОБЫТЬ ДЕНЬГИ
          </GameButton>
          {!confirm ? (
            <GameButton span color="red" size="sm" icon="bomb" onClick={() => setConfirm(true)}>
              ОБЪЯВИТЬ БАНКРОТСТВО
            </GameButton>
          ) : (
            <>
              <div className="small span-text">Точно? Вы выбываете из игры.</div>
              <GameButton color="red" size="sm" onClick={() => act({ type: 'bankrupt' })}>
                ДА, БАНКРОТ
              </GameButton>
              <GameButton color="gray" size="sm" onClick={() => setConfirm(false)}>
                НЕТ
              </GameButton>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ───────────── Информация о клетке ─────────────

export function CellInfo() {
  const { s, me } = useGame();
  const i = useStore((x) => x.selectedCell);
  if (i == null || !s.board.cells[i]) return null;
  const c = cellAt(s, i);
  const ps = s.props[i];
  const close = () => store().set({ selectedCell: null });
  const mine = me && ps?.owner === me.id;
  const manage = me && canManage(s, me.id);
  const others = s.players.filter((p) => !p.bankrupt && p.id !== me?.id);
  const tokensHere = s.players.filter((p) => !p.bankrupt && p.position === i);
  return (
    <Modal onClose={close} width="auto">
      <div className="col" style={{ alignItems: 'center' }}>
        <PropCard s={s} i={i} />
        {tokensHere.length > 0 && (
          <div className="row center-x wrap small">
            Здесь:{' '}
            {tokensHere.map((p) => (
              <span key={p.id} className="row" style={{ gap: '0.25rem' }}>
                <Avatar id={p.avatar} color={p.color} size={1.4} bot={p.isBot} /> {p.name}
              </span>
            ))}
          </div>
        )}
        {mine && manage && isOwnable(c) && <CellActions s={s} i={i} pid={me!.id} />}
        {me && !me.bankrupt && ps?.owner && ps.owner !== me.id && s.settings.rules.trading && (
          <GameButton
            color="orange"
            icon="handshake"
            onClick={() => store().set({ selectedCell: null, dialog: 'trade', tradeDraft: { to: ps.owner!, giveMoney: Math.min(me.cash, priceOf(s, i)), giveCells: [], getMoney: 0, getCells: [i] } })}
          >
            ПРЕДЛОЖИТЬ СДЕЛКУ
          </GameButton>
        )}
        {me && !ps?.owner && isOwnable(c) && others.length > 0 && <div className="hint">Участок свободен — его можно купить, остановившись на нём.</div>}
      </div>
    </Modal>
  );
}

function CellActions({ s, i, pid }: { s: GameState; i: number; pid: string }) {
  const btns: JSX.Element[] = [];
  const inDebt = s.phase === 'debt';
  if (!inDebt && !canBuild(s, pid, i))
    btns.push(
      <GameButton key="b" size="sm" color="blue" icon="house" onClick={() => act({ type: 'build', cell: i })} sub={money(houseCostOf(s, i))}>
        {s.props[i].houses === 4 ? 'ОТЕЛЬ' : 'ДОМ'}
      </GameButton>,
    );
  if (!canSellBuilding(s, pid, i))
    btns.push(
      <GameButton key="sb" size="sm" color="pink" icon="sell" onClick={() => act({ type: 'sellBuilding', cell: i })} sub={`+${money(Math.floor(houseCostOf(s, i) / 2))}`}>
        ПРОДАТЬ ДОМ
      </GameButton>,
    );
  if (!canMortgage(s, pid, i))
    btns.push(
      <GameButton key="m" size="sm" color="purple" icon="lock" onClick={() => act({ type: 'mortgage', cell: i })} sub={`+${money(mortgageValue(s, i))}`}>
        ЗАЛОЖИТЬ
      </GameButton>,
    );
  if (!inDebt && !canUnmortgage(s, pid, i))
    btns.push(
      <GameButton key="u" size="sm" color="teal" icon="unlock" onClick={() => act({ type: 'unmortgage', cell: i })} sub={`−${money(unmortgageCost(s, i))}`}>
        ВЫКУПИТЬ
      </GameButton>,
    );
  if (!canSellProperty(s, pid, i))
    btns.push(
      <GameButton key="sp" size="sm" color="red" icon="bank" onClick={() => act({ type: 'sellProperty', cell: i })} sub={`+${money(sellValue(s, i))}`}>
        БАНКУ
      </GameButton>,
    );
  if (!btns.length) return null;
  return <div className="actions-grid odd-full">{btns}</div>;
}

// ───────────── Моя недвижимость ─────────────

export function PropsDialog() {
  const { s, myId } = useGame();
  const dialog = useStore((x) => x.dialog);
  const mode = useStore((x) => x.propsMode);
  const ownerId = useStore((x) => x.propsOwner) ?? myId;
  if (dialog !== 'props') return null;
  const owner = playerById(s, ownerId);
  if (!owner) return null;
  const mine = owner.id === myId;
  const manage = mine && canManage(s, owner.id);
  const cells = ownedCells(s, owner.id);
  const close = () => store().set({ dialog: null });
  const filter = (i: number) => {
    if (!manage) return true;
    switch (mode) {
      case 'build':
        return !canBuild(s, owner.id, i);
      case 'sell':
        return !canSellBuilding(s, owner.id, i) || !canSellProperty(s, owner.id, i);
      case 'mortgage':
        return !canMortgage(s, owner.id, i) || !canSellBuilding(s, owner.id, i);
      case 'unmortgage':
        return s.props[i].mortgaged;
      default:
        return true;
    }
  };
  const shown = cells.filter(filter);
  // Группировка по цвету
  const groups = new Map<string, number[]>();
  for (const i of shown) {
    const c = cellAt(s, i);
    const key = c.type === 'property' ? `g${c.group}` : c.type;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  }
  const title = mine ? 'Моя недвижимость' : `Имущество: ${owner.name}`;
  return (
    <Modal title={title} onClose={close} width="min(52rem, 96vw)">
      <div className="row between wrap" style={{ marginBottom: '0.6rem' }}>
        <div className="row">
          <Avatar id={owner.avatar} color={owner.color} size={2.4} bot={owner.isBot} />
          <div>
            <div className="title-font">{owner.name}</div>
            <div className="money">{money(owner.cash)}</div>
          </div>
        </div>
        {owner.jailFreeCards > 0 && (
          <span className="tag gold">
            <Icon name="key" /> Освобождение из тюрьмы ×{owner.jailFreeCards}
          </span>
        )}
        {s.phase === 'debt' && s.debt?.player === owner.id && mine && (
          <GameButton color="green" size="sm" icon="cash" disabled={owner.cash < s.debt.amount} onClick={() => (act({ type: 'payDebt' }), close())}>
            ОПЛАТИТЬ ДОЛГ {money(s.debt.amount)}
          </GameButton>
        )}
      </div>
      {manage && (
        <Tabs<PropsMode>
          value={mode}
          onChange={(m) => store().set({ propsMode: m })}
          tabs={[
            { id: 'all', label: 'Всё', icon: 'briefcase' },
            { id: 'build', label: 'Строить', icon: 'hammer' },
            { id: 'sell', label: 'Продать', icon: 'sell' },
            { id: 'mortgage', label: 'Заложить', icon: 'lock' },
            { id: 'unmortgage', label: 'Выкупить', icon: 'unlock' },
          ]}
        />
      )}
      {mine && !manage && cells.length > 0 && <div className="hint" style={{ marginBottom: '0.5rem' }}>Строить, закладывать и продавать можно только в свой ход.</div>}
      {shown.length === 0 && (
        <div className="inner" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <Icon name="house" size="3rem" />
          <div className="title-font" style={{ marginTop: '0.4rem' }}>{cells.length === 0 ? 'Пока нет недвижимости' : 'Нет подходящих участков'}</div>
          {mode === 'build' && cells.length > 0 && <div className="hint">Чтобы строить, соберите всю цветовую группу без заложенных участков.</div>}
        </div>
      )}
      <div className="col">
        {[...groups.entries()].map(([key, list]) => {
          const c0 = cellAt(s, list[0]);
          const gname = c0.type === 'property' ? s.board.groups[c0.group!]?.name : c0.type === 'transport' ? 'Транспорт' : 'Предприятия';
          return (
            <div key={key}>
              <div className="label row" style={{ gap: '0.4rem' }}>
                <i style={{ width: '0.9rem', height: '0.9rem', borderRadius: '0.25rem', background: groupColor(s, list[0]), display: 'inline-block' }} />
                {gname}
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))' }}>
                {list.map((i) => (
                  <PropRow key={i} s={s} i={i} pid={owner.id} manage={!!manage} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function PropRow({ s, i, pid, manage }: { s: GameState; i: number; pid: string; manage: boolean }) {
  const c = cellAt(s, i);
  const ps = s.props[i];
  return (
    <div className="inner" style={{ padding: '0.55rem', boxShadow: `inset 0.35rem 0 0 ${groupColor(s, i)}` }}>
      <div className="row between">
        <button className="title-font prop-name-btn" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '0.95rem', padding: '0.2rem 0' }} onClick={() => store().set({ selectedCell: i })}>
          {c.name}
        </button>
        <div className="row" style={{ gap: '0.15rem' }}>
          {ps.houses === 5 ? <Icon name="hotel" size="1.4rem" /> : Array.from({ length: ps.houses }).map((_, k) => <Icon key={k} name="house" size="1.2rem" />)}
          {ps.mortgaged && <span className="tag red">ЗАЛОГ</span>}
        </div>
      </div>
      {manage && (
        <div style={{ marginTop: '0.4rem' }}>
          <CellActions s={s} i={i} pid={pid} />
        </div>
      )}
    </div>
  );
}

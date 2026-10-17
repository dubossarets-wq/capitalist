// Общие помощники игрового интерфейса
import { useEffect, useState } from 'react';
import type { GameState, PlayerState } from '../../../shared/types';
import {
  cellAt,
  countOwnedOfType,
  currentPlayer,
  houseCostOf,
  mortgageValue,
  ownsGroup,
  playerById,
  priceOf,
  rentOf,
  taxOf,
  unmortgageCost,
} from '../../../shared/engine';
import { useStore } from '../../store';
import { Icon } from '../Icon';
import { Avatar } from '../Avatar';
import { money } from '../kit';

export function useGame() {
  const s = useStore((x) => x.game)!;
  const myId = useStore((x) => x.myId);
  const busy = useStore((x) => x.animating);
  const me = s ? playerById(s, myId) : undefined;
  const cur = s ? currentPlayer(s) : undefined;
  return { s, myId, me, cur, busy, isMyTurn: !!me && cur?.id === me.id };
}

/** Текущее время сервера (для таймеров аукциона и хода) */
export function useServerNow(interval = 200) {
  const offset = useStore((x) => x.timeOffset);
  const [now, setNow] = useState(Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const t = setInterval(() => setNow(Date.now() + offset), interval);
    return () => clearInterval(t);
  }, [offset, interval]);
  return now;
}

export function groupColor(s: GameState, i: number) {
  const c = cellAt(s, i);
  if (c.type === 'property') return s.board.groups[c.group!]?.color ?? '#888';
  if (c.type === 'transport') return '#546e7a';
  if (c.type === 'utility') return '#8e7cc3';
  return '#999';
}

export function cellIcon(s: GameState, i: number) {
  const c = cellAt(s, i);
  switch (c.type) {
    case 'transport':
    case 'utility':
      return c.icon ?? (c.type === 'transport' ? 'plane' : 'bolt');
    case 'tax':
      return 'tax';
    case 'chance':
      return 'question';
    case 'chest':
      return 'chest';
    case 'wheel':
      return 'wheel';
    case 'jail':
      return 'jail';
    case 'gotojail':
      return 'police';
    case 'parking':
      return 'palm';
    case 'start':
      return 'start';
    default:
      return 'house';
  }
}

const SPECIAL_TEXT: Record<string, string> = {
  start: 'Каждый проход через СТАРТ приносит зарплату. Остановка точно на клетке — двойная зарплата (если включены бонусы).',
  jail: 'Просто в гостях — ничего не происходит. Заключённые выходят, заплатив штраф, по карте или выбросив дубль.',
  gotojail: 'Отправляет игрока прямо в тюрьму без зарплаты за СТАРТ.',
  parking: 'Отпуск: здесь можно забрать накопленный джекпот налогов и штрафов.',
  chance: 'Вытяните карточку «Шанс»: перемещения, призы и штрафы.',
  chest: 'Вытяните карточку «Казна»: в основном денежные события.',
  wheel: 'Колесо фортуны крутится автоматически: выигрыши до $300 или неудачи.',
  rest: 'Привал — здесь ничего не происходит.',
};

/** Карточка недвижимости в стиле настольной игры */
export function PropCard({ s, i, compact }: { s: GameState; i: number; compact?: boolean }) {
  const c = cellAt(s, i);
  const ps = s.props[i];
  const owner = ps?.owner ? playerById(s, ps.owner) : undefined;
  const col = groupColor(s, i);
  const group = c.type === 'property' ? s.board.groups[c.group!]?.name : c.type === 'transport' ? 'Транспорт' : c.type === 'utility' ? 'Предприятие' : '';
  const rm = s.settings.economy.rentMult;
  const r5 = (v: number) => Math.max(1, Math.round((v * rm) / 5) * 5);

  if (c.type !== 'property' && c.type !== 'transport' && c.type !== 'utility') {
    return (
      <div className="prop-card" style={{ ['--g' as any]: '#6c47ff' }}>
        <div className="prop-card__head">
          <div className="prop-card__name">{c.name}</div>
        </div>
        <div className="prop-card__body">
          <div className="prop-card__icon">
            <Icon name={cellIcon(s, i)} />
          </div>
          <div style={{ textAlign: 'center' }}>{c.type === 'tax' ? `Налог ${money(taxOf(s, c))}${c.extraTax && !s.settings.rules.extraTaxes ? ' (отключён правилами)' : ''}` : SPECIAL_TEXT[c.type] ?? ''}</div>
          {c.type === 'parking' && s.jackpot > 0 && (
            <div style={{ textAlign: 'center', marginTop: '0.4rem' }}>
              Джекпот: <b>{money(s.jackpot)}</b>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="prop-card" style={{ ['--g' as any]: col, width: compact ? '13rem' : undefined }}>
      <div className="prop-card__head">
        <div className="prop-card__group">{group}</div>
        <div className="prop-card__name">{c.name}</div>
      </div>
      <div className="prop-card__body">
        {c.type === 'property' && c.rent && (
          <>
            {['Аренда', '1 дом', '2 дома', '3 дома', '4 дома', 'Отель'].map((label, k) => {
              const current = ps?.owner && !ps.mortgaged && ps.houses === k;
              let val = r5(c.rent![k]);
              if (k === 0 && ps?.owner && ownsGroup(s, ps.owner, c.group!)) val *= 2;
              if (compact && k > 0 && k < 5 && k !== 3) return null;
              return (
                <div key={k} className={`prop-card__row ${current ? 'current' : ''}`}>
                  <span>
                    {label}
                    {k === 0 && ps?.owner && ownsGroup(s, ps.owner, c.group!) ? ' ×2' : ''}
                  </span>
                  <b>{money(val)}</b>
                </div>
              );
            })}
            <div className="prop-card__sep" />
            <div className="prop-card__row">
              <span>Стоимость дома</span>
              <b>{money(houseCostOf(s, i))}</b>
            </div>
          </>
        )}
        {c.type === 'transport' &&
          [1, 2, 3, 4].map((n) => (
            <div key={n} className={`prop-card__row ${ps?.owner && countOwnedOfType(s, ps.owner, 'transport') === n ? 'current' : ''}`}>
              <span>Владеет {n}</span>
              <b>{money(r5(25 * Math.pow(2, n - 1)))}</b>
            </div>
          ))}
        {c.type === 'utility' && (
          <>
            <div className="prop-card__row">
              <span>Одно предприятие</span>
              <b>4× кубики</b>
            </div>
            <div className="prop-card__row">
              <span>Оба предприятия</span>
              <b>10× кубики</b>
            </div>
          </>
        )}
        <div className="prop-card__row">
          <span>Залог</span>
          <b>{money(mortgageValue(s, i))}</b>
        </div>
        <div className="prop-card__sep" />
        <div className="prop-card__row" style={{ fontSize: '1rem' }}>
          <span>Цена</span>
          <b>{money(priceOf(s, i))}</b>
        </div>
        {owner && (
          <div className="prop-card__owner">
            <Avatar id={owner.avatar} color={owner.color} size={1.5} bot={owner.isBot} />
            {owner.name}
            {ps.mortgaged ? <span className="tag red">ЗАЛОГ · выкуп {money(unmortgageCost(s, i))}</span> : <span className="tag gold">аренда {c.type === 'utility' ? (countOwnedOfType(s, owner.id, 'utility') >= 2 ? '10×' : '4×') : money(rentOf(s, i, 7))}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Маленькая плашка участка (для торговли и списков) */
export function MiniProp({ s, i, selected, onClick, disabled }: { s: GameState; i: number; selected?: boolean; onClick?: () => void; disabled?: boolean }) {
  const c = cellAt(s, i);
  const ps = s.props[i];
  return (
    <button className={`mini-prop ${selected ? 'selected' : ''} ${ps?.mortgaged ? 'mortgaged' : ''}`} onClick={onClick} disabled={disabled}>
      <i style={{ background: groupColor(s, i) }} />
      <span>
        {c.name}
        <span style={{ display: 'block', fontSize: '0.68rem', opacity: 0.7 }}>
          {money(priceOf(s, i))}
          {ps?.mortgaged ? ' · залог' : ''}
          {ps?.houses ? ` · ${ps.houses === 5 ? 'отель' : `${ps.houses} д.`}` : ''}
        </span>
      </span>
    </button>
  );
}

export function PlayerChip({ p, size = 1.8 }: { p: PlayerState; size?: number }) {
  return (
    <span className="row" style={{ gap: '0.4rem', display: 'inline-flex' }}>
      <Avatar id={p.avatar} color={p.color} size={size} bot={p.isBot} />
      <span className="title-font">{p.name}</span>
    </span>
  );
}

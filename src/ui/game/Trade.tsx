import { useEffect, useState } from 'react';
import type { GameState, TradeOffer } from '../../../shared/types';
import { groupHasBuildings, ownedCells, playerById, priceOf, tradeValidity } from '../../../shared/engine';
import { useStore, store, type TradeDraft } from '../../store';
import { GameButton, Modal, Range, money } from '../kit';
import { Avatar } from '../Avatar';
import { Icon } from '../Icon';
import { act } from '../../game/session';
import { MiniProp, useGame } from './common';
import { sound } from '../../audio/sound';

export function TradeDialog() {
  const { s, me } = useGame();
  const dialog = useStore((x) => x.dialog);
  const initial = useStore((x) => x.tradeDraft);
  const others = s.players.filter((p) => !p.bankrupt && p.id !== me?.id);
  const [d, setD] = useState<TradeDraft>(() => initial ?? { to: others[0]?.id ?? '', giveMoney: 0, giveCells: [], getMoney: 0, getCells: [] });

  useEffect(() => {
    if (dialog === 'trade') setD(initial ?? { to: others[0]?.id ?? '', giveMoney: 0, giveCells: [], getMoney: 0, getCells: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, initial]);

  if (dialog !== 'trade' || !me) return null;
  const close = () => store().set({ dialog: null, tradeDraft: null });
  const partner = playerById(s, d.to);
  const outgoing = s.trades.filter((t) => t.status === 'pending' && t.from === me.id);
  const toggle = (key: 'giveCells' | 'getCells', i: number) => {
    sound.play('pop');
    const list = d[key].includes(i) ? d[key].filter((x) => x !== i) : [...d[key], i];
    setD({ ...d, [key]: list });
  };
  const err = partner ? tradeValidity(s, { from: me.id, ...d }) : 'Выберите игрока';
  const giveValue = d.giveMoney + d.giveCells.reduce((a, i) => a + priceOf(s, i), 0);
  const getValue = d.getMoney + d.getCells.reduce((a, i) => a + priceOf(s, i), 0);

  return (
    <Modal title="Торговля" onClose={close} width="min(58rem, 96vw)">
      <div className="label">С кем торгуем?</div>
      <div className="partner-grid" style={{ marginBottom: '0.7rem', ['--n' as any]: Math.min(4, Math.max(1, others.length)) }}>
        {others.map((p) => (
          <button key={p.id} className={`pick-card ${d.to === p.id ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.4rem', minWidth: 0 }} onClick={() => (sound.play('click'), setD({ ...d, to: p.id, getCells: [], getMoney: 0 }))}>
            <Avatar id={p.avatar} color={p.color} size={2} bot={p.isBot} />
            <span>
              <span className="title-font" style={{ display: 'block' }}>{p.name}</span>
              <span className="money small">{money(p.cash)}</span>
            </span>
          </button>
        ))}
      </div>
      {partner && (
        <div className="trade-sides">
          <TradeSide s={s} title="ВЫ ОТДАЁТЕ" color="#ff8a8a" pid={me.id} cells={d.giveCells} moneyVal={d.giveMoney} maxMoney={me.cash} onToggle={(i) => toggle('giveCells', i)} onMoney={(v) => setD({ ...d, giveMoney: v })} />
          <div className="trade-sides__sep">
            <Icon name="handshake" size="2.6rem" />
          </div>
          <TradeSide s={s} title={`ВЫ ПОЛУЧАЕТЕ`} color="#6dff8e" pid={partner.id} cells={d.getCells} moneyVal={d.getMoney} maxMoney={partner.cash} onToggle={(i) => toggle('getCells', i)} onMoney={(v) => setD({ ...d, getMoney: v })} />
        </div>
      )}
      <div className="trade-footer">
        <div className="hint">
          По номиналу: отдаёте {money(giveValue)}, получаете {money(getValue)}
          {err && <div style={{ color: '#ffb3b3' }}>{err}</div>}
        </div>
        <GameButton
          color="green"
          size="lg"
          icon="handshake"
          center
          disabled={!!err}
          onClick={() => {
            act({ type: 'proposeTrade', ...d });
            store().toast(`Предложение отправлено игроку ${partner?.name}`, 'success');
            close();
          }}
        >
          {d.counterOf ? 'ВСТРЕЧНОЕ ПРЕДЛОЖЕНИЕ' : 'ПРЕДЛОЖИТЬ'}
        </GameButton>
      </div>
      {outgoing.length > 0 && (
        <div style={{ marginTop: '0.8rem' }}>
          <div className="label">Ваши предложения ждут ответа</div>
          {outgoing.map((t) => (
            <div key={t.id} className="setting-row">
              <Icon name="clock" />
              <div className="setting-row__text">
                <div className="setting-row__title">→ {playerById(s, t.to)?.name}</div>
                <div className="setting-row__desc">{describe(s, t)}</div>
              </div>
              <GameButton size="sm" color="red" onClick={() => act({ type: 'cancelTrade', tradeId: t.id })}>
                ОТОЗВАТЬ
              </GameButton>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function TradeSide(props: { s: GameState; title: string; color: string; pid: string; cells: number[]; moneyVal: number; maxMoney: number; onToggle: (i: number) => void; onMoney: (v: number) => void }) {
  const { s } = props;
  const owned = ownedCells(s, props.pid);
  const p = playerById(s, props.pid)!;
  const step = 10;
  return (
    <div className="inner grow" style={{ minWidth: '15rem' }}>
      <div className="title-font" style={{ color: props.color, marginBottom: '0.4rem' }}>{props.title}</div>
      <div className="prop-grid" style={{ marginBottom: '0.6rem' }}>
        {owned.length === 0 && <span className="hint">У игрока {p.name} нет недвижимости</span>}
        {owned.map((i) => (
          <MiniProp key={i} s={s} i={i} selected={props.cells.includes(i)} disabled={groupHasBuildings(s, i)} onClick={() => props.onToggle(i)} />
        ))}
      </div>
      <div className="label">Деньги: {money(props.moneyVal)}</div>
      <Range value={props.moneyVal} min={0} max={Math.max(0, Math.floor(props.maxMoney / step) * step)} step={step} onChange={props.onMoney} />
      <div className="step-grid" style={{ marginTop: '0.4rem' }}>
        {[-100, -10, 10, 50, 100, 500].map((inc) => (
          <button key={inc} className="chip-btn" onClick={() => props.onMoney(Math.max(0, Math.min(props.maxMoney, props.moneyVal + inc)))}>
            {inc > 0 ? `+${inc}` : inc}
          </button>
        ))}
      </div>
    </div>
  );
}

function describe(s: GameState, t: TradeOffer) {
  const part = (m: number, cells: number[]) => [m ? money(m) : '', ...cells.map((i) => s.board.cells[i].name)].filter(Boolean).join(', ') || 'ничего';
  return `Отдаёт: ${part(t.giveMoney, t.giveCells)} · Просит: ${part(t.getMoney, t.getCells)}`;
}

/** Входящее предложение */
export function IncomingTrade() {
  const { s, me, busy } = useGame();
  const dialog = useStore((x) => x.dialog);
  if (!me || dialog === 'trade' || busy) return null;
  const t = s.trades.find((x) => x.status === 'pending' && x.to === me.id);
  if (!t) return null;
  const from = playerById(s, t.from);
  if (!from) return null;
  const err = tradeValidity(s, t);
  return (
    <Modal title="Предложение сделки" width="min(46rem, 96vw)">
      <div className="row center-x" style={{ marginBottom: '0.6rem' }}>
        <Avatar id={from.avatar} color={from.color} size={3} bot={from.isBot} />
        <div className="title-font" style={{ fontSize: '1.2rem' }}>{from.name} предлагает обмен</div>
      </div>
      <div className="trade-sides">
        <div className="inner grow" style={{ minWidth: 0 }}>
          <div className="title-font" style={{ color: '#6dff8e', marginBottom: '0.4rem' }}>ВЫ ПОЛУЧАЕТЕ</div>
          {t.giveMoney > 0 && <div className="money" style={{ fontSize: '1.4rem' }}>{money(t.giveMoney)}</div>}
          <div className="prop-grid">
            {t.giveCells.map((i) => (
              <MiniProp key={i} s={s} i={i} onClick={() => store().set({ selectedCell: i })} />
            ))}
          </div>
          {!t.giveMoney && !t.giveCells.length && <div className="hint">ничего</div>}
        </div>
        <div className="trade-sides__sep" />
        <div className="inner grow" style={{ minWidth: 0 }}>
          <div className="title-font" style={{ color: '#ff8a8a', marginBottom: '0.4rem' }}>ВЫ ОТДАЁТЕ</div>
          {t.getMoney > 0 && <div className="money" style={{ fontSize: '1.4rem' }}>{money(t.getMoney)}</div>}
          <div className="prop-grid">
            {t.getCells.map((i) => (
              <MiniProp key={i} s={s} i={i} onClick={() => store().set({ selectedCell: i })} />
            ))}
          </div>
          {!t.getMoney && !t.getCells.length && <div className="hint">ничего</div>}
        </div>
      </div>
      {err && <div className="tag red" style={{ marginTop: '0.5rem', whiteSpace: 'normal' }}>{err}</div>}
      <div className="actions-grid" style={{ marginTop: '0.9rem' }}>
        <GameButton span color="green" size="lg" icon="check" disabled={!!err} onClick={() => act({ type: 'acceptTrade', tradeId: t.id })}>
          ПРИНЯТЬ
        </GameButton>
        <GameButton
          color="orange"
          icon="refresh"
          onClick={() =>
            store().set({
              dialog: 'trade',
              tradeDraft: { to: t.from, giveMoney: t.getMoney, giveCells: [...t.getCells], getMoney: t.giveMoney, getCells: [...t.giveCells], counterOf: t.id },
            })
          }
        >
          ВСТРЕЧНОЕ
        </GameButton>
        <GameButton color="red" icon="close" onClick={() => act({ type: 'rejectTrade', tradeId: t.id })}>
          ОТКЛОНИТЬ
        </GameButton>
      </div>
    </Modal>
  );
}

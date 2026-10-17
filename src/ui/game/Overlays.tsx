import { useEffect, useRef, useState } from 'react';
import { WHEEL_SECTORS } from '../../../shared/cards';
import { playerById } from '../../../shared/engine';
import { useStore } from '../../store';
import { Icon } from '../Icon';
import { Avatar } from '../Avatar';
import { director } from '../../game/director';
import { sound } from '../../audio/sound';

export function CardPopup() {
  const card = useStore((x) => x.card);
  const game = useStore((x) => x.game);
  if (!card) return null;
  const chance = card.deck === 'chance';
  const p = game ? playerById(game, card.player) : undefined;
  return (
    <div className="modal-backdrop" style={{ background: 'rgba(8,3,35,.35)' }} onClick={() => director.skip()}>
      <div className="event-card-wrap" key={card.key}>
        <div
          className="event-card"
          style={{
            ['--deck1' as any]: chance ? '#ffb300' : '#42a5f5',
            ['--deck2' as any]: chance ? '#e65100' : '#283593',
            ['--deck-edge' as any]: chance ? '#e65100' : '#283593',
          }}
        >
          <div className="event-card__back">
            <Icon name={chance ? 'question' : 'chest'} size="8rem" />
            <div className="title-font" style={{ fontSize: '2rem', marginTop: '1rem' }}>{chance ? 'ШАНС' : 'КАЗНА'}</div>
          </div>
          <div className="event-card__face">
            <div className="event-card__deck">{chance ? 'ШАНС' : 'КАЗНА'}</div>
            <Icon name={chance ? 'question' : 'chest'} />
            <div className="event-card__title">{card.title}</div>
            <div className="event-card__text">{card.text}</div>
            {p && (
              <div className="row center-x small" style={{ marginTop: '1rem', color: '#7a5a3a' }}>
                <Avatar id={p.avatar} color={p.color} size={1.6} bot={p.isBot} /> {p.name}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WheelPopup() {
  const wheel = useStore((x) => x.wheel);
  const game = useStore((x) => x.game);
  const [angle, setAngle] = useState(0);
  const [done, setDone] = useState(false);
  const ticker = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!wheel) return;
    setDone(false);
    setAngle(0);
    const n = WHEEL_SECTORS.length;
    const seg = 360 / n;
    const target = 360 * 6 + (360 - (wheel.sector + 0.5) * seg) + (Math.random() - 0.5) * seg * 0.6;
    const startT = performance.now();
    const dur = 4200;
    const raf = requestAnimationFrame(() => setAngle(target));
    // Тиканье, замедляющееся вместе с колесом
    let last = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - startT) / dur);
      const eased = 1 - Math.pow(1 - t, 3.2);
      const cur = eased * target;
      if (Math.floor(cur / seg) !== last) {
        last = Math.floor(cur / seg);
        sound.play('wheelTick');
      }
      if (t < 1) ticker.current = setTimeout(tick, 16);
      else {
        setDone(true);
        sound.play(WHEEL_SECTORS[wheel.sector].effect.kind === 'money' && (WHEEL_SECTORS[wheel.sector].effect as any).amount < 0 ? 'lose' : 'wheelWin');
      }
    };
    ticker.current = setTimeout(tick, 16);
    return () => {
      cancelAnimationFrame(raf);
      if (ticker.current) clearTimeout(ticker.current);
    };
  }, [wheel?.key]);

  if (!wheel) return null;
  const n = WHEEL_SECTORS.length;
  const r = 100;
  const p = game ? playerById(game, wheel.player) : undefined;
  return (
    <div className="modal-backdrop" style={{ flexDirection: 'column' }}>
      <div className="title-font" style={{ fontSize: '1.8rem', marginBottom: '0.8rem', textShadow: '0 0.1em 0 #3a1f9e' }}>
        КОЛЕСО ФОРТУНЫ {p ? `· ${p.name}` : ''}
      </div>
      <div className="wheel-wrap">
        <svg className="wheel-pointer" viewBox="0 0 60 72">
          <path d="M6 6 H54 L30 66 Z" fill="#ff3b30" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
          <circle cx="30" cy="20" r="7" fill="#fff" />
        </svg>
        <svg viewBox="-115 -115 230 230">
          <defs>
            <radialGradient id="wheelShine" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="rgba(255,255,255,.45)" />
              <stop offset="1" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <circle r="112" fill="#ffd23f" stroke="#8a3a02" strokeWidth="5" />
          {Array.from({ length: 24 }).map((_, k) => {
            const a = (k / 24) * Math.PI * 2;
            return <circle key={k} cx={Math.cos(a) * 106} cy={Math.sin(a) * 106} r="3.2" fill={k % 2 ? '#fff' : '#ff5252'} />;
          })}
          <g className="wheel-rot" style={{ transform: `rotate(${angle}deg)`, transition: angle ? 'transform 4.2s cubic-bezier(0.12, 0.75, 0.15, 1)' : 'none' }}>
            {WHEEL_SECTORS.map((sec, i) => {
              const a1 = ((i * 360) / n - 90) * (Math.PI / 180);
              const a2 = (((i + 1) * 360) / n - 90) * (Math.PI / 180);
              const mid = ((i + 0.5) * 360) / n;
              return (
                <g key={i}>
                  <path d={`M0 0 L${Math.cos(a1) * r} ${Math.sin(a1) * r} A${r} ${r} 0 0 1 ${Math.cos(a2) * r} ${Math.sin(a2) * r} Z`} fill={sec.color} stroke="#fff" strokeWidth="2" />
                  <text transform={`rotate(${mid}) translate(0 -64) rotate(0)`} textAnchor="middle" dominantBaseline="middle" fontFamily="Russo One, sans-serif" fontSize="13" fill="#fff" stroke="rgba(0,0,0,.35)" strokeWidth="0.8">
                    {sec.label}
                  </text>
                </g>
              );
            })}
            <circle r={r} fill="url(#wheelShine)" />
          </g>
          <circle r="16" fill="#fff" stroke="#8a3a02" strokeWidth="4" />
          <circle r="7" fill="#ff3b30" />
        </svg>
      </div>
      {done && <div className="wheel-result">{wheel.text}</div>}
    </div>
  );
}

export function OrderPopup() {
  const order = useStore((x) => x.order);
  const game = useStore((x) => x.game);
  if (!order || !game) return null;
  return (
    <div className="modal-backdrop">
      <div className="g-window has-title modal">
        <div className="g-window__title">Очерёдность ходов</div>
        <div className="order-list">
          {order.rolls.map((r, k) => {
            const p = playerById(game, r.player);
            if (!p) return null;
            return (
              <div key={r.player} className="order-item" style={{ animationDelay: `${k * 0.25}s`, boxShadow: `inset 0.3rem 0 0 ${p.color}` }}>
                <div className="order-place">{k + 1}</div>
                <Avatar id={p.avatar} color={p.color} size={2.2} bot={p.isBot} />
                <div className="grow title-font">{p.name}</div>
                <div className="order-roll">
                  <Icon name="dice" size="1.8rem" /> {r.roll}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Banner() {
  const banner = useStore((x) => x.banner);
  const [shown, setShown] = useState(banner);
  useEffect(() => {
    if (!banner) return;
    setShown(banner);
    const t = setTimeout(() => setShown(null), 1800);
    return () => clearTimeout(t);
  }, [banner?.key]);
  if (!shown) return null;
  return (
    <div className="banner" key={shown.key} style={{ ['--c' as any]: shown.color }}>
      <div className="banner__text">{shown.text}</div>
      {shown.sub && <div className="banner__sub">{shown.sub}</div>}
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((x) => x.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function NetBadge() {
  const mode = useStore((x) => x.mode);
  const status = useStore((x) => x.net.status);
  if (mode !== 'net' || status === 'online' || status === 'idle') return null;
  return (
    <div className="net-badge">
      <div className="spinner" style={{ width: '1.1rem', height: '1.1rem', borderWidth: '0.2rem' }} />
      {status === 'error' ? 'Нет связи с сервером — пробуем снова' : 'Восстанавливаем соединение…'}
    </div>
  );
}

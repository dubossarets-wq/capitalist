import { useStore } from '../../store';
import { GameButton, Window, money } from '../kit';
import { getRecords } from '../../game/records';
import { Icon } from '../Icon';

export function RecordsScreen() {
  const go = useStore((s) => s.go);
  const r = getRecords();
  const top = Object.entries(r.winners)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  return (
    <div className="screen">
      <div className="screen-header">
        <GameButton round color="purple" icon="back" onClick={() => go('menu')} />
        <div className="screen-title">РЕКОРДЫ</div>
      </div>
      <div className="screen-body">
        <Window title="Статистика" style={{ flex: 1 }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))' }}>
            {[
              ['trophy', 'Побед', `${r.wins} из ${r.games}`],
              ['chart', 'Лучший капитал', money(r.bestWorth)],
              ['coin', 'Собрано аренды', money(r.totalRent)],
              ['house', 'Куплено участков', String(r.totalBought)],
            ].map(([icon, title, val]) => (
              <div key={title} className="inner" style={{ textAlign: 'center' }}>
                <Icon name={icon} size="2.6rem" />
                <div className="muted small">{title}</div>
                <div className="money" style={{ fontSize: '1.4rem' }}>{val}</div>
              </div>
            ))}
          </div>
          <div className="label" style={{ marginTop: '1rem' }}>Таблица победителей</div>
          {top.length === 0 && <div className="hint">Сыграйте первую партию!</div>}
          {top.map(([name, wins], i) => (
            <div key={name} className="setting-row">
              <div className="title-font gold-text" style={{ width: '2rem', fontSize: '1.3rem' }}>{i + 1}</div>
              {i === 0 && <Icon name="crown" />}
              <div className="grow title-font">{name}</div>
              <div className="money">{wins} поб.</div>
            </div>
          ))}
        </Window>
        <Window title="Последние партии" style={{ flex: 1.3 }}>
          <div className="modal-body" style={{ flex: 1 }}>
            {r.history.length === 0 && <div className="hint">Здесь появится история ваших партий.</div>}
            {r.history.map((h, i) => (
              <div key={i} className="setting-row">
                <Icon name={h.winnerIsMe ? 'trophy' : 'flag'} />
                <div className="setting-row__text">
                  <div className="setting-row__title">
                    {h.winnerIsMe ? 'Победа!' : h.myPlace ? `${h.myPlace}-е место` : 'Партия'} · {h.board}
                  </div>
                  <div className="setting-row__desc">
                    {new Date(h.date).toLocaleString('ru-RU')} · {h.players} игроков · {h.turns} ходов · {h.durationMin} мин · победитель: {h.winner}
                  </div>
                </div>
                <div className="money">{money(h.myWorth)}</div>
              </div>
            ))}
          </div>
        </Window>
      </div>
    </div>
  );
}

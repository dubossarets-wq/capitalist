// Редактор настроек партии: используется и для игры с ботами, и в Wi-Fi лобби
import { useState } from 'react';
import type { GameSettings, RuleSet, Economy, ThemeId, DiceStyleId, BoardDef } from '../../shared/types';
import { BOARDS } from '../../shared/boards';
import { SETTINGS_PRESETS } from '../../shared/settings';
import { THEMES } from '../three/themes';
import { DICE_STYLES } from '../three/textures';
import { Icon } from './Icon';
import { Segmented, SettingRow, Stepper, Tabs, Toggle, money } from './kit';
import { sound } from '../audio/sound';
import { loadCustomBoard } from './screens/BoardEditor';

type Tab = 'main' | 'rules' | 'eco' | 'board';

const RULES: { key: keyof RuleSet; icon: string; title: string; desc: string }[] = [
  { key: 'auctions', icon: 'gavel', title: 'Аукционы', desc: 'Если игрок отказался от покупки — участок разыгрывается на аукционе' },
  { key: 'trading', icon: 'handshake', title: 'Обмен недвижимостью', desc: 'Сделки между игроками: деньги и участки' },
  { key: 'sellProperty', icon: 'sell', title: 'Продажа банку', desc: 'Можно продать участок банку за часть цены' },
  { key: 'mortgage', icon: 'lock', title: 'Залог', desc: 'Заложить участок и получить половину цены' },
  { key: 'unmortgage', icon: 'unlock', title: 'Выкуп заложенного', desc: 'Выкуп с надбавкой (по умолчанию +10%)' },
  { key: 'houses', icon: 'house', title: 'Строительство домов', desc: 'Дома на собранных цветовых группах' },
  { key: 'hotels', icon: 'hotel', title: 'Отели', desc: 'Пятая постройка — отель с максимальной арендой' },
  { key: 'evenBuild', icon: 'chart', title: 'Равномерная застройка', desc: 'Разница числа домов в группе — не больше одного' },
  { key: 'goSalaryEnabled', icon: 'start', title: 'Зарплата за СТАРТ', desc: 'Деньги за каждый пройденный круг' },
  { key: 'extraTaxes', icon: 'tax', title: 'Дополнительные налоги', desc: 'Налог на роскошь и другие дополнительные сборы' },
  { key: 'specialCells', icon: 'star', title: 'Специальные клетки', desc: 'Колесо фортуны и джекпот на клетке «Отпуск»' },
  { key: 'cards', icon: 'question', title: 'Карточки событий', desc: 'Клетки «Шанс» и «Казна»' },
  { key: 'wheel', icon: 'wheel', title: 'Колесо фортуны', desc: 'Призы и неудачи на клетках колеса' },
  { key: 'jail', icon: 'jail', title: 'Правила тюрьмы', desc: 'Тюрьма за три дубля подряд и клетку «В тюрьму»' },
  { key: 'rentInJail', icon: 'key', title: 'Аренда из тюрьмы', desc: 'Игрок в тюрьме продолжает получать аренду' },
  { key: 'doubleExtraRoll', icon: 'dice', title: 'Повторный бросок при дубле', desc: 'Выпал дубль — бросайте ещё раз' },
  { key: 'bonuses', icon: 'medal', title: 'Специальные бонусы', desc: 'Двойная зарплата точно на СТАРТ, налоги копятся в джекпот' },
];

const ECON: { key: keyof Economy; icon: string; title: string; min: number; max: number; step: number; fmt: (v: number) => string }[] = [
  { key: 'startMoney', icon: 'cash', title: 'Стартовый капитал', min: 500, max: 10000, step: 250, fmt: money },
  { key: 'goSalary', icon: 'start', title: 'Зарплата за круг', min: 0, max: 1000, step: 50, fmt: money },
  { key: 'priceMult', icon: 'cart', title: 'Стоимость недвижимости', min: 0.5, max: 3, step: 0.25, fmt: (v) => `×${v}` },
  { key: 'rentMult', icon: 'coin', title: 'Размер аренды', min: 0.5, max: 4, step: 0.25, fmt: (v) => `×${v}` },
  { key: 'taxMult', icon: 'tax', title: 'Размер налогов', min: 0, max: 4, step: 0.25, fmt: (v) => `×${v}` },
  { key: 'buildCostMult', icon: 'hammer', title: 'Стоимость постройки', min: 0.5, max: 3, step: 0.25, fmt: (v) => `×${v}` },
  { key: 'jailFine', icon: 'jail', title: 'Штраф за выход из тюрьмы', min: 0, max: 500, step: 10, fmt: money },
  { key: 'mortgageRate', icon: 'lock', title: 'Выплата при залоге', min: 0.2, max: 1, step: 0.1, fmt: (v) => `${Math.round(v * 100)}% цены` },
  { key: 'unmortgageFee', icon: 'unlock', title: 'Надбавка при выкупе', min: 0, max: 0.5, step: 0.05, fmt: (v) => `+${Math.round(v * 100)}%` },
  { key: 'sellRate', icon: 'sell', title: 'Цена продажи банку', min: 0.2, max: 1, step: 0.1, fmt: (v) => `${Math.round(v * 100)}% цены` },
];

export function RoomConfig({ settings, onChange, readOnly, network, seatsCount }: { settings: GameSettings; onChange: (s: GameSettings) => void; readOnly?: boolean; network?: boolean; seatsCount: number }) {
  const [tab, setTab] = useState<Tab>('main');
  const set = (p: Partial<GameSettings>) => !readOnly && onChange({ ...settings, ...p });
  const setRule = (k: keyof RuleSet, v: boolean) => set({ rules: { ...settings.rules, [k]: v } });
  const setEco = (k: keyof Economy, v: number) => set({ economy: { ...settings.economy, [k]: v } });
  const custom = loadCustomBoard();
  const boards: BoardDef[] = custom ? [...BOARDS, custom] : BOARDS;

  return (
    <div className="col" style={{ gap: 0, minHeight: 0, flex: 1 }}>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'main', label: 'Основное', icon: 'gear' },
          { id: 'board', label: 'Поле', icon: 'map' },
          { id: 'rules', label: 'Правила', icon: 'book' },
          { id: 'eco', label: 'Экономика', icon: 'coin' },
        ]}
      />
      {readOnly && <div className="hint" style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Настройки меняет хозяин комнаты — изменения видны сразу</div>}
      <div className="modal-body" style={{ flex: 1, paddingRight: '0.3rem' }}>
        {tab === 'main' && (
          <div>
            {!readOnly && (
              <SettingRow icon="star" title="Готовые наборы правил">
                <div className="segmented">
                  {SETTINGS_PRESETS.map((p) => (
                    <button key={p.id} className="chip-btn" onClick={() => (sound.play('click'), set(p.apply(settings)))}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </SettingRow>
            )}
            {network && (
              <SettingRow icon="edit" title="Название комнаты">
                <input className="g-input" style={{ maxWidth: '14rem' }} value={settings.roomName} maxLength={32} disabled={readOnly} onChange={(e) => set({ roomName: e.target.value })} />
              </SettingRow>
            )}
            <SettingRow icon="users" title="Участников за столом" desc="От 2 до 8, включая ботов">
              <Stepper value={settings.maxPlayers} min={Math.max(2, seatsCount)} max={8} disabled={readOnly} onChange={(v) => set({ maxPlayers: v })} />
            </SettingRow>
            <SettingRow icon="refresh" title="Очерёдность ходов" desc="Случайно — броском кубиков; по порядку — как расставлены места">
              <Segmented value={settings.turnOrder} disabled={readOnly} onChange={(v) => set({ turnOrder: v })} options={[{ value: 'random', label: 'Случайно' }, { value: 'fixed', label: 'По порядку' }]} />
            </SettingRow>
            <SettingRow icon="timer" title="Таймер хода" desc="Не успел — за игрока решает автопилот">
              <Segmented
                value={settings.turnTimer}
                disabled={readOnly}
                onChange={(v) => set({ turnTimer: v })}
                options={[0, 30, 60, 90, 120].map((v) => ({ value: v, label: v ? `${v} с` : '∞' }))}
              />
            </SettingRow>
            <SettingRow icon="clock" title="Длительность партии" desc="По истечении времени побеждает самый богатый">
              <Segmented
                value={settings.maxDuration}
                disabled={readOnly}
                onChange={(v) => set({ maxDuration: v })}
                options={[0, 20, 30, 45, 60, 90].map((v) => ({ value: v, label: v ? `${v} мин` : '∞' }))}
              />
            </SettingRow>
            <SettingRow icon="flag" title="Лимит кругов" desc="После указанного числа кругов побеждает самый богатый">
              <Segmented value={settings.maxTurns} disabled={readOnly} onChange={(v) => set({ maxTurns: v })} options={[0, 15, 25, 40, 60].map((v) => ({ value: v, label: v ? String(v) : '∞' }))} />
            </SettingRow>
            <SettingRow icon="trophy" title="Условие победы">
              <Segmented
                value={settings.winCondition}
                disabled={readOnly}
                onChange={(v) => set({ winCondition: v })}
                options={[
                  { value: 'lastStanding', label: 'Последний выживший' },
                  { value: 'netWorth', label: 'Капитал' },
                ]}
              />
            </SettingRow>
            {settings.winCondition === 'netWorth' && (
              <SettingRow icon="chart" title="Цель по капиталу" desc="Деньги + стоимость имущества">
                <Stepper value={settings.targetNetWorth} min={2000} max={50000} step={1000} disabled={readOnly} format={money} onChange={(v) => set({ targetNetWorth: v })} />
              </SettingRow>
            )}
            <SettingRow icon="bolt" title="Быстрая игра" desc="Ускоренные анимации, каждый получает 2 случайных участка на старте">
              <Toggle value={settings.quickGame} disabled={readOnly} onChange={(v) => set({ quickGame: v })} />
            </SettingRow>
          </div>
        )}

        {tab === 'board' && (
          <div className="col">
            <div className="label">Игровое поле</div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))' }}>
              {boards.map((b) => (
                <button key={b.id} className={`pick-card ${settings.boardId === b.id ? 'active' : ''}`} disabled={readOnly} onClick={() => (sound.play('click'), set({ boardId: b.id, customBoard: b.id === 'custom' ? b : null }))}>
                  <div className="title-font" style={{ fontSize: '1.05rem' }}>{b.name}</div>
                  <div className="row" style={{ gap: '0.15rem', margin: '0.35rem 0', flexWrap: 'wrap' }}>
                    {b.groups.map((g, i) => (
                      <i key={i} style={{ width: '0.8rem', height: '0.8rem', borderRadius: '0.2rem', background: g.color, display: 'block' }} />
                    ))}
                  </div>
                  <div className="hint">
                    {b.cells.length} клеток · {b.description}
                  </div>
                  {settings.boardId === b.id && <Icon name="check" className="check" />}
                </button>
              ))}
            </div>
            <div className="label" style={{ marginTop: '0.4rem' }}>Оформление</div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))' }}>
              {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                const t = THEMES[id];
                return (
                  <button key={id} className={`pick-card ${settings.theme === id ? 'active' : ''}`} disabled={readOnly} onClick={() => (sound.play('click'), set({ theme: id }))}>
                    <div style={{ height: '3.2rem', borderRadius: '0.7rem', background: t.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', marginBottom: '0.4rem' }}>
                      <i style={{ width: '1.4rem', height: '1.9rem', borderRadius: '0.25rem', background: t.cellBg, boxShadow: `inset 0 0.45rem 0 ${t.accent}` }} />
                      <i style={{ width: '1.9rem', height: '1.9rem', borderRadius: '0.25rem', background: t.center1 }} />
                      <i style={{ width: '1.4rem', height: '1.9rem', borderRadius: '0.25rem', background: t.cellBg, boxShadow: `inset 0 0.45rem 0 ${t.accent2}` }} />
                    </div>
                    <div className="title-font">{t.name}</div>
                    <div className="hint">{t.description}</div>
                    {settings.theme === id && <Icon name="check" className="check" />}
                  </button>
                );
              })}
            </div>
            <div className="label" style={{ marginTop: '0.4rem' }}>Кубики</div>
            <div className="row wrap">
              {DICE_STYLES.map((d) => (
                <button key={d.id} className={`pick-card ${settings.diceStyle === d.id ? 'active' : ''}`} disabled={readOnly} onClick={() => (sound.play('click'), set({ diceStyle: d.id as DiceStyleId }))} style={{ textAlign: 'center', padding: '0.5rem 0.7rem' }}>
                  <DicePreview body={d.body} body2={d.body2} pip={d.pip} />
                  <div className="small title-font" style={{ marginTop: '0.3rem' }}>{d.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'rules' && (
          <div>
            {RULES.map((r) => (
              <SettingRow key={r.key} icon={r.icon} title={r.title} desc={r.desc}>
                <Toggle value={settings.rules[r.key]} disabled={readOnly} onChange={(v) => setRule(r.key, v)} />
              </SettingRow>
            ))}
          </div>
        )}

        {tab === 'eco' && (
          <div>
            {ECON.map((e) => (
              <SettingRow key={e.key} icon={e.icon} title={e.title}>
                <Stepper value={settings.economy[e.key]} min={e.min} max={e.max} step={e.step} format={e.fmt} disabled={readOnly} onChange={(v) => setEco(e.key, v)} />
              </SettingRow>
            ))}
            <div className="hint" style={{ marginTop: '0.6rem' }}>Цены и аренда отдельных участков меняются в редакторе поля (главное меню → «Редактор поля»).</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DicePreview({ body, body2, pip }: { body: string; body2: string; pip: string }) {
  return (
    <svg viewBox="0 0 64 64" width="44" height="44">
      <defs>
        <linearGradient id={`dg${body}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={body} />
          <stop offset="1" stopColor={body2} />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="12" fill={`url(#dg${body})`} stroke="#2a1659" strokeWidth="3.5" />
      {[
        [20, 20],
        [44, 20],
        [32, 32],
        [20, 44],
        [44, 44],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill={pip} />
      ))}
    </svg>
  );
}

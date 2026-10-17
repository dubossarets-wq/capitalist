import { useState } from 'react';
import type { BoardDef, CellDef, CellType } from '../../../shared/types';
import { BOARDS, genRent, houseCostFor, validateBoard, GROUP_COLORS } from '../../../shared/boards';
import { useStore, store, lsGet, lsSet } from '../../store';
import { GameButton, Stepper, Window } from '../kit';
import { sound } from '../../audio/sound';

const KEY = 'capitalist.customBoard.v1';

export function loadCustomBoard(): BoardDef | null {
  const b = lsGet<BoardDef | null>(KEY, null);
  if (!b || !Array.isArray(b.cells) || validateBoard(b)) return null;
  return { ...b, id: 'custom' };
}

const TYPE_NAMES: Partial<Record<CellType, string>> = {
  property: 'Участок',
  transport: 'Транспорт',
  utility: 'Предприятие',
  tax: 'Налог',
  chance: 'Шанс',
  chest: 'Казна',
  wheel: 'Колесо фортуны',
  rest: 'Пустая клетка',
};

const CORNER_NAMES: Partial<Record<CellType, string>> = { start: 'СТАРТ', jail: 'Тюрьма', parking: 'Отпуск', gotojail: 'В тюрьму' };

function copyBoard(b: BoardDef): BoardDef {
  const c = JSON.parse(JSON.stringify(b)) as BoardDef;
  c.id = 'custom';
  c.name = `Моё поле (${b.name})`;
  c.description = 'Поле, созданное в редакторе';
  return c;
}

function defaultCell(type: CellType, prev?: CellDef): CellDef {
  switch (type) {
    case 'property': {
      const price = prev?.price ?? 200;
      return { type, name: prev?.type === 'property' ? prev.name : 'Новая улица', group: prev?.group ?? 0, price, rent: genRent(price), houseCost: houseCostFor(price) };
    }
    case 'transport':
      return { type, name: 'Вокзал', price: 200, icon: 'train' };
    case 'utility':
      return { type, name: 'Электростанция', price: 150, icon: 'bolt' };
    case 'tax':
      return { type, name: 'Налог', amount: 100 };
    case 'chance':
      return { type, name: 'Шанс' };
    case 'chest':
      return { type, name: 'Казна' };
    case 'wheel':
      return { type, name: 'Колесо фортуны' };
    default:
      return { type: 'rest', name: 'Привал' };
  }
}

/** Изменить число клеток на стороне, сохраняя углы и порядок клеток */
function resizeBoard(b: BoardDef, newSide: number): BoardDef {
  const side = b.cells.length / 4;
  const corners = [0, 1, 2, 3].map((k) => b.cells[k * side]);
  const sides = [0, 1, 2, 3].map((k) => b.cells.slice(k * side + 1, (k + 1) * side));
  const cells: CellDef[] = [];
  for (let k = 0; k < 4; k++) {
    cells.push(corners[k]);
    const list = sides[k].slice(0, newSide - 1);
    while (list.length < newSide - 1) {
      const last = [...list].reverse().find((c) => c.type === 'property') ?? list[list.length - 1];
      list.push(defaultCell('property', last ? { ...last, price: Math.min(600, (last.price ?? 200) + 20) } : undefined));
    }
    cells.push(...list);
  }
  return { ...b, cells };
}

export function BoardEditor() {
  const go = useStore((s) => s.go);
  const [board, setBoard] = useState<BoardDef>(() => loadCustomBoard() ?? copyBoard(BOARDS[0]));
  const side = board.cells.length / 4;
  const err = validateBoard(board);

  const updateCell = (i: number, c: CellDef) => {
    const cells = [...board.cells];
    cells[i] = c;
    setBoard({ ...board, cells });
  };

  const save = () => {
    if (err) {
      sound.play('error');
      store().toast(err, 'error');
      return;
    }
    lsSet(KEY, board);
    const s = store().setupSettings;
    store().set({ setupSettings: { ...s, boardId: 'custom', customBoard: { ...board, id: 'custom' } } });
    sound.play('buy');
    store().toast('Поле сохранено и выбрано для следующей партии', 'success');
  };

  const num = (v: string, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : def;
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <GameButton round color="purple" icon="back" onClick={() => go('menu')} />
        <div className="screen-title">РЕДАКТОР ПОЛЯ</div>
      </div>
      <div className="screen-body">
        <Window title="Основа" style={{ flex: '0 0 22rem', maxWidth: '100%' }}>
          <div className="modal-body col" style={{ flex: 1 }}>
            <div>
              <div className="label">Название поля</div>
              <input className="g-input" value={board.name} maxLength={40} onChange={(e) => setBoard({ ...board, name: e.target.value })} />
            </div>
            <div>
              <div className="label">Начать с готового поля</div>
              <div className="col" style={{ gap: '0.4rem' }}>
                {BOARDS.map((b) => (
                  <GameButton key={b.id} size="sm" color="dark" block onClick={() => setBoard(copyBoard(b))} sub={`${b.cells.length} клеток`}>
                    {b.name}
                  </GameButton>
                ))}
              </div>
            </div>
            <div>
              <div className="label">Клеток на стороне (всего {board.cells.length})</div>
              <Stepper value={side} min={6} max={16} onChange={(v) => setBoard(resizeBoard(board, v))} />
            </div>
            <div>
              <div className="label">Цветовые группы</div>
              {board.groups.map((g, gi) => (
                <div key={gi} className="row" style={{ marginBottom: '0.35rem' }}>
                  <input
                    type="color"
                    value={g.color}
                    onChange={(e) => {
                      const groups = [...board.groups];
                      groups[gi] = { ...g, color: e.target.value };
                      setBoard({ ...board, groups });
                    }}
                    style={{ width: '2.4rem', height: '2.2rem', border: 'none', background: 'none', padding: 0 }}
                  />
                  <input
                    className="g-input"
                    style={{ fontSize: '0.85rem', padding: '0.4em 0.7em' }}
                    value={g.name}
                    maxLength={24}
                    onChange={(e) => {
                      const groups = [...board.groups];
                      groups[gi] = { ...g, name: e.target.value };
                      setBoard({ ...board, groups });
                    }}
                  />
                </div>
              ))}
              {board.groups.length < 10 && (
                <button className="chip-btn" onClick={() => setBoard({ ...board, groups: [...board.groups, { name: `Группа ${board.groups.length + 1}`, color: GROUP_COLORS[board.groups.length % GROUP_COLORS.length] }] })}>
                  + группа
                </button>
              )}
            </div>
            {err ? <div className="tag red" style={{ whiteSpace: 'normal' }}>{err}</div> : <div className="tag green">Поле корректно</div>}
          </div>
        </Window>
        <Window title="Клетки" style={{ flex: 1, minWidth: 0 }}>
          <div className="modal-body" style={{ flex: 1 }}>
            {board.cells.map((c, i) => {
              const corner = i % side === 0;
              const col = c.type === 'property' ? board.groups[c.group ?? 0]?.color : undefined;
              return (
                <div key={i} className="setting-row wrap" style={{ boxShadow: col ? `inset 0.35rem 0 0 ${col}` : undefined, alignItems: 'flex-start' }}>
                  <div className="title-font muted" style={{ width: '2rem', paddingTop: '0.5rem' }}>{i}</div>
                  {corner ? (
                    <div className="title-font" style={{ paddingTop: '0.4rem' }}>Угол: {CORNER_NAMES[c.type] ?? c.name}</div>
                  ) : (
                    <div className="col grow" style={{ gap: '0.35rem' }}>
                      <div className="row wrap" style={{ gap: '0.35rem' }}>
                        <select className="g-input" style={{ width: '10rem', fontSize: '0.85rem', padding: '0.35em 0.5em' }} value={c.type} onChange={(e) => updateCell(i, defaultCell(e.target.value as CellType, c))}>
                          {Object.entries(TYPE_NAMES).map(([t, n]) => (
                            <option key={t} value={t}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <input className="g-input grow" style={{ fontSize: '0.85rem', padding: '0.35em 0.6em', minWidth: '8rem' }} value={c.name} maxLength={28} onChange={(e) => updateCell(i, { ...c, name: e.target.value })} />
                        {c.type === 'property' && (
                          <select className="g-input" style={{ width: '9rem', fontSize: '0.85rem', padding: '0.35em 0.5em' }} value={c.group} onChange={(e) => updateCell(i, { ...c, group: Number(e.target.value) })}>
                            {board.groups.map((g, gi) => (
                              <option key={gi} value={gi}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      {(c.type === 'property' || c.type === 'transport' || c.type === 'utility') && (
                        <div className="row wrap small" style={{ gap: '0.35rem' }}>
                          <span>Цена $</span>
                          <input className="g-input" style={{ width: '5rem', fontSize: '0.85rem', padding: '0.3em 0.5em' }} value={c.price ?? 0} onChange={(e) => updateCell(i, { ...c, price: num(e.target.value, c.price ?? 0) })} />
                          {c.type === 'property' && (
                            <>
                              <span>Дом $</span>
                              <input className="g-input" style={{ width: '4.5rem', fontSize: '0.85rem', padding: '0.3em 0.5em' }} value={c.houseCost ?? 0} onChange={(e) => updateCell(i, { ...c, houseCost: num(e.target.value, c.houseCost ?? 50) })} />
                              <span>Аренда:</span>
                              {(c.rent ?? genRent(c.price ?? 100)).map((r, k) => (
                                <input
                                  key={k}
                                  title={['без домов', '1 дом', '2 дома', '3 дома', '4 дома', 'отель'][k]}
                                  className="g-input"
                                  style={{ width: '3.8rem', fontSize: '0.8rem', padding: '0.3em 0.4em' }}
                                  value={r}
                                  onChange={(e) => {
                                    const rent = [...(c.rent ?? genRent(c.price ?? 100))];
                                    rent[k] = num(e.target.value, r);
                                    updateCell(i, { ...c, rent });
                                  }}
                                />
                              ))}
                              <button className="chip-btn" onClick={() => updateCell(i, { ...c, rent: genRent(c.price ?? 100), houseCost: houseCostFor(c.price ?? 100) })}>
                                авто
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {c.type === 'tax' && (
                        <div className="row small" style={{ gap: '0.35rem' }}>
                          <span>Сумма $</span>
                          <input className="g-input" style={{ width: '5rem', fontSize: '0.85rem', padding: '0.3em 0.5em' }} value={c.amount ?? 0} onChange={(e) => updateCell(i, { ...c, amount: num(e.target.value, c.amount ?? 100) })} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Window>
      </div>
      <div className="screen-footer">
        <GameButton color="green" size="lg" icon="save" onClick={save}>
          СОХРАНИТЬ ПОЛЕ
        </GameButton>
        <GameButton color="blue" size="lg" icon="play" disabled={!!err} onClick={() => (save(), go('setup'))}>
          ИГРАТЬ НА НЁМ
        </GameButton>
      </div>
    </div>
  );
}

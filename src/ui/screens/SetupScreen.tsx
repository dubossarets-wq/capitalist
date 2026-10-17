import { useEffect } from 'react';
import type { BotLevel } from '../../../shared/types';
import { AVATARS, BOT_NAMES, PLAYER_COLORS, TOKENS } from '../../../shared/settings';
import { useStore, type OfflineSeat } from '../../store';
import { GameButton, Segmented, Window } from '../kit';
import { Avatar, TokenImg } from '../Avatar';
import { RoomConfig } from '../RoomConfig';
import { startLocalGame, LOCAL_ID } from '../../game/session';
import { Icon } from '../Icon';
import { sound } from '../../audio/sound';

export const LEVEL_NAMES: Record<BotLevel, string> = { easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный' };

export function makeBot(existing: { profile: { name: string; token: string; color: string } }[], level: BotLevel): OfflineSeat {
  const names = new Set(existing.map((s) => s.profile.name));
  const colors = new Set(existing.map((s) => s.profile.color));
  const tokens = new Set(existing.map((s) => s.profile.token));
  const freeTokens = TOKENS.filter((t) => !tokens.has(t.id));
  return {
    id: `bot-${Math.random().toString(36).slice(2, 8)}`,
    isBot: true,
    botLevel: level,
    profile: {
      name: BOT_NAMES.find((n) => !names.has(n)) ?? `Бот ${existing.length + 1}`,
      token: (freeTokens[Math.floor(Math.random() * freeTokens.length)] ?? TOKENS[0]).id,
      color: PLAYER_COLORS.find((c) => !colors.has(c)) ?? PLAYER_COLORS[0],
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    },
  };
}

export function SetupScreen() {
  const go = useStore((s) => s.go);
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.setupSettings);
  const bots = useStore((s) => s.setupSeats);
  const set = useStore((s) => s.set);

  const me: OfflineSeat = { id: LOCAL_ID, isBot: false, botLevel: 'medium', profile };

  // Боты не должны совпадать с игроком по цвету и фишке
  useEffect(() => {
    let list = bots.filter((b) => b.isBot);
    if (!list.length) {
      list = [];
      for (const lv of ['easy', 'medium', 'hard'] as BotLevel[]) list.push(makeBot([me, ...list], lv));
    }
    const fixed: OfflineSeat[] = [];
    for (const b of list) {
      const others = [me, ...fixed];
      const clash = others.some((o) => o.profile.color === b.profile.color || o.profile.token === b.profile.token);
      if (!clash) {
        fixed.push(b);
        continue;
      }
      const nb = makeBot(others, b.botLevel);
      fixed.push({ ...nb, profile: { ...nb.profile, name: b.profile.name } });
    }
    if (JSON.stringify(fixed) !== JSON.stringify(bots)) set({ setupSeats: fixed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.color, profile.token]);

  const seats = [me, ...bots];
  const updateBots = (list: OfflineSeat[]) => {
    set({ setupSeats: list, setupSettings: { ...settings, maxPlayers: Math.max(2, list.length + 1) } });
  };

  const addBot = (level: BotLevel) => {
    if (seats.length >= 8) return;
    sound.play('pop');
    updateBots([...bots, makeBot(seats, level)]);
  };

  const cycleToken = (i: number) => {
    const b = bots[i];
    const used = new Set(seats.map((s) => s.profile.token));
    const idx = TOKENS.findIndex((t) => t.id === b.profile.token);
    for (let k = 1; k <= TOKENS.length; k++) {
      const t = TOKENS[(idx + k) % TOKENS.length];
      if (!used.has(t.id)) {
        const list = [...bots];
        list[i] = { ...b, profile: { ...b.profile, token: t.id } };
        updateBots(list);
        return;
      }
    }
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <GameButton round color="purple" icon="back" onClick={() => go('menu')} />
        <div className="screen-title">ИГРА С БОТАМИ</div>
      </div>
      <div className="screen-body">
        <Window title={`Игроки: ${seats.length} из 8`} style={{ flex: '0 0 26rem', maxWidth: '100%' }}>
          <div className="modal-body" style={{ flex: 1 }}>
            <div className="seat-card" style={{ ['--c' as any]: profile.color }}>
              <Avatar id={profile.avatar} color={profile.color} size={2.8} />
              <div className="grow">
                <div className="seat-card__name">{profile.name}</div>
                <div className="seat-card__meta">
                  <span className="tag gold">
                    <Icon name="user" /> ВЫ
                  </span>
                  <span>{TOKENS.find((t) => t.id === profile.token)?.name}</span>
                </div>
              </div>
              <TokenImg token={profile.token} color={profile.color} size={2.8} />
              <GameButton round size="sm" color="purple" icon="edit" title="Изменить профиль" onClick={() => go('profile')} />
            </div>
            {bots.map((b, i) => (
              <div key={b.id} className="seat-card" style={{ ['--c' as any]: b.profile.color }}>
                <Avatar id={b.profile.avatar} color={b.profile.color} size={2.8} bot />
                <div className="grow">
                  <div className="seat-card__name">{b.profile.name}</div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <Segmented
                      value={b.botLevel}
                      onChange={(lv) => {
                        const list = [...bots];
                        list[i] = { ...b, botLevel: lv };
                        updateBots(list);
                      }}
                      options={(['easy', 'medium', 'hard'] as BotLevel[]).map((lv) => ({ value: lv, label: LEVEL_NAMES[lv] }))}
                    />
                  </div>
                </div>
                <button className="pick-card" style={{ padding: '0.2rem' }} title="Сменить фишку" onClick={() => (sound.play('pop'), cycleToken(i))}>
                  <TokenImg token={b.profile.token} color={b.profile.color} size={2.8} />
                </button>
                <GameButton round size="sm" color="red" icon="close" title="Убрать бота" disabled={bots.length <= 1} onClick={() => updateBots(bots.filter((_, k) => k !== i))} />
              </div>
            ))}
            {seats.length < 8 && (
              <div className="empty-seat">
                <div style={{ marginBottom: '0.5rem' }}>Добавить бота</div>
                <div className="row center-x wrap">
                  <GameButton size="sm" color="green" icon="plus" onClick={() => addBot('easy')}>
                    ЛЁГКИЙ
                  </GameButton>
                  <GameButton size="sm" color="orange" icon="plus" onClick={() => addBot('medium')}>
                    СРЕДНИЙ
                  </GameButton>
                  <GameButton size="sm" color="red" icon="plus" onClick={() => addBot('hard')}>
                    СЛОЖНЫЙ
                  </GameButton>
                </div>
              </div>
            )}
            <div className="hint" style={{ marginTop: '0.8rem' }}>
              Лёгкий бот покупает почти всё подряд. Средний собирает группы и держит резерв. Сложный считает доходность, блокирует ваши монополии и жёстко торгуется.
            </div>
          </div>
        </Window>
        <Window title="Настройки партии" style={{ flex: 1, minWidth: 0 }}>
          <RoomConfig settings={settings} seatsCount={seats.length} onChange={(s) => set({ setupSettings: { ...s, maxPlayers: seats.length } })} />
        </Window>
      </div>
      <div className="screen-footer">
        <GameButton color="green" size="xl" icon="dice" pulse onClick={() => startLocalGame({ ...settings, maxPlayers: seats.length }, seats)}>
          НАЧАТЬ ИГРУ
        </GameButton>
      </div>
    </div>
  );
}

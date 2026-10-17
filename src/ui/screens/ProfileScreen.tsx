import type { PlayerProfile } from '../../../shared/types';
import { AVATARS, PLAYER_COLORS, TOKENS, TOKEN_SETS } from '../../../shared/settings';
import { useStore } from '../../store';
import { GameButton, Window } from '../kit';
import { Avatar, TokenImg } from '../Avatar';
import { sound } from '../../audio/sound';

/** Выбор имени, аватара, фишки и цвета */
export function ProfileEditor({ profile, onChange, takenColors = [], takenTokens = [], hideName }: { profile: PlayerProfile; onChange: (p: PlayerProfile) => void; takenColors?: string[]; takenTokens?: string[]; hideName?: boolean }) {
  const set = (p: Partial<PlayerProfile>) => onChange({ ...profile, ...p });
  return (
    <div className="col" style={{ gap: '0.9rem' }}>
      {!hideName && (
        <div>
          <div className="label">Имя</div>
          <input className="g-input" value={profile.name} maxLength={18} onChange={(e) => set({ name: e.target.value })} placeholder="Ваше имя" />
        </div>
      )}
      <div>
        <div className="label">Цвет игрока</div>
        <div className="color-grid">
          {PLAYER_COLORS.map((c) => (
            <button key={c} className={`color-dot ${profile.color === c ? 'active' : ''}`} style={{ background: c }} disabled={takenColors.includes(c) && profile.color !== c} onClick={() => (sound.play('pop'), set({ color: c }))} />
          ))}
        </div>
      </div>
      <div>
        <div className="label">Аватар</div>
        <div className="pick-grid round" style={{ ['--cell' as any]: '3.6rem' }}>
          {AVATARS.map((a) => (
            <button key={a} className={`pick-card ${profile.avatar === a ? 'active' : ''}`} onClick={() => (sound.play('pop'), set({ avatar: a }))}>
              <Avatar id={a} color={profile.color} size={2.6} />
            </button>
          ))}
        </div>
      </div>
      {TOKEN_SETS.map((setName) => (
        <div key={setName}>
          <div className="label">Фишки — набор «{setName}»</div>
          <div className="pick-grid">
            {TOKENS.filter((t) => t.set === setName).map((t) => (
              <button key={t.id} className={`pick-card ${profile.token === t.id ? 'active' : ''}`} disabled={takenTokens.includes(t.id) && profile.token !== t.id} onClick={() => (sound.play('pop'), set({ token: t.id }))}>
                <TokenImg token={t.id} color={profile.color} size={3.4} />
                <div className="pick-label">{t.name}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileScreen() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const go = useStore((s) => s.go);
  return (
    <div className="screen">
      <div className="screen-header">
        <GameButton round color="purple" icon="back" onClick={() => go('menu')} />
        <div className="screen-title">ПРОФИЛЬ ИГРОКА</div>
      </div>
      <div className="screen-body" style={{ justifyContent: 'center' }}>
        <Window title="Кто вы?" style={{ width: 'min(52rem, 100%)', flex: 'none' }}>
          <div className="row" style={{ marginBottom: '1rem', justifyContent: 'center', gap: '1.2rem' }}>
            <Avatar id={profile.avatar} color={profile.color} size={5} />
            <TokenImg token={profile.token} color={profile.color} size={6} />
          </div>
          <div className="modal-body" style={{ maxHeight: '58vh' }}>
            <ProfileEditor profile={profile} onChange={(p) => setProfile(p)} />
          </div>
        </Window>
      </div>
      <div className="screen-footer">
        <GameButton color="green" size="lg" icon="check" onClick={() => go('menu')}>
          ГОТОВО
        </GameButton>
      </div>
    </div>
  );
}

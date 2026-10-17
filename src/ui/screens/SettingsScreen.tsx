import { useStore } from '../../store';
import { GameButton, Range, Segmented, SettingRow, Toggle, Window } from '../kit';
import { THEMES } from '../../three/themes';
import type { ThemeId } from '../../../shared/types';
import { sound } from '../../audio/sound';
import { getScene } from '../../three/sceneHost';
import { toggleFullscreen } from '../fullscreen';

export function SettingsPanel() {
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  return (
    <div>
      <SettingRow icon="music" title="Музыка" desc={`${Math.round(prefs.music * 100)}%`}>
        <div style={{ width: '45%' }}>
          <Range value={prefs.music} min={0} max={1} step={0.05} onChange={(v) => setPrefs({ music: v })} />
        </div>
      </SettingRow>
      <SettingRow icon="sound" title="Звуки" desc={`${Math.round(prefs.sfx * 100)}%`}>
        <div style={{ width: '45%' }}>
          <Range
            value={prefs.sfx}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => {
              setPrefs({ sfx: v });
              sound.setVolumes(v, prefs.music);
              sound.play('coin');
            }}
          />
        </div>
      </SettingRow>
      <SettingRow icon="map" title="Вид поля" desc="2D — плоский вид сверху: всё поле сразу, легче для слабых устройств">
        <Segmented
          value={prefs.view}
          onChange={(v) => setPrefs({ view: v })}
          options={[
            { value: '3d', label: '3D' },
            { value: '2d', label: '2D' },
          ]}
        />
      </SettingRow>
      <SettingRow icon="camera" title="Качество графики" desc="Низкое — без теней, для слабых телефонов">
        <Segmented
          value={prefs.quality}
          onChange={(q) => {
            setPrefs({ quality: q });
            getScene()?.setQuality(q);
          }}
          options={[
            { value: 'low', label: 'Низкое' },
            { value: 'medium', label: 'Среднее' },
            { value: 'high', label: 'Высокое' },
          ]}
        />
      </SettingRow>
      <SettingRow icon="bolt" title="Анимации" desc="Быстрые и минимальные — для слабых устройств и спешащих">
        <Segmented
          value={prefs.anim}
          onChange={(a) => setPrefs({ anim: a })}
          options={[
            { value: 'full', label: 'Полные' },
            { value: 'fast', label: 'Быстрые' },
            { value: 'minimal', label: 'Минимум' },
          ]}
        />
      </SettingRow>
      <SettingRow icon="eye" title="Камера следит за фишкой" desc="Плавно двигается за активным игроком">
        <Toggle value={prefs.cameraFollow} onChange={(v) => setPrefs({ cameraFollow: v })} />
      </SettingRow>
      <SettingRow icon="scroll" title="Журнал ходов на экране" desc="История событий справа (на компьютере)">
        <Toggle value={prefs.showLog} onChange={(v) => setPrefs({ showLog: v })} />
      </SettingRow>
      <SettingRow icon="palette" title="Тема главного меню">
        <Segmented value={prefs.menuTheme} onChange={(t: ThemeId) => setPrefs({ menuTheme: t })} options={(Object.keys(THEMES) as ThemeId[]).map((id) => ({ value: id, label: THEMES[id].name }))} />
      </SettingRow>
      <SettingRow icon="fullscreen" title="Полный экран" desc="На iPhone недоступен — используйте «На экран Домой»">
        <GameButton size="sm" color="purple" onClick={toggleFullscreen}>
          ВКЛ / ВЫКЛ
        </GameButton>
      </SettingRow>
    </div>
  );
}

export function SettingsScreen() {
  const go = useStore((s) => s.go);
  return (
    <div className="screen">
      <div className="screen-header">
        <GameButton round color="purple" icon="back" onClick={() => go('menu')} />
        <div className="screen-title">НАСТРОЙКИ</div>
      </div>
      <div className="screen-body" style={{ justifyContent: 'center' }}>
        <Window title="Звук и графика" style={{ width: 'min(44rem, 100%)', flex: 'none' }}>
          <div className="modal-body" style={{ maxHeight: '70vh' }}>
            <SettingsPanel />
          </div>
        </Window>
      </div>
    </div>
  );
}

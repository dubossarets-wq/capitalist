import { useEffect, useState } from 'react';
import { useStore, store } from '../../store';
import { GameButton } from '../kit';
import { Avatar, TokenImg } from '../Avatar';
import { hasSave, resumeLocalGame, importSave } from '../../game/session';
import { net } from '../../net/netClient';
import { toggleFullscreen } from '../fullscreen';
import { Modal } from '../kit';
import { Icon } from '../Icon';
import { STATIC_SITE, REPO_URL } from '../../net/staticMode';

/** Объяснение для онлайн-версии: Wi-Fi игре нужен сервер на компьютере */
export function WifiHelp({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Игра по Wi-Fi" onClose={onClose} width="min(34rem, 94vw)">
      <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
        <Icon name="wifi" size="4rem" />
        <div className="title-font" style={{ fontSize: '1.15rem' }}>Для игры с друзьями нужен сервер на компьютере</div>
        <div className="hint" style={{ fontSize: '0.9rem', textAlign: 'left' }}>
          Эта онлайн-версия работает без сервера — в ней доступна игра с ботами. Чтобы играть по Wi-Fi:
          <ol style={{ paddingLeft: '1.2rem', lineHeight: 1.5 }}>
            <li>Установите Node.js с сайта nodejs.org (версия 18 или новее).</li>
            <li>Скачайте игру со страницы на GitHub: кнопка «Code» → «Download ZIP», затем распакуйте.</li>
            <li>Запустите «Запустить игру.bat» (Windows) или start.sh (macOS, Linux).</li>
            <li>Телефоны в той же Wi-Fi сети открывают адрес или QR-код из окна сервера.</li>
          </ol>
          Интернет для игры по Wi-Fi не нужен — только общая сеть.
        </div>
        <div className="row wrap center-x">
          <GameButton color="blue" icon="download" onClick={() => window.open(REPO_URL, '_blank', 'noopener')}>
            СТРАНИЦА НА GITHUB
          </GameButton>
          <GameButton color="green" icon="robot" onClick={() => (onClose(), store().go('setup'))}>
            ИГРАТЬ С БОТАМИ
          </GameButton>
        </div>
      </div>
    </Modal>
  );
}

export function MainMenu() {
  const profile = useStore((s) => s.profile);
  const go = useStore((s) => s.go);
  const [save, setSave] = useState(hasSave());
  const [busy, setBusy] = useState(false);
  const [wifiHelp, setWifiHelp] = useState(false);

  useEffect(() => setSave(hasSave()), []);

  const createRoom = async () => {
    if (STATIC_SITE) return setWifiHelp(true);
    setBusy(true);
    try {
      await net.connect();
      net.createRoom({ ...store().setupSettings, roomName: store().setupSettings.roomName || `Комната ${profile.name}` });
    } catch (e) {
      store().toast((e as Error).message, 'error');
      go('join');
    } finally {
      setBusy(false);
    }
  };

  const loadFile = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      const err = importSave(await f.text());
      if (err) store().toast(err, 'error');
    };
    inp.click();
  };

  return (
    <div className="menu-screen">
      <div className="logo">
        <div className="logo__title">КАПИТАЛИСТ</div>
        <div className="logo__sub">ИМПЕРИЯ НА КУБИКАХ</div>
      </div>
      <div className="menu-buttons">
        {save && (
          <GameButton color="orange" size="lg" icon="play" block pulse onClick={() => resumeLocalGame(save.state)} sub={`${save.state.board.name} · ход ${save.state.turn} · ${new Date(save.savedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}>
            ПРОДОЛЖИТЬ ИГРУ
          </GameButton>
        )}
        <GameButton color="green" size="lg" icon="robot" block pulse={!save} onClick={() => go('setup')} sub="Без интернета, до 7 ботов">
          ИГРАТЬ С БОТАМИ
        </GameButton>
        <GameButton color="blue" size="lg" icon="wifi" block onClick={createRoom} disabled={busy} sub={busy ? 'Подключение к серверу…' : STATIC_SITE ? 'Нужен сервер на компьютере' : 'Друзья в одной Wi-Fi сети'}>
          СОЗДАТЬ WI-FI КОМНАТУ
        </GameButton>
        <GameButton color="purple" size="lg" icon="join" block onClick={() => (STATIC_SITE ? setWifiHelp(true) : go('join'))} sub={STATIC_SITE ? 'Нужен сервер на компьютере' : 'По коду, списку или QR-коду'}>
          ПРИСОЕДИНИТЬСЯ К КОМНАТЕ
        </GameButton>
        <div className="row">
          <GameButton color="gray" icon="gear" onClick={() => go('settings')}>
            НАСТРОЙКИ
          </GameButton>
          <GameButton color="gold" icon="book" onClick={() => go('rules')}>
            ПРАВИЛА
          </GameButton>
        </div>
      </div>

      <div className="menu-corner" style={{ left: '1rem', bottom: 'calc(1rem + var(--safe-b))' }}>
        <button className="profile-card" onClick={() => go('profile')}>
          <Avatar id={profile.avatar} color={profile.color} size={2.8} />
          <div>
            <div className="title-font" style={{ fontSize: '1.05rem' }}>{profile.name}</div>
            <div className="small muted">Изменить профиль</div>
          </div>
          <TokenImg token={profile.token} color={profile.color} size={2.6} />
        </button>
      </div>

      <div className="menu-corner" style={{ right: '1rem', bottom: 'calc(1rem + var(--safe-b))' }}>
        <GameButton round color="teal" icon="trophy" title="Рекорды и статистика" onClick={() => go('records')} />
        <GameButton round color="pink" icon="edit" title="Редактор поля" onClick={() => go('editor')} />
        <GameButton round color="dark" icon="upload" title="Загрузить партию из файла" onClick={loadFile} />
        <GameButton round color="dark" icon="fullscreen" title="Полный экран" onClick={toggleFullscreen} />
      </div>
      {wifiHelp && <WifiHelp onClose={() => setWifiHelp(false)} />}
    </div>
  );
}

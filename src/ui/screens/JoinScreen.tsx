import { useEffect, useState } from 'react';
import { useStore, store } from '../../store';
import { GameButton, Window } from '../kit';
import { net } from '../../net/netClient';
import { QR, shareUrl } from '../QR';
import { Icon } from '../Icon';

export function JoinScreen() {
  const go = useStore((s) => s.go);
  const rooms = useStore((s) => s.rooms);
  const netState = useStore((s) => s.net);
  const [code, setCode] = useState('');
  const [addr, setAddr] = useState(net.serverAddress);

  useEffect(() => {
    net.connect().catch(() => {});
  }, []);

  const join = (c: string) => {
    if (!c.trim()) return;
    net.connect()
      .then(() => net.joinRoom(c.trim().toUpperCase()))
      .catch((e) => store().toast(e.message, 'error'));
  };

  const create = () => {
    net.connect()
      .then(() => net.createRoom({ ...store().setupSettings, roomName: `Комната ${store().profile.name}` }))
      .catch((e) => store().toast(e.message, 'error'));
  };

  const reconnect = () => {
    net.disconnect();
    net.serverAddress = addr;
    net.connect().catch(() => {});
  };

  const online = netState.status === 'online';
  const url = shareUrl(netState.info?.urls);
  const lobbyRooms = rooms.filter((r) => r.status === 'lobby' && !r.hasSeatFor);
  const myRooms = rooms.filter((r) => r.hasSeatFor);

  return (
    <div className="screen">
      <div className="screen-header">
        <GameButton
          round
          color="purple"
          icon="back"
          onClick={() => {
            net.disconnect();
            go('menu');
          }}
        />
        <div className="screen-title">ИГРА ПО WI-FI</div>
        <span className={`tag ${online ? 'green' : netState.status === 'error' ? 'red' : 'gray'}`} style={{ fontSize: '0.85rem' }}>
          <Icon name="wifi" />
          {online ? 'Сервер подключён' : netState.status === 'error' ? 'Нет связи' : 'Подключение…'}
        </span>
      </div>
      <div className="screen-body">
        <Window title="Комнаты в сети" style={{ flex: 1.2 }}>
          <div className="modal-body" style={{ flex: 1 }}>
            {!online && netState.status === 'error' && (
              <div className="inner" style={{ marginBottom: '0.8rem' }}>
                <div className="title-font" style={{ color: '#ff8a8a', marginBottom: '0.4rem' }}>Сервер не найден</div>
                <div className="hint" style={{ marginBottom: '0.6rem' }}>
                  {netState.error}
                  <br />
                  Запустите на компьютере файл «Запустить игру» (или <code>npm start</code>) и откройте на этом устройстве адрес, который покажет сервер.
                </div>
                <div className="label">Адрес сервера (IP:порт)</div>
                <div className="row">
                  <input className="g-input" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="192.168.1.10:8080" />
                  <GameButton color="blue" icon="refresh" onClick={reconnect}>
                    СВЯЗАТЬСЯ
                  </GameButton>
                </div>
              </div>
            )}
            {myRooms.map((r) => (
              <div key={r.id} className="setting-row" style={{ boxShadow: 'inset 0 0 0 0.15rem #ffd23f' }}>
                <Icon name="refresh" />
                <div className="setting-row__text">
                  <div className="setting-row__title">{r.name} — ваша партия</div>
                  <div className="setting-row__desc">{r.status === 'playing' ? 'Партия идёт — можно вернуться' : 'Вы в этой комнате'}</div>
                </div>
                <GameButton color="orange" onClick={() => join(r.code)}>
                  ВЕРНУТЬСЯ
                </GameButton>
              </div>
            ))}
            {online && lobbyRooms.length === 0 && (
              <div className="inner" style={{ textAlign: 'center', padding: '1.5rem' }}>
                <Icon name="wifi" size="3.5rem" />
                <div className="title-font" style={{ margin: '0.5rem 0' }}>Пока нет открытых комнат</div>
                <div className="hint">Создайте свою — друзья увидят её здесь или войдут по коду.</div>
              </div>
            )}
            {lobbyRooms.map((r) => (
              <div key={r.id} className="setting-row">
                <Icon name="users" />
                <div className="setting-row__text">
                  <div className="setting-row__title">{r.name}</div>
                  <div className="setting-row__desc">
                    Хозяин: {r.hostName} · {r.boardName} · игроков {r.players}/{r.maxPlayers} · код {r.code}
                  </div>
                </div>
                <GameButton color="green" icon="join" onClick={() => join(r.code)}>
                  ВОЙТИ
                </GameButton>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: '0.8rem' }}>
            <GameButton color="blue" size="lg" icon="plus" block center disabled={!online} onClick={create}>
              СОЗДАТЬ КОМНАТУ
            </GameButton>
          </div>
        </Window>
        <div className="col" style={{ flex: 1, minWidth: 0, gap: '1.8rem' }}>
          <Window title="Вход по коду">
            <div className="row">
              <input className="g-input code" value={code} maxLength={4} placeholder="КОД" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && join(code)} />
              <GameButton color="green" size="lg" icon="play" disabled={code.length < 4 || !online} onClick={() => join(code)}>
                ВОЙТИ
              </GameButton>
            </div>
          </Window>
          <Window title="Подключить телефоны">
            <div className="row" style={{ alignItems: 'flex-start', gap: '1rem' }}>
              <QR text={url} size={8.5} />
              <div className="grow">
                <div className="hint" style={{ marginBottom: '0.4rem' }}>Наведите камеру телефона на QR-код или откройте в браузере:</div>
                <div className="title-font" style={{ fontSize: '1.05rem', wordBreak: 'break-all', color: '#ffe259' }}>{url}</div>
                {netState.info && netState.info.urls.length > 1 && <div className="hint" style={{ marginTop: '0.3rem' }}>Другие адреса: {netState.info.urls.slice(1).join(', ')}</div>}
                <div className="hint" style={{ marginTop: '0.5rem' }}>
                  Браузер не умеет сам искать устройства в сети, поэтому все подключаются к серверу на компьютере — по этому адресу. Интернет не нужен, достаточно общей Wi-Fi сети.
                </div>
              </div>
            </div>
          </Window>
        </div>
      </div>
    </div>
  );
}

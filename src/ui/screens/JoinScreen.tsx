import { useCallback, useEffect, useState } from 'react';
import { useStore, store } from '../../store';
import { GameButton, Modal, Window } from '../kit';
import { net } from '../../net/netClient';
import { QR, shareUrl } from '../QR';
import { Icon } from '../Icon';
import { QRScanner } from '../QRScanner';
import { P2P, joinByCode, joinOffline, parseScanned, createWifiRoom } from '../../net/wifi';

export function JoinScreen() {
  const go = useStore((s) => s.go);
  const rooms = useStore((s) => s.rooms);
  const netState = useStore((s) => s.net);
  const [code, setCode] = useState('');
  const [addr, setAddr] = useState(net.serverAddress);
  const [scan, setScan] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!P2P) net.connect().catch(() => {});
  }, []);

  const join = async (c: string) => {
    if (!c.trim()) return;
    setBusy(true);
    try {
      await joinByCode(c);
    } catch (e) {
      store().toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const onScanned = useCallback(async (text: string) => {
    setScan(false);
    const r = parseScanned(text);
    if (!r) {
      store().toast('Это не QR-код комнаты «Капиталиста»', 'error');
      return;
    }
    if (r.kind === 'code') {
      setCode(r.code);
      void join(r.code);
      return;
    }
    try {
      setBusy(true);
      await joinOffline(r.text, (a) => setAnswer(a));
    } catch (e) {
      setAnswer(null);
      store().toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = () => {
    setBusy(true);
    createWifiRoom()
      .catch((e) => store().toast(e.message, 'error'))
      .finally(() => setBusy(false));
  };

  const reconnect = () => {
    net.disconnect();
    net.serverAddress = addr;
    net.useServer();
    net.connect().catch(() => {});
  };

  const back = () => {
    net.disconnect();
    go('menu');
  };

  const online = netState.status === 'online';
  const connecting = busy || netState.status === 'connecting' || netState.status === 'reconnecting';

  // ───── Онлайн-версия: без сервера, хозяин — браузер ─────
  if (P2P) {
    return (
      <div className="screen">
        <div className="screen-header">
          <GameButton round color="purple" icon="back" onClick={back} />
          <div className="screen-title">ИГРА ПО WI-FI</div>
        </div>
        <div className="screen-body">
          <Window title="Войти в комнату" style={{ flex: 1 }}>
            <div className="col">
              <div className="hint">Введите код, который видно в лобби у хозяина комнаты, или отсканируйте его QR-код.</div>
              <div className="row">
                <input className="g-input code" value={code} maxLength={4} placeholder="КОД" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && join(code)} />
              </div>
              <div className="actions-grid">
                <GameButton span color="green" size="lg" icon="play" disabled={code.length < 4 || connecting} onClick={() => join(code)} sub={connecting ? 'ищем комнату — до 20 секунд…' : undefined}>
                  ВОЙТИ
                </GameButton>
                <GameButton span color="blue" size="lg" icon="qr" onClick={() => setScan(true)}>
                  СКАНИРОВАТЬ QR-КОД
                </GameButton>
              </div>
              {netState.status === 'error' && netState.error && <div className="tag red" style={{ whiteSpace: 'normal' }}>{netState.error}</div>}
            </div>
          </Window>
          <Window title="Как это работает" style={{ flex: 1 }}>
            <div className="col">
              <div className="setting-row">
                <Icon name="wifi" />
                <div className="setting-row__text">
                  <div className="setting-row__title">Все в одной Wi-Fi сети</div>
                  <div className="setting-row__desc">Хозяин комнаты — тот, кто её создал: его телефон или компьютер ведёт партию. Остальные подключаются к нему напрямую.</div>
                </div>
              </div>
              <div className="setting-row">
                <Icon name="qr" />
                <div className="setting-row__title" style={{ flex: 1 }}>
                  По коду или QR-коду
                  <div className="setting-row__desc">Интернет нужен только на несколько секунд, чтобы устройства нашли друг друга. Игра идёт напрямую по Wi-Fi.</div>
                </div>
              </div>
              <div className="setting-row">
                <Icon name="lock" />
                <div className="setting-row__title" style={{ flex: 1 }}>
                  Совсем без интернета
                  <div className="setting-row__desc">Хозяин в лобби нажимает «Без интернета» и показывает QR. Отсканируйте его, затем покажите хозяину свой ответный QR.</div>
                </div>
              </div>
              <GameButton color="purple" icon="plus" block center disabled={connecting} onClick={create}>
                СОЗДАТЬ СВОЮ КОМНАТУ
              </GameButton>
            </div>
          </Window>
        </div>
        {scan && <QRScanner title="Сканирование" hint="Наведите камеру на QR-код из лобби хозяина" onResult={onScanned} onClose={() => setScan(false)} />}
        {answer && (
          <Modal title="Покажите хозяину" onClose={() => setAnswer(null)} width="min(26rem, 94vw)">
            <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
              <div className="hint">Хозяин нажимает «Сканировать ответ» и наводит камеру на этот QR-код. После этого вы окажетесь в комнате.</div>
              <QR text={answer} size={17} />
              <GameButton
                color="dark"
                size="sm"
                icon="copy"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(answer);
                    store().toast('Код скопирован', 'success');
                  } catch {
                    store().toast('Не удалось скопировать', 'error');
                  }
                }}
              >
                СКОПИРОВАТЬ КОД
              </GameButton>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ───── Версия с локального сервера на компьютере ─────
  const url = shareUrl(netState.info?.urls);
  const lobbyRooms = rooms.filter((r) => r.status === 'lobby' && !r.hasSeatFor);
  const myRooms = rooms.filter((r) => r.hasSeatFor);

  return (
    <div className="screen">
      <div className="screen-header">
        <GameButton round color="purple" icon="back" onClick={back} />
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
                <div className="hint" style={{ marginTop: '0.5rem' }}>Браузер не умеет сам искать устройства в сети, поэтому все подключаются к серверу на компьютере — по этому адресу. Интернет не нужен, достаточно общей Wi-Fi сети.</div>
              </div>
            </div>
          </Window>
        </div>
      </div>
    </div>
  );
}

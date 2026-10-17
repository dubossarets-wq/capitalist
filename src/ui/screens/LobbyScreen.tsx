import { useCallback, useEffect, useState } from 'react';
import type { BotLevel } from '../../../shared/types';
import { TOKENS } from '../../../shared/settings';
import { useStore, store } from '../../store';
import { GameButton, Modal, Segmented, Window } from '../kit';
import { Avatar, TokenImg } from '../Avatar';
import { RoomConfig } from '../RoomConfig';
import { net } from '../../net/netClient';
import { QR, shareUrl } from '../QR';
import { Icon } from '../Icon';
import { QRScanner } from '../QRScanner';
import { leaveWifi, P2P } from '../../net/wifi';
import { getHost } from '../../net/p2p';
import { LEVEL_NAMES } from './SetupScreen';
import { ProfileEditor } from './ProfileScreen';

export function LobbyScreen() {
  const room = useStore((s) => s.room);
  const netState = useStore((s) => s.net);
  const [editProfile, setEditProfile] = useState(false);
  const [draft, setDraft] = useState(store().profile);
  const [addLevel, setAddLevel] = useState<BotLevel>('medium');
  const [offline, setOffline] = useState(false);
  if (!room) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <div className="title-font">Подключение к комнате…</div>
      </div>
    );
  }
  const me = room.seats.find((s) => s.id === room.mySeatId);
  const isHost = room.hostId === netState.clientId;
  const allReady = room.seats.every((s) => s.isBot || s.isHost || s.ready);
  const canStart = isHost && room.seats.length >= 2 && allReady;
  const url = shareUrl(netState.info?.urls, room.code);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      store().toast('Ссылка скопирована', 'success');
    } catch {
      store().toast(url, 'info');
    }
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <GameButton round color="red" icon="exit" title="Выйти из комнаты" onClick={leaveWifi} />
        <div className="screen-title">{room.settings.roomName}</div>
        <div className="room-code" title="Код комнаты">{room.code}</div>
        <GameButton round size="sm" color="purple" icon="copy" title="Скопировать ссылку" onClick={copy} />
      </div>
      <div className="screen-body">
        <Window title={`Игроки: ${room.seats.length} / ${room.settings.maxPlayers}`} style={{ flex: '0 0 27rem', maxWidth: '100%' }}>
          <div className="modal-body" style={{ flex: 1 }}>
            {room.seats.map((seat, i) => (
              <div key={seat.id} className="seat-card" style={{ ['--c' as any]: seat.profile.color, opacity: seat.connected ? 1 : 0.55 }}>
                <Avatar id={seat.profile.avatar} color={seat.profile.color} size={2.8} bot={seat.isBot} />
                <div className="grow">
                  <div className="seat-card__name">
                    {seat.isHost && <Icon name="crown" size="1.1rem" />} {seat.profile.name}
                  </div>
                  <div className="seat-card__meta">
                    {seat.isBot ? (
                      <span className="tag blue">
                        <Icon name="robot" /> БОТ · {LEVEL_NAMES[seat.botLevel]}
                      </span>
                    ) : (
                      <>
                        <span className="tag gray">
                          <Icon name="user" /> ЧЕЛОВЕК
                        </span>
                        {seat.isHost ? (
                          <span className="tag gold">ХОЗЯИН</span>
                        ) : seat.ready ? (
                          <span className="tag green">
                            <Icon name="check" /> ГОТОВ
                          </span>
                        ) : (
                          <span className="tag red">НЕ ГОТОВ</span>
                        )}
                        {!seat.connected && <span className="tag red">НЕТ СВЯЗИ</span>}
                        {seat.id === room.mySeatId && <span className="tag gold">ВЫ</span>}
                      </>
                    )}
                    <span>{TOKENS.find((t) => t.id === seat.profile.token)?.name}</span>
                  </div>
                </div>
                <TokenImg token={seat.profile.token} color={seat.profile.color} size={2.8} />
                {seat.id === room.mySeatId && (
                  <GameButton
                    round
                    size="sm"
                    color="purple"
                    icon="edit"
                    title="Фишка, цвет, аватар"
                    onClick={() => {
                      setDraft(seat.profile);
                      setEditProfile(true);
                    }}
                  />
                )}
                {isHost && (
                  <div className="col" style={{ gap: '0.35rem' }}>
                    <button className="chip-btn" disabled={i === 0} onClick={() => net.send({ t: 'moveSeat', seatId: seat.id, dir: -1 })} title="Выше">
                      ▲
                    </button>
                    <button className="chip-btn" disabled={i === room.seats.length - 1} onClick={() => net.send({ t: 'moveSeat', seatId: seat.id, dir: 1 })} title="Ниже">
                      ▼
                    </button>
                  </div>
                )}
                {isHost && !seat.isHost && <GameButton round size="sm" color="red" icon="close" title="Убрать" onClick={() => net.send({ t: 'removeSeat', seatId: seat.id })} />}
                {seat.isBot && isHost && (
                  <div className="seat-card__full">
                    <Segmented stretch value={seat.botLevel} onChange={(lv) => net.send({ t: 'setBotLevel', seatId: seat.id, level: lv })} options={(['easy', 'medium', 'hard'] as BotLevel[]).map((lv) => ({ value: lv, label: LEVEL_NAMES[lv] }))} />
                  </div>
                )}
              </div>
            ))}
            {room.seats.length < room.settings.maxPlayers &&
              Array.from({ length: room.settings.maxPlayers - room.seats.length }).map((_, k) => (
                <div key={k} className="empty-seat">
                  {k === 0 && isHost ? (
                    <div className="col" style={{ alignItems: 'center' }}>
                      <div>Свободное место — ждём друзей или добавьте бота</div>
                      <Segmented stretch value={addLevel} onChange={setAddLevel} options={(['easy', 'medium', 'hard'] as BotLevel[]).map((lv) => ({ value: lv, label: LEVEL_NAMES[lv] }))} />
                      <GameButton size="sm" color="green" icon="robot" onClick={() => net.send({ t: 'addBot', level: addLevel })}>
                        ДОБАВИТЬ БОТА
                      </GameButton>
                    </div>
                  ) : (
                    'Свободное место'
                  )}
                </div>
              ))}
          </div>
        </Window>
        <Window title="Настройки партии" style={{ flex: 1, minWidth: 0 }}>
          <RoomConfig
            settings={room.settings}
            network
            readOnly={!isHost}
            seatsCount={room.seats.length}
            onChange={(s) => {
              net.send({ t: 'updateSettings', settings: s });
              store().set({ setupSettings: s });
            }}
          />
        </Window>
      </div>
      <div className="screen-footer" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: '0.8rem' }}>
          <QR text={url} size={5.5} />
          <div>
            <div className="hint">{P2P ? 'Друзья в той же Wi-Fi сети: камерой на QR-код или кодом' : 'Друзья в той же Wi-Fi сети: QR-код или адрес'}</div>
            {P2P ? (
              <div className="title-font" style={{ color: '#ffe259', fontSize: '1.3rem', letterSpacing: '0.2em' }}>{room.code}</div>
            ) : (
              <>
                <div className="title-font" style={{ color: '#ffe259', wordBreak: 'break-all' }}>{url}</div>
                <div className="hint">и код комнаты <b className="title-font">{room.code}</b></div>
              </>
            )}
            {P2P && isHost && (
              <button className="chip-btn" style={{ marginTop: '0.4rem' }} onClick={() => setOffline(true)}>
                Без интернета
              </button>
            )}
          </div>
        </div>
        <div className="row">
          {!isHost && me && (
            <GameButton color={me.ready ? 'gray' : 'green'} size="xl" icon={me.ready ? 'close' : 'check'} pulse={!me.ready} onClick={() => net.send({ t: 'ready', ready: !me.ready })}>
              {me.ready ? 'НЕ ГОТОВ' : 'ГОТОВ'}
            </GameButton>
          )}
          {isHost && (
            <GameButton color="green" size="xl" icon="dice" pulse={canStart} disabled={!canStart} onClick={() => net.send({ t: 'startGame' })} sub={!allReady ? 'Ждём готовности игроков' : room.seats.length < 2 ? 'Нужно минимум 2 участника' : undefined}>
              НАЧАТЬ ИГРУ
            </GameButton>
          )}
        </div>
      </div>
      {offline && <OfflineInvite onClose={() => setOffline(false)} />}
      {editProfile && (
        <Modal title="Мой образ" onClose={() => setEditProfile(false)} width="44rem">
          <ProfileEditor
            profile={draft}
            onChange={setDraft}
            takenColors={room.seats.filter((s) => s.id !== room.mySeatId).map((s) => s.profile.color)}
            takenTokens={room.seats.filter((s) => s.id !== room.mySeatId).map((s) => s.profile.token)}
          />
          <div className="row center-x" style={{ marginTop: '1rem' }}>
            <GameButton
              color="green"
              size="lg"
              icon="check"
              onClick={() => {
                net.send({ t: 'updateProfile', profile: draft });
                store().setProfile(draft);
                setEditProfile(false);
              }}
            >
              ПРИМЕНИТЬ
            </GameButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Хозяин подключает гостя без интернета: показывает свой QR, затем сканирует ответный QR гостя */
function OfflineInvite({ onClose }: { onClose: () => void }) {
  const [invite, setInvite] = useState<{ code: string; accept: (a: string) => Promise<void>; close: () => void } | null>(null);
  const [scan, setScan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;
    setInvite(null);
    setError(null);
    getHost()
      .offlineInvite()
      .then((inv) => (alive ? setInvite(inv) : inv.close()))
      .catch(() => setError('Этот браузер не поддерживает прямое подключение (WebRTC)'));
    return () => {
      alive = false;
    };
  }, [round]);

  const onAnswer = useCallback(
    async (text: string) => {
      setScan(false);
      if (!invite) return;
      try {
        await invite.accept(text.trim());
        store().toast('Гость подключается…', 'success');
        setRound((r) => r + 1); // следующий гость — новый QR
      } catch (e) {
        store().toast((e as Error).message || 'Не удалось прочитать ответ гостя', 'error');
      }
    },
    [invite],
  );

  return (
    <Modal title="Без интернета" onClose={onClose} width="min(28rem, 94vw)">
      <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="hint">1. Гость: «Присоединиться» → «Сканировать QR» и наводит камеру на этот код.</div>
        {invite ? <QR text={invite.code} size={17} /> : <div className="spinner" />}
        {error && <div className="tag red" style={{ whiteSpace: 'normal' }}>{error}</div>}
        <div className="hint">2. На экране гостя появится ответный QR — отсканируйте его.</div>
        <div className="actions-grid">
          <GameButton span color="green" size="lg" icon="qr" disabled={!invite} onClick={() => setScan(true)}>
            СКАНИРОВАТЬ ОТВЕТ
          </GameButton>
          <GameButton
            color="dark"
            size="sm"
            icon="copy"
            disabled={!invite}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(invite!.code);
                store().toast('Код скопирован', 'success');
              } catch {
                store().toast('Не удалось скопировать', 'error');
              }
            }}
          >
            КОПИРОВАТЬ
          </GameButton>
          <GameButton color="dark" size="sm" icon="refresh" onClick={() => setRound((r) => r + 1)}>
            НОВЫЙ QR
          </GameButton>
        </div>
      </div>
      {scan && <QRScanner title="Ответ гостя" hint="Наведите камеру на QR-код на экране гостя" onResult={onAnswer} onClose={() => setScan(false)} />}
    </Modal>
  );
}

// Комнаты локальной сети на сервере: ядро комнат + сохранение в файл.
import fs from 'node:fs';
import path from 'node:path';
import type { ServerInfo } from '../shared/protocol';
import { RoomCore } from '../shared/roomCore';

export class RoomManager extends RoomCore {
  constructor(saveDir: string, info: () => ServerInfo) {
    const file = path.join(saveDir, 'rooms.json');
    super(
      {
        read: () => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null),
        write: (json) => {
          fs.mkdirSync(saveDir, { recursive: true });
          fs.writeFileSync(file + '.tmp', json);
          fs.renameSync(file + '.tmp', file);
        },
      },
      info,
      { tickMs: Number(process.env.TICK_MS) || 200, graceMs: Number(process.env.DISCONNECT_GRACE_MS) || 40000 },
    );
  }
}

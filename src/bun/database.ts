import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export class DatabaseManager {
  private readonly db: Database

  constructor() {
    const dbPath = join(this.userDataPath(), 'rayna.db')
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath)
    this.init()
  }

  get(key: string): unknown {
    const row = this.db.query('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined

    return row ? JSON.parse(row.value) : null
  }

  set(key: string, value: unknown): void {
    this.db
      .query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(key, JSON.stringify(value))
  }

  private init(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS playback_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id TEXT,
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
  }

  private userDataPath(): string {
    const id = 'com.ib.rayna'

    if (process.platform === 'darwin') {
      return join(homedir(), 'Library', 'Application Support', id)
    }

    if (process.platform === 'win32') {
      return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), id)
    }

    return join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), id)
  }
}

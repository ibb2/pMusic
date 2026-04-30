import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export class JsonStore {
  private readonly path: string
  private data: Record<string, unknown> = {}

  constructor(filename = 'settings.json') {
    this.path = join(this.userDataPath(), filename)
    this.load()
  }

  get<T>(key: string): T | undefined {
    return this.data[key] as T | undefined
  }

  set(key: string, value: unknown): void {
    this.data[key] = value
    this.save()
  }

  delete(key: string): void {
    delete this.data[key]
    this.save()
  }

  private userDataPath(): string {
    const id = 'com.ib.rayna'
    const platform = process.platform

    if (platform === 'darwin') {
      return join(homedir(), 'Library', 'Application Support', id)
    }

    if (platform === 'win32') {
      return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), id)
    }

    return join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), id)
  }

  private load(): void {
    try {
      this.data = JSON.parse(readFileSync(this.path, 'utf8')) as Record<string, unknown>
    } catch {
      this.data = {}
    }
  }

  private save(): void {
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(this.path, JSON.stringify(this.data, null, 2))
  }
}

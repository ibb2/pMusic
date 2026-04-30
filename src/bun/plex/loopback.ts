import http from 'node:http'

export class LoopbackAuthServer {
  private server: http.Server | null = null
  public onRedirect: (() => void) | null = null

  constructor() {
    this.server = http.createServer((req, res) => this.handleRequest(req, res))
  }

  listen(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        reject(new Error('Server not initialized'))
        return
      }

      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server?.address()
        if (address && typeof address !== 'string') {
          resolve(address.port)
          return
        }
        reject(new Error('Failed to get loopback server port'))
      })

      this.server.on('error', reject)
    })
  }

  close(): void {
    this.server?.close()
    this.server = null
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (!req.url?.startsWith('/callback')) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }

    this.onRedirect?.()
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`
      <!doctype html>
      <html>
        <head>
          <title>Authenticated</title>
          <style>
            body { background: #111; color: #fff; font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; }
            main { text-align: center; }
          </style>
        </head>
        <body>
          <main>
            <h1>Authentication Successful</h1>
            <p>You can close this browser window.</p>
          </main>
          <script>
            window.location.href = 'rayna://auth-callback';
            setTimeout(() => window.close(), 1000);
          </script>
        </body>
      </html>
    `)
  }
}

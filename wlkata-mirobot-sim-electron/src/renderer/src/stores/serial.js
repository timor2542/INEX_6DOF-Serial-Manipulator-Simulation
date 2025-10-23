import { defineStore } from 'pinia'

/**
 * Web Serial helper (CH340 only).
 * CH340 vendorId: 0x1A86 (QinHeng). ProductId varies (e.g. 0x7523).
 */
const CH340_FILTERS = [{ usbVendorId: 0x1a86 }]

export const useSerialStore = defineStore('serial', {
  state: () => ({
    port: null,
    reader: null,
    writer: null,
    connected: false,
    baud: 115200,
    portInfo: null,
    logs: []
  }),
  actions: {
    logJog(i, fromDeg, toDeg) {
      this.appendLog({
        dir: 'sys',
        text: `Jog q${i + 1}: ${fromDeg}° -> ${toDeg}°`,
        ts: Date.now()
      })
    },
    appendLog(entry) {
      // entry: {dir:'in'|'out'|'sys', text:string, ts:number}
      this.logs.push(entry)
      if (this.logs.length > 2000) this.logs.shift()
    },
    clearLogs() {
      this.logs = []
    },

    async listCH340Ports() {
      if (!('serial' in navigator)) {
        this.appendLog({ dir: 'sys', text: 'Web Serial not supported.', ts: Date.now() })
        return []
      }
      const ports = await navigator.serial.getPorts()
      const list = []
      for (const p of ports) {
        const info = p.getInfo()
        if (info.usbVendorId === 0x1a86) {
          list.push({
            id: await idOf(p),
            label: `CH340 (${hex(info.usbVendorId)}:${hex(info.usbProductId)})`
          })
        }
      }
      return list
    },

    async connect({ portId, baudRate }) {
      try {
        let port = null
        if (portId) {
          // find from existing ports
          for (const p of await navigator.serial.getPorts()) {
            if ((await idOf(p)) === portId) {
              port = p
              break
            }
          }
        }
        if (!port) {
          port = await navigator.serial.requestPort({ filters: CH340_FILTERS })
        }
        await port.open({ baudRate })
        this.port = port
        this.baud = baudRate
        this.portInfo = port.getInfo()
        this.connected = true
        this.appendLog({
          dir: 'sys',
          text: `Connected: CH340 (${hex(this.portInfo.usbVendorId)}:${hex(this.portInfo.usbProductId)}) @${baudRate}`,
          ts: Date.now()
        })

        // Make writer/reader
        this.writer = this.port.writable?.getWriter() || null
        this.readLoop()
        // Disconnect detection
        this.port.ondisconnect = () => {
          this.appendLog({ dir: 'sys', text: 'Device disconnected.', ts: Date.now() })
          this.disconnect()
        }
      } catch (e) {
        this.appendLog({ dir: 'sys', text: `Connect error: ${e.message}`, ts: Date.now() })
      }
    },

    async disconnect() {
      try {
        if (this.reader) {
          try {
            await this.reader.cancel()
          } catch {}
          try {
            this.reader.releaseLock()
          } catch {}
        }
        if (this.writer) {
          try {
            this.writer.releaseLock()
          } catch {}
        }
        if (this.port?.readable)
          try {
            await this.port.close()
          } catch {}
      } catch {}
      this.reader = null
      this.writer = null
      this.port = null
      this.connected = false
    },

    async readLoop() {
      try {
        if (!this.port?.readable) return
        const reader = this.port.readable.getReader()
        this.reader = reader
        const decoder = new TextDecoder()
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          if (value) {
            const text = decoder.decode(value)
            this.appendLog({ dir: 'in', text, ts: Date.now() })
          }
        }
      } catch (e) {
        this.appendLog({ dir: 'sys', text: `Read stopped: ${e.message}`, ts: Date.now() })
      } finally {
        try {
          this.reader?.releaseLock()
        } catch {}
        this.reader = null
      }
    },

    async send(data /* Uint8Array */) {
      if (!this.connected || !this.writer) {
        this.appendLog({ dir: 'sys', text: 'Not connected.', ts: Date.now() })
        return
      }
      try {
        await this.writer.write(data)
        // Mirror to console (string preview)
        let preview = ''
        try {
          preview = new TextDecoder().decode(data)
        } catch {}
        this.appendLog({ dir: 'out', text: preview || `[${data.length} bytes]`, ts: Date.now() })
      } catch (e) {
        this.appendLog({ dir: 'sys', text: `Write error: ${e.message}`, ts: Date.now() })
      }
    },

    async sendString(str) {
      const enc = new TextEncoder()
      await this.send(enc.encode(str))
    }
  }
})

function hex(n) {
  if (typeof n !== 'number') return '0x????'
  return '0x' + n.toString(16).padStart(4, '0')
}

async function idOf(port) {
  const i = port.getInfo()
  // Use vendor:product as id plus a random fallback
  return `${hex(i.usbVendorId)}:${hex(i.usbProductId)}`
}

/**
 * Convert outgoing text into Uint8Array for modes: string | hex | bin
 */
export function encodeOutgoing(text, mode = 'string') {
    if (mode === 'hex') {
        // Allow formats like: "47 30 0A" or "0x47,0x30,0x0A"
        const bytes = []
        const cleaned = text.replace(/0x/gi, ' ').replace(/[,;]/g, ' ')
        cleaned.trim().split(/\s+/).forEach(tok => {
            if (!tok) return
            const v = parseInt(tok, 16)
            if (!Number.isNaN(v)) bytes.push(v & 0xFF)
        })
        return new Uint8Array(bytes)
    } else if (mode === 'bin') {
        // "0100 0001 0000 1010" -> bytes
        const bytes = []
        const cleaned = text.replace(/[,;]/g, ' ')
        cleaned.trim().split(/\s+/).forEach(tok => {
            if (!tok) return
            const v = parseInt(tok, 2)
            if (!Number.isNaN(v)) bytes.push(v & 0xFF)
        })
        return new Uint8Array(bytes)
    } else {
        // string
        const enc = new TextEncoder()
        // auto newline if missing
        const t = text.endsWith('\n') ? text : text + '\n'
        return enc.encode(t)
    }
}

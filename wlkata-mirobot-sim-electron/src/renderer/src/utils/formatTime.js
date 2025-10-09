export function formatTime(d) {
    const pad = (n) => String(n).padStart(2, '0')
    const Y = d.getFullYear()
    const M = pad(d.getMonth() + 1)
    const D = pad(d.getDate())
    const h = pad(d.getHours())
    const m = pad(d.getMinutes())
    const s = pad(d.getSeconds())
    return `Current DateTime: ${Y}-${M}-${D} ${h}:${m}:${s}`
}

// Impressão direta via Bluetooth quando o sistema roda dentro do app Android.
import { Capacitor } from '@capacitor/core'
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial'

const CHAVE = 'impressora-bt'

export const ehApp = () => Capacitor.isNativePlatform()

export function impressoraSalva() {
  try { return JSON.parse(localStorage.getItem(CHAVE)) } catch { return null }
}
export function salvarImpressora(dev) {
  try { localStorage.setItem(CHAVE, JSON.stringify({ address: dev.address, name: dev.name || 'Impressora' })) } catch { /* sem armazenamento */ }
}

export async function procurarImpressoras() {
  const st = await BluetoothSerial.enable()
  if (!st.enabled) throw new Error('Ative o Bluetooth do celular')
  const r = await BluetoothSerial.scan()
  return (r.devices || []).filter((d) => d.address)
}

let conectadoEm = null
async function garantirConexao(address) {
  try {
    const c = await BluetoothSerial.isConnected({ address })
    if (c.connected) return
  } catch { /* segue para conectar */ }
  try { await BluetoothSerial.connect({ address }) }
  catch { await BluetoothSerial.connectInsecure({ address }) }
  conectadoEm = address
}

// envia em pedaços para impressoras com buffer pequeno
export async function imprimirBluetooth(conteudo) {
  const imp = impressoraSalva()
  if (!imp) throw new Error('SEM_IMPRESSORA')
  const st = await BluetoothSerial.enable()
  if (!st.enabled) throw new Error('Ative o Bluetooth do celular')
  await garantirConexao(imp.address)
  const TAM = 512
  for (let i = 0; i < conteudo.length; i += TAM) {
    try {
      await BluetoothSerial.write({ address: imp.address, value: conteudo.slice(i, i + TAM) })
    } catch (e) {
      if (i === 0 && conectadoEm) { // conexão caiu: reconecta uma vez
        conectadoEm = null
        await BluetoothSerial.disconnect({ address: imp.address }).catch(() => {})
        await garantirConexao(imp.address)
        await BluetoothSerial.write({ address: imp.address, value: conteudo.slice(i, i + TAM) })
      } else throw e
    }
    await new Promise((r) => setTimeout(r, 40))
  }
}

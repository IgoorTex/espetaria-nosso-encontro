// Impressão em impressora térmica Bluetooth.
// Dentro do app Android: direto pelo Bluetooth. No navegador: via app RawBT.
import { ehApp, imprimirBluetooth } from './impressora'

const LARGURA = 32 // caracteres por linha numa bobina de 58mm

const semAcento = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')

const ESC = '\x1B'
const GS = '\x1D'
const INIT = ESC + '@'
const CENTRO = ESC + 'a\x01'
const ESQUERDA = ESC + 'a\x00'
const NEGRITO_ON = ESC + 'E\x01'
const NEGRITO_OFF = ESC + 'E\x00'
const GRANDE = GS + '!\x11' // dobro largura + altura
const ALTO = GS + '!\x01' // dobro altura
const NORMAL = GS + '!\x00'
const AVANCO = '\n\n\n\n'
const CORTE = GS + 'V\x01'

const linha = (c = '-') => c.repeat(LARGURA) + '\n'
const ladoALado = (a, b, w = LARGURA) => {
  a = semAcento(a); b = semAcento(b)
  const esp = Math.max(1, w - a.length - b.length)
  return a + ' '.repeat(esp) + b + '\n'
}
const quebrar = (txt, w) => {
  const palavras = semAcento(txt).split(' ')
  const out = []; let atual = ''
  for (const p of palavras) {
    if ((atual + ' ' + p).trim().length > w) { if (atual) out.push(atual); atual = p } else atual = (atual + ' ' + p).trim()
  }
  if (atual) out.push(atual)
  return out
}

export function montarNotinha({ comanda, pedidoId, criadoEm, itens, reimpressao }) {
  const d = new Date(criadoEm || Date.now())
  const dt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  let s = INIT + CENTRO + NEGRITO_ON + 'NOSSO ENCONTRO\n' + NEGRITO_OFF
  s += '- PEDIDO COZINHA -\n'
  if (reimpressao) s += NEGRITO_ON + '*** REIMPRESSAO ***\n' + NEGRITO_OFF
  s += linha()
  s += GRANDE + NEGRITO_ON + 'COMANDA ' + String(comanda.numero).padStart(2, '0') + '\n' + NORMAL
  if (comanda.identificacao) s += ALTO + semAcento(comanda.identificacao).slice(0, 32) + '\n' + NORMAL
  s += NEGRITO_OFF + ESQUERDA
  s += ladoALado(dt, 'Pedido #' + pedidoId)
  s += linha()
  for (const it of itens) {
    s += ALTO + NEGRITO_ON
    for (const l of quebrar(`${it.quantidade}x ${it.nome_produto}`.toUpperCase(), 32)) s += l + '\n'
    s += NORMAL + NEGRITO_OFF
    if (it.observacao) for (const l of quebrar('>> ' + it.observacao, LARGURA)) s += l + '\n'
    s += '\n'
  }
  s += linha()
  const total = itens.reduce((a, i) => a + i.quantidade, 0)
  s += ladoALado('Itens: ' + total, '')
  s += CENTRO + '* * *\n' + AVANCO + CORTE
  return s
}

const paraBase64 = (str) => {
  let bin = ''
  for (let i = 0; i < str.length; i++) bin += String.fromCharCode(str.charCodeAt(i) & 0xff)
  return btoa(bin)
}

export async function imprimir(conteudo) {
  if (ehApp()) return imprimirBluetooth(conteudo)
  const b64 = paraBase64(conteudo)
  const url = 'intent:base64,' + b64 + '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;'
  window.location.href = url
}

export const ehAndroid = () => ehApp() || /Android/i.test(navigator.userAgent)

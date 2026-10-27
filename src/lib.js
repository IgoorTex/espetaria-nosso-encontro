import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://bgldmrrsbbrpgavqttix.supabase.co',
  'sb_publishable_yJ82c4zacEZGiFKx8wMyIw_z3iqeKoc',
  { auth: { persistSession: true, autoRefreshToken: true } }
)

export const LOGIN_EMAIL = 'garcom@nossoencontro.app'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const money = (v) => brl.format(Number(v || 0))

export const parseMoney = (s) => {
  if (typeof s === 'number') return s
  const n = Number(String(s || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export const hora = (d) =>
  new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const dataCurta = (d) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export const hojeExtenso = () => {
  const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const decorrido = (d) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

// Mensagens de erro do banco em português legível
export const msgErro = (e) => {
  const m = e?.message || String(e || 'Erro desconhecido')
  if (/comandas_numero_ativo/.test(m)) return 'Já existe uma comanda aberta com esse número.'
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sem conexão. Verifique o Wi-Fi e tente de novo.'
  if (/Invalid login/i.test(m)) return 'Senha incorreta.'
  return m
}

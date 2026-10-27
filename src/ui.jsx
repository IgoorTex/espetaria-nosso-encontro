import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, msgErro } from './lib'

const paths = {
  voltar: <path d="M15 18l-6-6 6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  mais: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  imprimir: <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  baixar: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  lixo: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  grafico: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  lista: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  cadeado: <path d="M6 11h12v10H6zM8 11V7a4 4 0 018 0v4" />,
  sair: <path d="M15 4h4v16h-4M10 16l4-4-4-4M14 12H3" />,
  alerta: <path d="M12 3l10 18H2zM12 10v5M12 18h.01" />,
}

export function Icon({ name, size = 20, stroke = 2.2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

/* ---------- Avisos rápidos ---------- */
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [t, setT] = useState(null)
  const show = useCallback((msg, tipo = 'ok') => setT({ msg, tipo, id: Date.now() }), [])
  useEffect(() => {
    if (!t) return
    const id = setTimeout(() => setT(null), t.tipo === 'erro' ? 4500 : 2600)
    return () => clearTimeout(id)
  }, [t])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div role="status" aria-live="polite" className={'toast ' + (t.tipo === 'erro' ? 'erro' : '')}>{t.msg}</div>}
    </ToastCtx.Provider>
  )
}

/* ---------- Folha de baixo (modal) ---------- */
export function Sheet({ titulo, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={titulo}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 className="h1">{titulo}</h2>
          {onClose && <button className="icon-btn" aria-label="Fechar" onClick={onClose}><Icon name="x" /></button>}
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------- PIN do gerente ---------- */
export function PinSheet({ titulo = 'PIN do gerente', descricao, onOk, onClose, verificar = true }) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const confirmar = async (valor) => {
    if (!verificar) return onOk(valor)
    setCarregando(true); setErro('')
    const { data, error } = await supabase.rpc('verificar_pin', { p_pin: valor })
    setCarregando(false)
    if (error) return setErro(msgErro(error))
    if (!data) { setErro('PIN incorreto'); setPin(''); return }
    onOk(valor)
  }
  const tecla = (d) => {
    if (carregando) return
    const novo = (pin + d).slice(0, 6)
    setPin(novo); setErro('')
  }
  return (
    <Sheet titulo={titulo} onClose={onClose}>
      {descricao && <p className="muted" style={{ margin: 0 }}>{descricao}</p>}
      <div className="pin-dots" aria-label={`${pin.length} dígitos digitados`}>
        {[0, 1, 2, 3, 4, 5].slice(0, Math.max(4, pin.length)).map((i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      {erro && <p role="alert" style={{ margin: 0, color: 'var(--red)', textAlign: 'center', fontWeight: 600 }}>{erro}</p>}
      <div className="teclado">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="tecla" onClick={() => tecla(d)}>{d}</button>
        ))}
        <button className="tecla" aria-label="Apagar" onClick={() => setPin(pin.slice(0, -1))}>⌫</button>
        <button className="tecla" onClick={() => tecla('0')}>0</button>
        <button className="tecla" aria-label="Confirmar PIN" disabled={pin.length < 4 || carregando}
          style={{ background: 'var(--amber)', color: 'var(--on-accent)', borderColor: 'var(--amber)' }}
          onClick={() => confirmar(pin)}>
          <Icon name="check" size={24} stroke={2.8} />
        </button>
      </div>
    </Sheet>
  )
}

export function Badge({ status }) {
  const txt = { aberta: 'Aberta', fechada: 'A pagar', paga: 'Paga', cancelada: 'Cancelada' }[status] || status
  return <span className={'badge ' + status}>{txt}</span>
}

import { useState } from 'react'
import { supabase, LOGIN_EMAIL, msgErro } from '../lib'

export default function Login() {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const entrar = async (e) => {
    e.preventDefault()
    setCarregando(true); setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email: LOGIN_EMAIL, password: senha.trim() })
    setCarregando(false)
    if (error) setErro(msgErro(error))
  }

  return (
    <div className="app" style={{ justifyContent: 'center', padding: 24, gap: 28 }}>
      <img src="/logo.png" alt="Nosso Encontro – Espetaria & Churrasco" style={{ width: '100%', maxWidth: 340, alignSelf: 'center' }} />
      <form onSubmit={entrar} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 28 }}>Comandas</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Digite a senha de acesso. Só precisa fazer isso uma vez neste celular.</p>
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha de acesso</label>
          <input id="senha" className="input" type="password" autoComplete="current-password" value={senha}
            onChange={(e) => setSenha(e.target.value)} autoFocus />
        </div>
        {erro && <p role="alert" style={{ margin: 0, color: 'var(--red)', fontWeight: 600 }}>{erro}</p>}
        <button className="btn btn-primary btn-lg" disabled={!senha || carregando}>{carregando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}

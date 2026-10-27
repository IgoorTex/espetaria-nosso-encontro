import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib'
import { ToastProvider } from './ui'
import Login from './screens/Login'
import Comandas from './screens/Comandas'
import Comanda from './screens/Comanda'
import Pagamento from './screens/Pagamento'
import Relatorios from './screens/Relatorios'
import Cardapio from './screens/Cardapio'

// Navegação simples com suporte ao botão "voltar" do Android
function useNav() {
  const [rota, setRota] = useState(() => history.state?.rota || { tela: 'comandas' })
  useEffect(() => {
    if (!history.state?.rota) history.replaceState({ rota: { tela: 'comandas' } }, '')
    const pop = (e) => setRota(e.state?.rota || { tela: 'comandas' })
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  const ir = useCallback((tela, params = {}) => {
    const r = { tela, ...params }
    if (tela === 'comandas') { history.replaceState({ rota: r }, ''); setRota(r); return }
    history.pushState({ rota: r }, ''); setRota(r)
  }, [])
  const voltar = useCallback(() => {
    if (history.length > 1 && history.state?.rota?.tela !== 'comandas') history.back()
    else ir('comandas')
  }, [ir])
  return { rota, ir, voltar }
}

// Contador que muda sempre que algo é alterado no banco (tempo real)
function useAtualizacoes(ativo) {
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    if (!ativo) return
    let t
    const bump = () => { clearTimeout(t); t = setTimeout(() => setVersao((v) => v + 1), 150) }
    const ch = supabase.channel('mudancas')
    for (const tabela of ['comandas', 'itens_comanda', 'pagamentos', 'pedidos'])
      ch.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, bump)
    ch.subscribe()
    const vis = () => document.visibilityState === 'visible' && bump()
    document.addEventListener('visibilitychange', vis)
    return () => { clearTimeout(t); supabase.removeChannel(ch); document.removeEventListener('visibilitychange', vis) }
  }, [ativo])
  const forcar = useCallback(() => setVersao((v) => v + 1), [])
  return [versao, forcar]
}

export default function App() {
  const [sessao, setSessao] = useState(undefined)
  const nav = useNav()
  const [versao, atualizar] = useAtualizacoes(!!sessao)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  let tela = null
  if (sessao === undefined) tela = <div className="app" />
  else if (!sessao) tela = <Login />
  else {
    const p = { nav, versao, atualizar }
    const { rota } = nav
    if (rota.tela === 'comanda') tela = <Comanda key={rota.id} id={rota.id} {...p} />
    else if (rota.tela === 'pagamento') tela = <Pagamento key={rota.id} id={rota.id} {...p} />
    else if (rota.tela === 'relatorios') tela = <Relatorios {...p} />
    else if (rota.tela === 'cardapio') tela = <Cardapio {...p} />
    else tela = <Comandas {...p} />
  }
  return <ToastProvider>{tela}</ToastProvider>
}

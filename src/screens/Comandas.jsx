import { useEffect, useMemo, useState } from 'react'
import { supabase, money, hojeExtenso, decorrido, msgErro } from '../lib'
import { Icon, Sheet, PinSheet, Badge, useToast } from '../ui'
import { gerenteLiberado, liberarGerente, bloquearGerente } from '../gerente'
import { reimprimirPendentes } from './imprimirPedido'
import { ehApp, impressoraSalva, salvarImpressora, procurarImpressoras } from '../impressora'
import { imprimir } from '../print'

export default function Comandas({ nav, versao, atualizar }) {
  const toast = useToast()
  const [lista, setLista] = useState(null)
  const [pendentes, setPendentes] = useState([])
  const [filtro, setFiltro] = useState('aberta')
  const [novaAberta, setNovaAberta] = useState(false)
  const [menu, setMenu] = useState(false)
  const [pinPara, setPinPara] = useState(null)
  const [trocarPin, setTrocarPin] = useState(false)
  const [configImp, setConfigImp] = useState(false)

  useEffect(() => {
    let ativo = true
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0)
    Promise.all([
      supabase.from('comandas_resumo').select('*')
        .or(`status.in.(aberta,fechada),and(status.eq.paga,paga_em.gte.${inicioDia.toISOString()})`)
        .order('numero'),
      supabase.from('pedidos').select('id').is('impresso_em', null)
        .gte('criado_em', new Date(Date.now() - 12 * 3600e3).toISOString()),
    ]).then(([c, p]) => {
      if (!ativo) return
      if (c.error) { toast(msgErro(c.error), 'erro'); setLista((l) => l || []); return }
      setLista(c.data); setPendentes(p.data || [])
    })
    return () => { ativo = false }
  }, [versao, toast])

  const contagem = useMemo(() => {
    const c = { aberta: 0, fechada: 0, paga: 0 }
    for (const x of lista || []) c[x.status] = (c[x.status] || 0) + 1
    return c
  }, [lista])
  const emAberto = (lista || []).filter((c) => c.status !== 'paga').reduce((a, c) => a + Number(c.falta), 0)
  const visiveis = (lista || []).filter((c) => c.status === filtro)

  const areaGerente = (tela) => {
    setMenu(false)
    if (gerenteLiberado()) nav.ir(tela)
    else setPinPara(tela)
  }

  return (
    <div className="app">
      <header style={{ padding: '16px 16px 10px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <img src="/logo.png" alt="Nosso Encontro – Espetaria & Churrasco" style={{ height: 50, width: 'auto' }} />
          <button className="icon-btn" aria-label="Menu" onClick={() => setMenu(true)}><Icon name="menu" /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <span className="muted small" style={{ fontWeight: 500 }}>{hojeExtenso()}</span>
            <h1 className="h1">Comandas</h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span className="muted" style={{ fontSize: 12 }}>A receber agora</span>
            <span className="num" style={{ fontSize: 24, color: 'var(--amber)' }}>{money(emAberto)}</span>
          </div>
        </div>
      </header>

      <div className="pills" role="tablist" style={{ paddingTop: 0 }}>
        {[['aberta', 'Abertas'], ['fechada', 'A pagar'], ['paga', 'Pagas hoje']].map(([k, t]) => (
          <button key={k} role="tab" aria-selected={filtro === k} className={'pill ' + (filtro === k ? 'on-amber' : '')}
            onClick={() => setFiltro(k)}>{t} · {contagem[k] || 0}</button>
        ))}
      </div>

      <div className="scroll">
        {pendentes.length > 0 && (
          <div className="aviso" role="alert">
            <Icon name="alerta" />
            <span style={{ flex: 1 }}>{pendentes.length === 1 ? '1 pedido não foi impresso' : `${pendentes.length} pedidos não foram impressos`}</span>
            <button className="btn btn-amber" style={{ height: 40 }} onClick={async () => {
              try { await reimprimirPendentes(pendentes.map((p) => p.id)); atualizar() }
              catch (e) { if (e?.message === 'SEM_IMPRESSORA') setConfigImp(true); else toast('Falha ao imprimir: ' + msgErro(e), 'erro') }
            }}>Imprimir</button>
          </div>
        )}

        {lista === null ? (
          <div className="grid-comandas">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 124 }} />)}</div>
        ) : visiveis.length === 0 ? (
          <div className="vazio">
            <Icon name="lista" size={32} />
            <strong style={{ color: 'var(--text)' }}>
              {filtro === 'aberta' ? 'Nenhuma comanda aberta' : filtro === 'fechada' ? 'Nenhuma conta esperando pagamento' : 'Nenhuma comanda paga hoje'}
            </strong>
            {filtro === 'aberta' && <span>Toque em “Nova comanda” para começar.</span>}
          </div>
        ) : (
          <div className="grid-comandas">
            {visiveis.map((c) => (
              <button key={c.id} className="card comanda-card"
                onClick={() => nav.ir(c.status === 'fechada' ? 'pagamento' : 'comanda', { id: c.id })}>
                <div className="topo">
                  <span className="numero">{String(c.numero).padStart(2, '0')}</span>
                  <Badge status={c.status} />
                </div>
                <span className="ident">{c.identificacao || 'Sem identificação'}</span>
                <div className="rodape">
                  <span className="muted" style={{ fontSize: 12 }}>{c.qtd_itens} {c.qtd_itens === 1 ? 'item' : 'itens'} · {decorrido(c.aberta_em)}</span>
                  <span className="total">{money(c.status === 'fechada' ? c.falta : c.total)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rodape-fixo">
        <button className="btn btn-primary btn-lg btn-block" onClick={() => setNovaAberta(true)}>
          <Icon name="mais" size={22} stroke={2.8} /> Nova comanda
        </button>
      </div>

      {novaAberta && <NovaComanda lista={lista || []} onClose={() => setNovaAberta(false)}
        onCriada={(id) => { setNovaAberta(false); atualizar(); nav.ir('comanda', { id }) }} />}

      {menu && (
        <Sheet titulo="Menu" onClose={() => setMenu(false)}>
          {ehApp() && (
            <button className="btn btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => { setMenu(false); setConfigImp(true) }}>
              <Icon name="imprimir" /> Impressora{impressoraSalva() ? ' · ' + impressoraSalva().name : ' · não escolhida'}
            </button>
          )}
          <button className="btn btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => areaGerente('relatorios')}><Icon name="grafico" /> Relatórios</button>
          <button className="btn btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => areaGerente('cardapio')}><Icon name="lista" /> Cardápio e preços</button>
          <button className="btn btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => { setMenu(false); setTrocarPin(true) }}><Icon name="cadeado" /> Trocar PIN do gerente</button>
          <button className="btn btn-block btn-danger" style={{ justifyContent: 'flex-start' }} onClick={async () => {
            if (!confirm('Sair deste celular? Vai precisar da senha de acesso para entrar de novo.')) return
            bloquearGerente(); await supabase.auth.signOut()
          }}><Icon name="sair" /> Sair</button>
        </Sheet>
      )}

      {pinPara && <PinSheet descricao="Área do gerente." onClose={() => setPinPara(null)}
        onOk={() => { liberarGerente(); const t = pinPara; setPinPara(null); nav.ir(t) }} />}

      {configImp && <ConfigImpressora onClose={() => setConfigImp(false)} />}

      {trocarPin && <TrocarPin onClose={() => setTrocarPin(false)} onFeito={() => { setTrocarPin(false); toast('PIN alterado') }} />}
    </div>
  )
}

function NovaComanda({ lista, onClose, onCriada }) {
  const toast = useToast()
  const ocupados = new Set(lista.filter((c) => c.status !== 'paga').map((c) => c.numero))
  let sugestao = 1; while (ocupados.has(sugestao)) sugestao++
  const [numero, setNumero] = useState(String(sugestao))
  const [ident, setIdent] = useState('')
  const [salvando, setSalvando] = useState(false)

  const criar = async (e) => {
    e.preventDefault()
    const n = parseInt(numero, 10)
    if (!n || n < 1) return toast('Informe o número da comanda', 'erro')
    setSalvando(true)
    const { data, error } = await supabase.from('comandas')
      .insert({ numero: n, identificacao: ident.trim() || null }).select('id').single()
    setSalvando(false)
    if (error) return toast(msgErro(error), 'erro')
    onCriada(data.id)
  }

  return (
    <Sheet titulo="Nova comanda" onClose={onClose}>
      <form onSubmit={criar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="campo">
          <label htmlFor="num">Número da comanda</label>
          <input id="num" className="input num" style={{ fontSize: 28 }} inputMode="numeric" pattern="[0-9]*"
            value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </div>
        <div className="campo">
          <label htmlFor="ident">Mesa ou nome do cliente (opcional)</label>
          <input id="ident" className="input" placeholder="Ex.: Mesa 3 · Ricardo" maxLength={40}
            value={ident} onChange={(e) => setIdent(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-lg" disabled={salvando}>{salvando ? 'Abrindo…' : 'Abrir comanda'}</button>
      </form>
    </Sheet>
  )
}

function ConfigImpressora({ onClose }) {
  const toast = useToast()
  const [atual, setAtual] = useState(impressoraSalva())
  const [lista, setLista] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [testando, setTestando] = useState(false)

  const buscar = async () => {
    setBuscando(true); setLista(null)
    try { setLista(await procurarImpressoras()) }
    catch (e) { toast(msgErro(e), 'erro') }
    setBuscando(false)
  }
  const testar = async () => {
    setTestando(true)
    try {
      await imprimir('\x1B@\x1Ba\x01\x1BE\x01NOSSO ENCONTRO\n\x1BE\x00Impressora funcionando!\n\n\n\n\x1DV\x01')
      toast('Página de teste enviada')
    } catch (e) { toast('Não imprimiu: ' + msgErro(e) + '. A impressora está ligada e perto?', 'erro') }
    setTestando(false)
  }

  return (
    <Sheet titulo="Impressora" onClose={onClose}>
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="muted small">Impressora da cozinha</span>
        <strong style={{ fontSize: 17 }}>{atual ? atual.name : 'Nenhuma escolhida'}</strong>
        {atual && <span className="muted" style={{ fontSize: 12 }}>{atual.address}</span>}
      </div>
      {atual && <button className="btn btn-amber btn-lg" disabled={testando} onClick={testar}><Icon name="imprimir" /> {testando ? 'Imprimindo…' : 'Imprimir página de teste'}</button>}
      <button className="btn btn-lg" disabled={buscando} onClick={buscar}>{buscando ? 'Procurando… (uns 10 segundos)' : (atual ? 'Trocar impressora' : 'Procurar impressoras')}</button>
      {lista && lista.length === 0 && <p className="muted" style={{ margin: 0 }}>Nenhuma encontrada. Confira se a impressora está ligada e perto do celular, e tente de novo.</p>}
      {lista && lista.length > 0 && (
        <div className="card" style={{ padding: '2px 0' }}>
          {lista.map((d) => (
            <button key={d.address} className="item-pedido" style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--surface-2)', textAlign: 'left', minHeight: 52 }}
              onClick={() => { salvarImpressora(d); setAtual(impressoraSalva()); setLista(null); toast('Impressora escolhida') }}>
              <span style={{ flex: 1 }}>{d.name || 'Sem nome'}<br /><span className="muted" style={{ fontSize: 12 }}>{d.address}</span></span>
              <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Usar</span>
            </button>
          ))}
        </div>
      )}
      <p className="muted small" style={{ margin: 0 }}>Dica: impressoras costumam aparecer como “MPT-II”, “BlueTooth Printer”, “PT-210” ou parecido.</p>
    </Sheet>
  )
}

function TrocarPin({ onClose, onFeito }) {
  const toast = useToast()
  const [atual, setAtual] = useState(null)
  if (atual === null)
    return <PinSheet titulo="PIN atual" descricao="Digite o PIN atual do gerente." onClose={onClose} onOk={(p) => setAtual(p)} />
  return (
    <PinSheet titulo="Novo PIN" descricao="Escolha um PIN de 4 a 6 números." verificar={false} onClose={onClose}
      onOk={async (novo) => {
        const { error } = await supabase.rpc('trocar_pin', { p_pin_atual: atual, p_pin_novo: novo })
        if (error) return toast(msgErro(error), 'erro')
        onFeito()
      }} />
  )
}

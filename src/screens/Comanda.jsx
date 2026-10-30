import { useEffect, useMemo, useState } from 'react'
import { supabase, money, hora, msgErro } from '../lib'
import { Icon, Sheet, PinSheet, Badge, useToast } from '../ui'
import { imprimirPedido } from './imprimirPedido'
import { ehAndroid } from '../print'

const chaveCarrinho = (id) => 'carrinho-' + id
const lerCarrinho = (id) => { try { return JSON.parse(sessionStorage.getItem(chaveCarrinho(id))) || [] } catch { return [] } }

export default function Comanda({ id, nav, versao, atualizar }) {
  const toast = useToast()
  const [comanda, setComanda] = useState(null)
  const [cats, setCats] = useState([])
  const [produtos, setProdutos] = useState([])
  const [itens, setItens] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [catAtiva, setCatAtiva] = useState(null)
  const [carrinho, setCarrinho] = useState(() => lerCarrinho(id))
  const [enviando, setEnviando] = useState(false)
  const [obsDe, setObsDe] = useState(null)
  const [cancelar, setCancelar] = useState(null)
  const [verItens, setVerItens] = useState(false)

  useEffect(() => { try { sessionStorage.setItem(chaveCarrinho(id), JSON.stringify(carrinho)) } catch { /* sem armazenamento */ } }, [carrinho, id])

  useEffect(() => {
    let ativo = true
    Promise.all([
      supabase.from('categorias').select('*').order('ordem'),
      supabase.from('produtos').select('*').eq('ativo', true).order('ordem'),
    ]).then(([c, p]) => {
      if (!ativo) return
      setCats(c.data || []); setProdutos(p.data || [])
      setCatAtiva((a) => a ?? c.data?.[0]?.id ?? null)
    })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    let ativo = true
    Promise.all([
      supabase.from('comandas_resumo').select('*').eq('id', id).single(),
      supabase.from('itens_comanda').select('*').eq('comanda_id', id).order('criado_em'),
      supabase.from('pedidos').select('*').eq('comanda_id', id).order('criado_em', { ascending: false }),
    ]).then(([c, i, p]) => {
      if (!ativo) return
      if (c.error) { toast(msgErro(c.error), 'erro'); return }
      setComanda(c.data); setItens(i.data || []); setPedidos(p.data || [])
    })
    return () => { ativo = false }
  }, [id, versao, toast])

  const prodMap = useMemo(() => Object.fromEntries(produtos.map((p) => [p.id, p])), [produtos])
  const qtdNoCarrinho = (pid) => carrinho.filter((l) => l.produto_id === pid).reduce((a, l) => a + l.quantidade, 0)
  const valorCarrinho = carrinho.reduce((a, l) => a + (prodMap[l.produto_id]?.preco || 0) * l.quantidade, 0)
  const qtdCarrinho = carrinho.reduce((a, l) => a + l.quantidade, 0)
  const encerrada = comanda && ['paga', 'cancelada'].includes(comanda.status)

  const adicionar = (pid) => setCarrinho((c) => {
    const i = c.findIndex((l) => l.produto_id === pid && !l.observacao)
    if (i >= 0) return c.map((l, j) => (j === i ? { ...l, quantidade: l.quantidade + 1 } : l))
    return [...c, { produto_id: pid, quantidade: 1, observacao: '' }]
  })
  const remover = (pid) => setCarrinho((c) => {
    const idx = [...c.keys()].reverse().find((j) => c[j].produto_id === pid)
    if (idx === undefined) return c
    if (c[idx].quantidade > 1) return c.map((l, j) => (j === idx ? { ...l, quantidade: l.quantidade - 1 } : l))
    return c.filter((_, j) => j !== idx)
  })

  const enviar = async () => {
    if (!carrinho.length || enviando) return
    setEnviando(true)
    const { data: pedidoId, error } = await supabase.rpc('enviar_pedido', {
      p_comanda_id: id,
      p_itens: carrinho.map((l) => ({ produto_id: l.produto_id, quantidade: l.quantidade, observacao: l.observacao })),
    })
    if (error) { setEnviando(false); return toast(msgErro(error), 'erro') }
    setCarrinho([])
    atualizar()
    try {
      const imprimiu = await imprimirPedido(pedidoId)
      toast(imprimiu ? (ehAndroid() ? 'Pedido enviado para a cozinha' : 'Pedido salvo. Impressão só funciona no Android.') : 'Pedido lançado (só bebidas, sem notinha)')
    } catch (e) {
      toast(e?.message === 'SEM_IMPRESSORA'
        ? 'Pedido salvo. Escolha a impressora no Menu e toque em “Imprimir” no aviso.'
        : 'Pedido salvo, mas a impressão falhou. Confira a impressora e use “Imprimir” no aviso.', 'erro')
    }
    setEnviando(false)
  }

  const fecharConta = async () => {
    if (carrinho.length) return toast('Envie ou limpe os itens novos antes de fechar a conta', 'erro')
    if (comanda.status === 'aberta') {
      const { error } = await supabase.from('comandas').update({ status: 'fechada', fechada_em: new Date().toISOString() }).eq('id', id)
      if (error) return toast(msgErro(error), 'erro')
      atualizar()
    }
    nav.ir('pagamento', { id })
  }

  const reimprimir = async (pid) => {
    try { const ok = await imprimirPedido(pid, { reimpressao: true }); if (!ok) toast('Esse pedido não tem itens da cozinha') }
    catch (e) { toast(e?.message === 'SEM_IMPRESSORA' ? 'Escolha a impressora no Menu primeiro' : 'Falha ao imprimir: ' + msgErro(e), 'erro') }
  }

  if (!comanda) return <div className="app"><div className="topbar"><button className="icon-btn" aria-label="Voltar" onClick={nav.voltar}><Icon name="voltar" /></button></div></div>

  const doCat = produtos.filter((p) => p.categoria_id === catAtiva)
  const itensValidos = itens.filter((i) => !i.cancelado)

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label="Voltar para comandas" onClick={nav.voltar}><Icon name="voltar" /></button>
        <div className="titulo">
          <h1 className="h1">Comanda {String(comanda.numero).padStart(2, '0')}</h1>
          <span className="muted small">{comanda.identificacao || 'Sem identificação'} · aberta {hora(comanda.aberta_em)}</span>
        </div>
        <Badge status={comanda.status} />
      </header>

      {encerrada ? (
        <div className="vazio"><strong style={{ color: 'var(--text)' }}>Comanda {comanda.status === 'paga' ? 'paga' : 'cancelada'}</strong><span>Não dá para lançar itens novos.</span></div>
      ) : (
        <nav className="pills" aria-label="Categorias">
          {cats.map((c) => (
            <button key={c.id} className={'pill ' + (catAtiva === c.id ? 'on' : '')} aria-pressed={catAtiva === c.id}
              onClick={() => setCatAtiva(c.id)}>{c.nome}</button>
          ))}
        </nav>
      )}

      <div className="scroll">
        {!encerrada && (
          <div className="lista">
            {doCat.map((p) => {
              const q = qtdNoCarrinho(p.id)
              return (
                <div key={p.id} className="card produto">
                  <div className="info">
                    <span className="nome">{p.nome}</span>
                    <span className="muted small">{money(p.preco)}</span>
                  </div>
                  {q > 0 && <>
                    <button className="qtd-btn" aria-label={'Remover um ' + p.nome} onClick={() => remover(p.id)}><Icon name="menos" /></button>
                    <span className="qtd" aria-live="polite">{q}</span>
                  </>}
                  <button className="qtd-btn add" aria-label={'Adicionar ' + p.nome} onClick={() => adicionar(p.id)}><Icon name="mais" stroke={2.8} /></button>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-block" style={{ justifyContent: 'space-between' }} onClick={() => setVerItens(true)}>
            <span>Itens já lançados · {itensValidos.reduce((a, i) => a + i.quantidade, 0)}</span>
            <span className="muted">Ver / reimprimir</span>
          </button>
        </div>
      </div>

      <div className="painel">
        {carrinho.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }} className="h2">
              <span>Novo pedido · {qtdCarrinho} {qtdCarrinho === 1 ? 'item' : 'itens'}</span>
              <button className="link-btn" style={{ padding: 0, minHeight: 0, fontSize: 12, textTransform: 'uppercase' }} onClick={() => setCarrinho([])}>Limpar</button>
            </div>
            <div className="carrinho">
              {carrinho.map((l, idx) => (
                <div key={idx} className="cart-linha">
                  <span style={{ minWidth: 0 }}>{l.quantidade}× {prodMap[l.produto_id]?.nome}
                    {l.observacao && <span className="obs"> · {l.observacao}</span>}</span>
                  <button className="link-btn" onClick={() => setObsDe(idx)}>{l.observacao ? 'Editar obs.' : '+ Obs.'}</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="total-linha">
          <span className="muted small">Total da comanda{valorCarrinho > 0 && <><br /><span style={{ color: 'var(--amber)' }}>+ {money(valorCarrinho)} neste pedido</span></>}</span>
          <span className="valor">{money(Number(comanda.total) + valorCarrinho)}</span>
        </div>
        {!encerrada && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" style={{ flex: carrinho.length ? '0 0 120px' : 1, height: 56 }} onClick={fecharConta}>Fechar conta</button>
            {carrinho.length > 0 && (
              <button className="btn btn-primary" style={{ flex: 1, height: 56 }} disabled={enviando} onClick={enviar}>
                <Icon name="imprimir" /> {enviando ? 'Enviando…' : 'Enviar e imprimir'}
              </button>
            )}
          </div>
        )}
      </div>

      {obsDe !== null && carrinho[obsDe] && (
        <Observacao inicial={carrinho[obsDe].observacao} nome={prodMap[carrinho[obsDe].produto_id]?.nome}
          onClose={() => setObsDe(null)}
          onSalvar={(txt) => { setCarrinho((c) => c.map((l, j) => (j === obsDe ? { ...l, observacao: txt } : l))); setObsDe(null) }} />
      )}

      {verItens && (
        <Sheet titulo="Itens lançados" onClose={() => setVerItens(false)}>
          {itens.length === 0 ? <p className="muted" style={{ margin: 0 }}>Nenhum item lançado ainda.</p> : (
            <div className="card">
              {itens.map((i) => (
                <div key={i.id} className={'item-pedido ' + (i.cancelado ? 'cancelado' : '')}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span className="nome">{i.quantidade}× {i.nome_produto}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {hora(i.criado_em)}{i.observacao ? ' · ' + i.observacao : ''}{i.cancelado ? ' · cancelado: ' + i.motivo_cancelamento : ''}
                    </span>
                  </div>
                  <span style={{ fontWeight: 600 }}>{money(i.preco_unitario * i.quantidade)}</span>
                  {!i.cancelado && !encerrada && (
                    <button className="icon-btn" aria-label={'Cancelar ' + i.nome_produto} onClick={() => setCancelar(i)}><Icon name="lixo" size={18} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
          {pedidos.length > 0 && <>
            <h3 className="h2">Notinhas da cozinha</h3>
            {pedidos.map((p) => (
              <div key={p.id} className="cart-linha">
                <span>Pedido #{p.id} · {hora(p.criado_em)} {p.impresso_em ? <span className="muted">· impresso</span> : <span style={{ color: 'var(--ember)' }}>· não impresso</span>}</span>
                <button className="btn" style={{ height: 40 }} onClick={() => reimprimir(p.id)}><Icon name="imprimir" size={18} /> Reimprimir</button>
              </div>
            ))}
          </>}
        </Sheet>
      )}

      {cancelar && <CancelarItem item={cancelar} onClose={() => setCancelar(null)}
        onFeito={() => { setCancelar(null); atualizar(); toast('Item cancelado') }} />}
    </div>
  )
}

function Observacao({ inicial, nome, onClose, onSalvar }) {
  const [txt, setTxt] = useState(inicial || '')
  const rapidas = ['Ao ponto', 'Bem passado', 'Mal passado', 'Sem sal', 'Com farofa', 'Para viagem']
  return (
    <Sheet titulo="Observação" onClose={onClose}>
      <p className="muted" style={{ margin: 0 }}>{nome}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {rapidas.map((r) => <button key={r} className="pill" onClick={() => setTxt(r)}>{r}</button>)}
      </div>
      <textarea className="input" aria-label="Observação" maxLength={80} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Ex.: sem cebola" />
      <button className="btn btn-amber btn-lg" onClick={() => onSalvar(txt.trim())}>Salvar observação</button>
    </Sheet>
  )
}

function CancelarItem({ item, onClose, onFeito }) {
  const toast = useToast()
  const [motivo, setMotivo] = useState('')
  const [pedirPin, setPedirPin] = useState(false)
  if (pedirPin)
    return (
      <PinSheet descricao={`Cancelar ${item.quantidade}× ${item.nome_produto}`} verificar={false} onClose={onClose}
        onOk={async (pin) => {
          const { error } = await supabase.rpc('cancelar_item', { p_item_id: item.id, p_motivo: motivo, p_pin: pin })
          if (error) { toast(msgErro(error), 'erro'); return }
          onFeito()
        }} />
    )
  return (
    <Sheet titulo="Cancelar item" onClose={onClose}>
      <p className="muted" style={{ margin: 0 }}>{item.quantidade}× {item.nome_produto} · {money(item.preco_unitario * item.quantidade)}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {['Lançado errado', 'Cliente desistiu', 'Demorou demais', 'Saiu errado da cozinha'].map((m) => (
          <button key={m} className={'pill ' + (motivo === m ? 'on-amber' : '')} onClick={() => setMotivo(m)}>{m}</button>
        ))}
      </div>
      <input className="input" aria-label="Motivo" placeholder="Ou escreva o motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={80} />
      <button className="btn btn-danger btn-lg" disabled={!motivo.trim()} onClick={() => setPedirPin(true)}>Continuar com PIN do gerente</button>
    </Sheet>
  )
}

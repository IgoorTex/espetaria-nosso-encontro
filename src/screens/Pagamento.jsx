import { useEffect, useMemo, useState } from 'react'
import { supabase, money, parseMoney, hora, msgErro } from '../lib'
import { Icon, Sheet, PinSheet, Badge, useToast } from '../ui'

const FORMAS = [['pix', 'Pix'], ['debito', 'Débito'], ['credito', 'Crédito'], ['dinheiro', 'Dinheiro']]
const nomeForma = Object.fromEntries(FORMAS)
const fmtInput = (v) => Number(v).toFixed(2).replace('.', ',')

export default function Pagamento({ id, nav, versao, atualizar }) {
  const toast = useToast()
  const [comanda, setComanda] = useState(null)
  const [itens, setItens] = useState([])
  const [pagamentos, setPagamentos] = useState([])
  const [forma, setForma] = useState('pix')
  const [pessoas, setPessoas] = useState(1)
  const [valor, setValor] = useState('')
  const [recebido, setRecebido] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [desconto, setDesconto] = useState(false)
  const [cancelar, setCancelar] = useState(false)

  useEffect(() => {
    let ativo = true
    Promise.all([
      supabase.from('comandas_resumo').select('*').eq('id', id).single(),
      supabase.from('itens_comanda').select('nome_produto, quantidade, preco_unitario').eq('comanda_id', id).eq('cancelado', false),
      supabase.from('pagamentos').select('*').eq('comanda_id', id).order('criado_em'),
    ]).then(([c, i, p]) => {
      if (!ativo) return
      if (c.error) return toast(msgErro(c.error), 'erro')
      setComanda(c.data); setItens(i.data || []); setPagamentos(p.data || [])
    })
    return () => { ativo = false }
  }, [id, versao, toast])

  // valor sugerido: o que falta dividido pelas pessoas que ainda vão pagar
  const falta = Number(comanda?.falta || 0)
  useEffect(() => {
    if (!comanda) return
    const parte = pessoas > 1 ? Math.ceil((falta / pessoas) * 100) / 100 : falta
    setValor(fmtInput(Math.min(parte, falta)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comanda?.id, falta, pessoas])

  const agrupado = useMemo(() => {
    const m = new Map()
    for (const i of itens) {
      const k = i.nome_produto + '|' + i.preco_unitario
      const a = m.get(k) || { nome: i.nome_produto, q: 0, v: 0 }
      a.q += i.quantidade; a.v += i.quantidade * Number(i.preco_unitario); m.set(k, a)
    }
    return [...m.values()]
  }, [itens])

  const registrar = async () => {
    const v = parseMoney(valor)
    if (!(v > 0)) return toast('Informe o valor', 'erro')
    if (v > falta + 0.001) return toast('Valor maior do que falta pagar', 'erro')
    setSalvando(true)
    const { data, error } = await supabase.rpc('registrar_pagamento', { p_comanda_id: id, p_valor: v, p_forma: forma })
    setSalvando(false)
    if (error) return toast(msgErro(error), 'erro')
    setRecebido('')
    atualizar()
    if (data === 'paga') { toast('Comanda paga!'); nav.ir('comandas') }
    else { toast(`${money(v)} registrado`); setPessoas((p) => Math.max(1, p - 1)) }
  }

  if (!comanda) return <div className="app"><div className="topbar"><button className="icon-btn" aria-label="Voltar" onClick={nav.voltar}><Icon name="voltar" /></button></div></div>

  const encerrada = ['paga', 'cancelada'].includes(comanda.status)
  const troco = forma === 'dinheiro' && recebido ? parseMoney(recebido) - parseMoney(valor) : null

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label="Voltar" onClick={nav.voltar}><Icon name="voltar" /></button>
        <div className="titulo">
          <h1 className="h1">{encerrada ? 'Conta' : 'Fechar conta'}</h1>
          <span className="muted small">Comanda {String(comanda.numero).padStart(2, '0')}{comanda.identificacao ? ' · ' + comanda.identificacao : ''}</span>
        </div>
        <Badge status={comanda.status} />
      </header>

      <div className="scroll" style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {agrupado.length === 0 && <span className="muted">Nenhum item na comanda.</span>}
          {agrupado.map((a) => (
            <div key={a.nome + a.v} className="linha-valor"><span style={{ color: 'var(--text-2)' }}>{a.q}× {a.nome}</span><span style={{ fontWeight: 600 }}>{money(a.v)}</span></div>
          ))}
          <div className="linha-valor muted" style={{ paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
            <span>Desconto</span>
            <span>{Number(comanda.desconto) > 0 ? '− ' + money(comanda.desconto) : (
              encerrada ? money(0) : <button className="link-btn" style={{ padding: 0, minHeight: 0 }} onClick={() => setDesconto(true)}>Aplicar desconto</button>
            )}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600 }}>Total</span>
            <span className="num" style={{ fontSize: 34, color: 'var(--amber)' }}>{money(comanda.total)}</span>
          </div>
          {pagamentos.map((p) => (
            <div key={p.id} className="linha-valor" style={{ color: 'var(--green-text)' }}>
              <span>Pago · {nomeForma[p.forma]} · {hora(p.criado_em)}</span><span style={{ fontWeight: 700 }}>{money(p.valor)}</span>
            </div>
          ))}
          {pagamentos.length > 0 && (
            <div className="linha-valor" style={{ fontWeight: 700 }}><span>Falta receber</span><span>{money(falta)}</span></div>
          )}
        </section>

        {!encerrada && falta > 0 && <>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 className="h2">Forma de pagamento</h2>
            <div className="formas" role="radiogroup" aria-label="Forma de pagamento">
              {FORMAS.map(([k, t]) => (
                <button key={k} role="radio" aria-checked={forma === k} className={'forma ' + (forma === k ? 'on' : '')} onClick={() => setForma(k)}>{t}</button>
              ))}
            </div>
          </section>

          <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <h2 className="h2">Dividir o que falta</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="qtd-btn" aria-label="Menos pessoas" onClick={() => setPessoas((p) => Math.max(1, p - 1))}><Icon name="menos" /></button>
              <span style={{ fontWeight: 700, fontSize: 17, minWidth: 82, textAlign: 'center' }}>{pessoas} {pessoas === 1 ? 'pessoa' : 'pessoas'}</span>
              <button className="qtd-btn" aria-label="Mais pessoas" onClick={() => setPessoas((p) => Math.min(20, p + 1))}><Icon name="mais" /></button>
            </div>
          </section>

          <div style={{ display: 'flex', gap: 10 }}>
            <div className="campo" style={{ flex: 1 }}>
              <label htmlFor="valor">Valor deste pagamento</label>
              <input id="valor" className="input num" style={{ fontSize: 24 }} inputMode="decimal" value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^\d,]/g, ''))} />
            </div>
            {forma === 'dinheiro' && (
              <div className="campo" style={{ flex: 1 }}>
                <label htmlFor="recebido">Recebido</label>
                <input id="recebido" className="input num" style={{ fontSize: 24 }} inputMode="decimal" placeholder="0,00" value={recebido}
                  onChange={(e) => setRecebido(e.target.value.replace(/[^\d,]/g, ''))} />
              </div>
            )}
          </div>
          {troco !== null && troco >= 0 && <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>Troco: <span style={{ color: 'var(--amber)' }}>{money(troco)}</span></p>}
        </>}

        {!encerrada && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => nav.ir('comanda', { id })}>Adicionar itens</button>
            {pagamentos.length === 0 && <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setCancelar(true)}>Cancelar comanda</button>}
          </div>
        )}
      </div>

      {!encerrada && falta > 0 && (
        <div style={{ padding: '12px 16px calc(18px + var(--safe-b))', borderTop: '1px solid var(--surface-2)' }}>
          <button className="btn btn-green btn-lg btn-block" disabled={salvando} onClick={registrar}>
            <Icon name="check" size={22} stroke={2.8} /> {salvando ? 'Registrando…' : `Registrar ${money(parseMoney(valor))}`}
          </button>
        </div>
      )}
      {!encerrada && falta <= 0 && Number(comanda.total) === 0 && (
        <div style={{ padding: '12px 16px calc(18px + var(--safe-b))' }}><p className="muted" style={{ margin: 0 }}>Comanda sem valor. Adicione itens ou cancele.</p></div>
      )}

      {desconto && <Desconto comandaId={id} onClose={() => setDesconto(false)} onFeito={() => { setDesconto(false); atualizar(); toast('Desconto aplicado') }} />}
      {cancelar && (
        <PinSheet titulo="Cancelar comanda" descricao="Só use se a comanda foi aberta por engano." verificar={false} onClose={() => setCancelar(false)}
          onOk={async (pin) => {
            const { error } = await supabase.rpc('cancelar_comanda', { p_comanda_id: id, p_pin: pin })
            if (error) return toast(msgErro(error), 'erro')
            setCancelar(false); atualizar(); toast('Comanda cancelada'); nav.ir('comandas')
          }} />
      )}
    </div>
  )
}

function Desconto({ comandaId, onClose, onFeito }) {
  const toast = useToast()
  const [valor, setValor] = useState('')
  const [pin, setPin] = useState(false)
  if (pin)
    return (
      <PinSheet descricao={`Desconto de ${money(parseMoney(valor))}`} verificar={false} onClose={onClose}
        onOk={async (p) => {
          const { error } = await supabase.rpc('aplicar_desconto', { p_comanda_id: comandaId, p_valor: parseMoney(valor), p_pin: p })
          if (error) return toast(msgErro(error), 'erro')
          onFeito()
        }} />
    )
  return (
    <Sheet titulo="Desconto" onClose={onClose}>
      <div className="campo">
        <label htmlFor="desc">Valor do desconto (R$)</label>
        <input id="desc" className="input num" style={{ fontSize: 24 }} inputMode="decimal" placeholder="0,00" value={valor}
          onChange={(e) => setValor(e.target.value.replace(/[^\d,]/g, ''))} autoFocus />
      </div>
      <button className="btn btn-amber btn-lg" disabled={!(parseMoney(valor) > 0)} onClick={() => setPin(true)}>Continuar com PIN do gerente</button>
    </Sheet>
  )
}

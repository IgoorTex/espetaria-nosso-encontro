import { useEffect, useMemo, useState } from 'react'
import { supabase, money, msgErro } from '../lib'
import { Icon, useToast } from '../ui'

const nomeForma = { pix: 'Pix', debito: 'Débito', credito: 'Crédito', dinheiro: 'Dinheiro' }
const diaKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}` }

function periodo(tipo) {
  const fim = new Date()
  const ini = new Date(); ini.setHours(0, 0, 0, 0)
  if (tipo === 'semana') ini.setDate(ini.getDate() - 6)
  if (tipo === 'mes') ini.setDate(1)
  return { ini, fim }
}

// busca tudo paginando (o Supabase devolve no máximo 1000 linhas por vez)
async function buscarTudo(q) {
  const out = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await q().range(de, de + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}

export default function Relatorios({ nav, versao }) {
  const toast = useToast()
  const [tipo, setTipo] = useState('hoje')
  const [dados, setDados] = useState(null)

  useEffect(() => {
    let ativo = true
    const { ini, fim } = periodo(tipo)
    setDados(null)
    Promise.all([
      buscarTudo(() => supabase.from('pagamentos').select('valor, forma, criado_em').gte('criado_em', ini.toISOString()).lte('criado_em', fim.toISOString())),
      buscarTudo(() => supabase.from('itens_comanda').select('nome_produto, quantidade, preco_unitario, cancelado, motivo_cancelamento, criado_em, comanda_id, produtos(categoria_id, categorias(nome))')
        .gte('criado_em', ini.toISOString()).lte('criado_em', fim.toISOString())),
      supabase.from('comandas').select('id', { count: 'exact', head: true }).eq('status', 'paga').gte('paga_em', ini.toISOString()).lte('paga_em', fim.toISOString()),
    ]).then(([pags, itens, pagas]) => {
      if (ativo) setDados({ pags, itens, comandasPagas: pagas.count || 0, ini, fim })
    }).catch((e) => toast(msgErro(e), 'erro'))
    return () => { ativo = false }
  }, [tipo, versao, toast])

  const r = useMemo(() => {
    if (!dados) return null
    const fat = dados.pags.reduce((a, p) => a + Number(p.valor), 0)
    const porForma = {}
    for (const p of dados.pags) porForma[p.forma] = (porForma[p.forma] || 0) + Number(p.valor)

    const validos = dados.itens.filter((i) => !i.cancelado)
    const cancelados = dados.itens.filter((i) => i.cancelado)
    const prod = new Map()
    const porCat = {}
    for (const i of validos) {
      const a = prod.get(i.nome_produto) || { nome: i.nome_produto, q: 0, v: 0 }
      a.q += i.quantidade; a.v += i.quantidade * Number(i.preco_unitario); prod.set(i.nome_produto, a)
      const cat = i.produtos?.categorias?.nome || 'Outros'
      porCat[cat] = (porCat[cat] || 0) + i.quantidade
    }
    const ranking = [...prod.values()].sort((a, b) => b.q - a.q)

    // barras: por hora (hoje) ou por dia (semana/mês)
    let barras = []
    if (tipo === 'hoje') {
      const h = {}
      for (const p of dados.pags) { const k = new Date(p.criado_em).getHours(); h[k] = (h[k] || 0) + Number(p.valor) }
      const horas = Object.keys(h).map(Number)
      if (horas.length) {
        const de = Math.min(...horas), ate = Math.max(...horas)
        for (let k = de; k <= ate; k++) barras.push({ l: k + 'h', v: h[k] || 0 })
      }
    } else {
      const d = {}
      for (const p of dados.pags) { const k = diaKey(p.criado_em); d[k] = (d[k] || 0) + Number(p.valor) }
      for (let x = new Date(dados.ini); x <= dados.fim; x.setDate(x.getDate() + 1)) {
        barras.push({
          l: tipo === 'semana' ? x.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : String(x.getDate()),
          v: d[diaKey(x)] || 0,
        })
      }
    }
    const maxBarra = Math.max(0, ...barras.map((b) => b.v))
    return { fat, porForma, ranking, porCat, barras, maxBarra, cancelados, validos }
  }, [dados, tipo])

  const exportar = () => {
    if (!dados) return
    const linhas = [['Data', 'Hora', 'Comanda (id)', 'Produto', 'Categoria', 'Quantidade', 'Preço unitário', 'Total', 'Cancelado', 'Motivo']]
    for (const i of dados.itens) {
      const d = new Date(i.criado_em)
      linhas.push([d.toLocaleDateString('pt-BR'), d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), i.comanda_id,
        i.nome_produto, i.produtos?.categorias?.nome || '', i.quantidade, String(i.preco_unitario).replace('.', ','),
        (i.quantidade * i.preco_unitario).toFixed(2).replace('.', ','), i.cancelado ? 'sim' : 'não', i.motivo_cancelamento || ''])
    }
    linhas.push([]); linhas.push(['Pagamentos'])
    linhas.push(['Data', 'Hora', 'Forma', 'Valor'])
    for (const p of dados.pags) {
      const d = new Date(p.criado_em)
      linhas.push([d.toLocaleDateString('pt-BR'), d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), nomeForma[p.forma], String(Number(p.valor).toFixed(2)).replace('.', ',')])
    }
    const csv = '﻿' + linhas.map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `relatorio-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const tituloPeriodo = dados ? (tipo === 'hoje' ? 'Hoje' :
    `${dados.ini.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} a ${dados.fim.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`) : ''

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label="Voltar" onClick={nav.voltar}><Icon name="voltar" /></button>
        <div className="titulo"><h1 className="h1">Relatórios</h1></div>
        <button className="icon-btn" aria-label="Baixar planilha (Excel)" onClick={exportar} disabled={!dados}><Icon name="baixar" /></button>
      </header>

      <div className="scroll" style={{ padding: '14px 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="segmento" role="tablist">
          {[['hoje', 'Hoje'], ['semana', '7 dias'], ['mes', 'Mês']].map(([k, t]) => (
            <button key={k} role="tab" aria-selected={tipo === k} className={tipo === k ? 'on' : ''} onClick={() => setTipo(k)}>{t}</button>
          ))}
        </div>

        {!r ? (
          <>
            <div className="skeleton" style={{ height: 190 }} />
            <div className="skeleton" style={{ height: 70 }} />
            <div className="skeleton" style={{ height: 160 }} />
          </>
        ) : <>
          <section className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <span className="muted small">Faturamento recebido · {tituloPeriodo}</span>
              <div className="num" style={{ fontSize: 40, lineHeight: 1.05, color: 'var(--amber)' }}>{money(r.fat)}</div>
            </div>
            {r.barras.length > 0 && r.maxBarra > 0 ? (
              <div className="barras" role="img" aria-label="Faturamento por período">
                {r.barras.map((b, i) => (
                  <div key={i} className="barra" title={money(b.v)}>
                    <div className={'b ' + (b.v === r.maxBarra ? 'max' : '')} style={{ height: `${(b.v / r.maxBarra) * 82}px` }} />
                    {(r.barras.length <= 12 || i % Math.ceil(r.barras.length / 10) === 0) && <span className="l">{b.l}</span>}
                  </div>
                ))}
              </div>
            ) : <span className="muted small">Ainda não há pagamentos neste período.</span>}
          </section>

          <div className="stats">
            <div className="card stat"><span className="muted" style={{ fontSize: 12 }}>Comandas pagas</span><span className="v">{dados.comandasPagas}</span></div>
            <div className="card stat"><span className="muted" style={{ fontSize: 12 }}>Ticket médio</span><span className="v">{money(dados.comandasPagas ? r.fat / dados.comandasPagas : 0)}</span></div>
            <div className="card stat"><span className="muted" style={{ fontSize: 12 }}>Espetos</span><span className="v">{r.porCat['Espetos'] || 0}</span></div>
          </div>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 className="h2">Por forma de pagamento</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {Object.keys(nomeForma).map((k) => (
                <div key={k} className="card linha-valor" style={{ padding: '10px 12px', borderRadius: 12 }}>
                  <span style={{ color: 'var(--text-2)' }}>{nomeForma[k]}</span><span style={{ fontWeight: 700 }}>{money(r.porForma[k] || 0)}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 className="h2">O que mais saiu</h2>
            {r.ranking.length === 0 && <span className="muted small">Nenhum item lançado neste período.</span>}
            {r.ranking.slice(0, 12).map((p, i) => (
              <div key={p.nome} className="rank">
                <span style={{ width: 20, color: 'var(--muted)', fontWeight: 700 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="linha-valor"><span>{p.nome}</span><span><strong>{p.q}</strong> <span className="muted">· {money(p.v)}</span></span></div>
                  <div className="trilho"><div style={{ width: `${(p.q / r.ranking[0].q) * 100}%` }} /></div>
                </div>
              </div>
            ))}
          </section>

          {Object.keys(r.porCat).length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 className="h2">Quantidade por categoria</h2>
              <div className="card" style={{ padding: '4px 0' }}>
                {Object.entries(r.porCat).sort((a, b) => b[1] - a[1]).map(([c, q]) => (
                  <div key={c} className="item-pedido"><span style={{ flex: 1 }}>{c}</span><strong>{q}</strong></div>
                ))}
              </div>
            </section>
          )}

          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 className="h2">Itens cancelados · {r.cancelados.length}</h2>
            {r.cancelados.length === 0 ? <span className="muted small">Nenhum cancelamento neste período.</span> : (
              <div className="card" style={{ padding: '4px 0' }}>
                {r.cancelados.slice(0, 30).map((i, k) => (
                  <div key={k} className="item-pedido">
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span>{i.quantidade}× {i.nome_produto}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{new Date(i.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {i.motivo_cancelamento}</span>
                    </div>
                    <span className="muted">{money(i.quantidade * i.preco_unitario)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>}
      </div>
    </div>
  )
}

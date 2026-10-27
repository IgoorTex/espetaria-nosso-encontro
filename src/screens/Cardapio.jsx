import { useEffect, useState } from 'react'
import { supabase, money, parseMoney, msgErro } from '../lib'
import { Icon, Sheet, useToast } from '../ui'

export default function Cardapio({ nav }) {
  const toast = useToast()
  const [cats, setCats] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [editar, setEditar] = useState(null) // produto ou { novo: true, categoria_id }
  const [v, setV] = useState(0)
  const recarregar = () => setV((x) => x + 1)

  useEffect(() => {
    Promise.all([
      supabase.from('categorias').select('*').order('ordem'),
      supabase.from('produtos').select('*').order('ordem'),
    ]).then(([c, p]) => {
      if (c.error || p.error) return toast(msgErro(c.error || p.error), 'erro')
      setCats(c.data); setProdutos(p.data)
    })
  }, [v, toast])

  const alternarSetor = async (cat) => {
    const setor = cat.setor === 'cozinha' ? 'bar' : 'cozinha'
    const { error } = await supabase.from('categorias').update({ setor }).eq('id', cat.id)
    if (error) return toast(msgErro(error), 'erro')
    toast(setor === 'cozinha' ? `${cat.nome}: vai sair na notinha` : `${cat.nome}: não imprime mais`)
    recarregar()
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label="Voltar" onClick={nav.voltar}><Icon name="voltar" /></button>
        <div className="titulo"><h1 className="h1">Cardápio</h1><span className="muted small">Preços valem para pedidos novos</span></div>
      </header>
      <div className="scroll" style={{ padding: '14px 16px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {cats === null && <div className="skeleton" style={{ height: 300 }} />}
        {(cats || []).map((c) => (
          <section key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <h2 className="h1" style={{ fontSize: 22 }}>{c.nome}</h2>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', minHeight: 44 }}>
                <input type="checkbox" checked={c.setor === 'cozinha'} onChange={() => alternarSetor(c)} style={{ width: 22, height: 22, accentColor: 'var(--amber)' }} />
                Imprime na cozinha
              </label>
            </div>
            <div className="card" style={{ padding: '2px 0' }}>
              {produtos.filter((p) => p.categoria_id === c.id).map((p) => (
                <button key={p.id} className="item-pedido" onClick={() => setEditar(p)}
                  style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--surface-2)', textAlign: 'left', opacity: p.ativo ? 1 : 0.5 }}>
                  <span style={{ flex: 1 }}>{p.nome}{!p.ativo && <span className="muted"> · em falta</span>}</span>
                  <strong>{money(p.preco)}</strong>
                </button>
              ))}
            </div>
            <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setEditar({ novo: true, categoria_id: c.id, nome: '', preco: '', ativo: true })}>+ Adicionar produto em {c.nome}</button>
          </section>
        ))}
      </div>
      {editar && <EditarProduto produto={editar} produtos={produtos} onClose={() => setEditar(null)} onSalvo={() => { setEditar(null); recarregar(); toast('Cardápio atualizado') }} />}
    </div>
  )
}

function EditarProduto({ produto, produtos, onClose, onSalvo }) {
  const toast = useToast()
  const [nome, setNome] = useState(produto.nome)
  const [preco, setPreco] = useState(produto.preco === '' ? '' : Number(produto.preco).toFixed(2).replace('.', ','))
  const [ativo, setAtivo] = useState(produto.ativo)
  const [salvando, setSalvando] = useState(false)

  const salvar = async (e) => {
    e.preventDefault()
    const p = parseMoney(preco)
    if (!nome.trim()) return toast('Informe o nome', 'erro')
    if (!(p >= 0) || preco === '') return toast('Informe o preço', 'erro')
    setSalvando(true)
    const dados = { nome: nome.trim(), preco: p, ativo }
    const { error } = produto.novo
      ? await supabase.from('produtos').insert({ ...dados, categoria_id: produto.categoria_id,
          ordem: Math.max(0, ...produtos.filter((x) => x.categoria_id === produto.categoria_id).map((x) => x.ordem)) + 1 })
      : await supabase.from('produtos').update(dados).eq('id', produto.id)
    setSalvando(false)
    if (error) return toast(/duplicate|unique/i.test(error.message) ? 'Já existe um produto com esse nome' : msgErro(error), 'erro')
    onSalvo()
  }

  return (
    <Sheet titulo={produto.novo ? 'Novo produto' : 'Editar produto'} onClose={onClose}>
      <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="campo"><label htmlFor="pn">Nome</label><input id="pn" className="input" value={nome} maxLength={50} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="campo"><label htmlFor="pp">Preço (R$)</label>
          <input id="pp" className="input num" style={{ fontSize: 24 }} inputMode="decimal" placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value.replace(/[^\d,]/g, ''))} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--amber)' }} />
          Disponível para venda (desmarque quando acabar)
        </label>
        <button className="btn btn-amber btn-lg" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </form>
    </Sheet>
  )
}

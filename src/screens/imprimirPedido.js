import { supabase } from '../lib'
import { montarNotinha, imprimir } from '../print'
import { ehApp } from '../impressora'

// Busca os pedidos, monta as notinhas só com itens da cozinha,
// manda para a impressora e marca como impressos.
async function montar(ids, reimpressao) {
  const { data, error } = await supabase.from('pedidos')
    .select('id, criado_em, comandas(numero, identificacao), itens_comanda(nome_produto, quantidade, observacao, cancelado, produtos(categorias(setor)))')
    .in('id', ids).order('criado_em')
  if (error) throw error
  let conteudo = ''
  for (const p of data) {
    const itens = (p.itens_comanda || []).filter((i) => !i.cancelado && i.produtos?.categorias?.setor === 'cozinha')
    if (itens.length === 0) continue
    conteudo += montarNotinha({ comanda: p.comandas, pedidoId: p.id, criadoEm: p.criado_em, itens, reimpressao })
  }
  return conteudo
}

async function marcarImpressos(ids) {
  const { error } = await supabase.from('pedidos').update({ impresso_em: new Date().toISOString() }).in('id', ids)
  if (error) throw error
}

async function enviar(ids, reimpressao) {
  const conteudo = await montar(ids, reimpressao)
  if (!conteudo) { await marcarImpressos(ids); return false }
  if (ehApp()) {
    // no app sabemos se imprimiu de verdade: só marca depois de sair
    await imprimir(conteudo)
    await marcarImpressos(ids)
  } else {
    // no navegador o RawBT assume a impressão
    await marcarImpressos(ids)
    await imprimir(conteudo)
  }
  return true
}

// retorna true se mandou algo para a impressora
export const imprimirPedido = (id, { reimpressao = false } = {}) => enviar([id], reimpressao)
export const reimprimirPendentes = (ids) => (ids.length ? enviar(ids, false) : Promise.resolve(false))

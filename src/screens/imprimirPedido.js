import { supabase } from '../lib'
import { montarNotinha, imprimir } from '../print'

// Busca os pedidos, monta as notinhas só com itens da cozinha,
// marca como impressos e manda tudo para o RawBT de uma vez.
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

// retorna true se mandou algo para a impressora
export async function imprimirPedido(id, { reimpressao = false } = {}) {
  const conteudo = await montar([id], reimpressao)
  await marcarImpressos([id])
  if (!conteudo) return false
  imprimir(conteudo)
  return true
}

export async function reimprimirPendentes(ids) {
  if (!ids.length) return false
  const conteudo = await montar(ids, false)
  await marcarImpressos(ids)
  if (!conteudo) return false
  imprimir(conteudo)
  return true
}

# Comandas · Nosso Encontro

App de comandas para a espetaria Nosso Encontro: abrir comanda no celular, lançar pedidos,
imprimir a notinha da cozinha (impressora térmica Bluetooth via app RawBT no Android),
fechar conta com divisão e várias formas de pagamento, e relatórios diário/semanal/mensal.

- Front-end: React + Vite (PWA instalável)
- Banco/Auth/Tempo real: Supabase (projeto `nosso-encontro-comandas`)
- Deploy: Vercel

## Rodar local
npm install
npm run dev

## Impressão
Só itens de categorias marcadas como "Imprime na cozinha" saem na notinha
(Menu › Cardápio). No celular Android, instale o RawBT, pareie a impressora e
escolha-a nas configurações do RawBT.

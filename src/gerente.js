// Mantém a área do gerente liberada por 10 minutos depois do PIN
let liberadoAte = 0
export const gerenteLiberado = () => Date.now() < liberadoAte
export const liberarGerente = () => { liberadoAte = Date.now() + 10 * 60 * 1000 }
export const bloquearGerente = () => { liberadoAte = 0 }

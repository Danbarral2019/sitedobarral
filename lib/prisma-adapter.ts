/**
 * O driver serverless da Neon conversa com o banco por WebSocket, protocolo que
 * um PostgreSQL comum não atende. Banco local — desenvolvimento na máquina e o
 * banco de smoke do CI — precisa do driver TCP tradicional. Produção aponta
 * sempre para host da Neon e nunca cai neste ramo.
 */
export function usaDriverLocal(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;

  try {
    const { hostname } = new URL(databaseUrl);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    );
  } catch {
    // URL malformada não é decisão deste módulo: deixa o adaptador padrão
    // falhar com a mensagem dele, que diz mais do que um erro de parse aqui.
    return false;
  }
}

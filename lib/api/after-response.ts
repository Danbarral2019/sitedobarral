import { after } from 'next/server';

/**
 * Agenda uma promise para rodar APÓS a resposta HTTP ser enviada.
 *
 * Usa o `after()` do Next.js: na Vercel a função serverless é mantida viva
 * até o trabalho agendado concluir. Isso evita o bug de efeitos colaterais
 * "fire-and-forget" (ex.: gamificação de XP/badge) serem descartados quando
 * a função congela logo após o `return` — trabalho não-aguardado sem `after()`
 * NÃO tem garantia de execução em serverless.
 *
 * Fora de escopo de request (ex.: testes unitários), `after()` lança; nesse
 * caso caímos em `void promise` — sem a garantia pós-resposta, mas aceitável
 * porque as promises mockadas resolvem imediatamente.
 *
 * O caller deve passar uma promise que já trata seus próprios erros
 * (ex.: `.catch(log)`), pois este helper não anexa tratamento.
 */
export function runAfterResponse(promise: Promise<unknown>): void {
  try {
    after(promise);
  } catch {
    void promise;
  }
}

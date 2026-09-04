// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Testa o CONTRATO do schema, não o banco: estas garantias são as que as
// tasks seguintes assumem, e um `db push` acidental que as remova precisa
// quebrar a suíte, não a produção.
const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf-8');
const model = (nome: string) =>
  new RegExp(`model ${nome} \\{[\\s\\S]*?\\n\\}`).exec(schema)?.[0] ?? '';

describe('schema — teses', () => {
  it('TeseTrechoFonte é único por (enunciado, ordem) — garante idempotência', () => {
    expect(model('TeseTrechoFonte')).toContain('@@unique([enunciadoId, ordem])');
  });

  it('TeseTrechoFonte guarda caminhos para o inteiro teor além da relação', () => {
    const m = model('TeseTrechoFonte');
    expect(m).toContain('origemUrl');
    expect(m).toContain('origemLinkPDF');
    expect(m).toContain('onDelete: SetNull');
  });

  it('perder o Document do citante não apaga o trecho', () => {
    // Pega o onDelete efetivo da relação origemDocument (não uma substring
    // solta) — se alguém trocar SetNull por Cascade, ou remover onDelete, a
    // captura muda e a asserção quebra.
    const linha = /^\s*origemDocument\s+Document\?\s+@relation\([^)]*onDelete:\s*(\w+)/m.exec(
      model('TeseTrechoFonte')
    );
    expect(linha?.[1]).toBe('SetNull');
  });

  it('TeseDestilacao tem identidade oficial separada do enriquecimento', () => {
    const m = model('TeseDestilacao');
    expect(m).toContain('acordaoKey');
    expect(m).toContain('colegiadoAlvo');
    expect(m).toContain('relatorAlvo');
    expect(m).toContain('urlAlvo');
    // documentId/document são enriquecimento OPCIONAL — a identidade vem do
    // TCU (acordaoKey), não do Document. Se alguém tornar o campo
    // obrigatório, o "?" some e a asserção quebra.
    expect(/documentId\s+String\?/.test(m)).toBe(true);
    expect(/document\s+Document\?/.test(m)).toBe(true);
  });

  it('TeseEnunciado separa estado editorial da versão', () => {
    const m = model('TeseEnunciado');
    for (const campo of ['publicado', 'vitrinePublica', 'retiradoEm', 'retiradoMotivo', 'atualizadoEm', 'embeddingStatus']) {
      expect(m).toContain(campo);
    }
  });

  it('atualizadoEm tem @default(now()) — sem ele, o db push numa tabela com dados pede reset, não só --accept-data-loss', () => {
    // @updatedAt sozinho é resolvido no client do Prisma, não no banco: um
    // NOT NULL sem default não teria como preencher as linhas já existentes.
    const linha = /^\s*atualizadoEm\s+DateTime\s+(@\S+(?:\([^)]*\))?\s*)+$/m.exec(
      model('TeseEnunciado')
    );
    expect(linha?.[0]).toContain('@default(now())');
    expect(linha?.[0]).toContain('@updatedAt');
  });
});

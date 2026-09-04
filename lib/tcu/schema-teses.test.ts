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
    expect(model('TeseTrechoFonte')).not.toContain('onDelete: Cascade\n  origemDocument');
  });

  it('TeseDestilacao tem identidade oficial separada do enriquecimento', () => {
    const m = model('TeseDestilacao');
    expect(m).toContain('acordaoKey');
    expect(m).toContain('colegiadoAlvo');
    expect(m).toContain('documentId');
  });

  it('TeseEnunciado separa estado editorial da versão', () => {
    const m = model('TeseEnunciado');
    for (const campo of ['publicado', 'vitrinePublica', 'retiradoEm', 'retiradoMotivo', 'atualizadoEm', 'embeddingStatus']) {
      expect(m).toContain(campo);
    }
  });
});

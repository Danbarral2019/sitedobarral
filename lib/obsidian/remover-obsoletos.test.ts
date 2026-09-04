// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'path';

const { mockReaddir, mockRm } = vi.hoisted(() => ({ mockReaddir: vi.fn(), mockRm: vi.fn() }));
vi.mock('fs/promises', async () => {
  const real = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return { ...real, readdir: (...a: unknown[]) => mockReaddir(...a), rm: (...a: unknown[]) => mockRm(...a) };
});

import { removerObsoletos } from './export';
import { caminhoTese, type DestilacaoParaExport } from './tese-md';

describe('removerObsoletos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRm.mockResolvedValue(undefined);
  });

  it('remove o que não está no conjunto esperado', async () => {
    mockReaddir.mockResolvedValue(['a.md', 'b.md', 'c.md']);
    const removidos = await removerObsoletos('/destino', 'teses', new Set(['teses/a.md', 'teses/c.md']), false);
    expect(removidos).toEqual(['b.md']);
    expect(mockRm).toHaveBeenCalledTimes(1);
    expect(String(mockRm.mock.calls[0][0])).toContain('b.md');
  });

  it('não remove nada quando tudo é esperado', async () => {
    mockReaddir.mockResolvedValue(['a.md']);
    const removidos = await removerObsoletos('/destino', 'teses', new Set(['teses/a.md']), false);
    expect(removidos).toEqual([]);
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('dry-run lista o que seria removido, sem remover', async () => {
    mockReaddir.mockResolvedValue(['a.md', 'b.md']);
    const removidos = await removerObsoletos('/destino', 'teses', new Set(['teses/a.md']), true);
    // A §8.2 exige que o dry-run LISTE, não só conte: o usuário confere aqui
    // antes de deixar apagar de verdade, e um número não diz quais arquivos.
    expect(removidos).toEqual(['b.md']);
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('diretório inexistente não é erro', async () => {
    mockReaddir.mockRejectedValue(Object.assign(new Error('nope'), { code: 'ENOENT' }));
    await expect(removerObsoletos('/destino', 'teses', new Set(), false)).resolves.toEqual([]);
  });

  it('ignora arquivo que não termina em .md', async () => {
    mockReaddir.mockResolvedValue(['a.md', 'leia-me.txt']);
    const removidos = await removerObsoletos('/destino', 'teses', new Set(['teses/a.md']), false);
    expect(removidos).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // Segurança de escopo — a razão de existir desta função.
  //
  // O destino é uma pasta do OneDrive de trabalho com material de outras
  // origens: escapar do subdiretório recebido destruiria arquivo de
  // terceiro, sem desfazer. As três asserções abaixo travam, uma a uma, as
  // três formas óbvias de uma implementação escapar — cada uma delas foi
  // injetada manualmente e confirmada como capaz de derrubar este teste
  // (ver task-3-report.md, seção "Confirmação por injeção de bug").
  // ---------------------------------------------------------------------
  it('não escapa do subdiretório: readdir sem recursão, rm com caminho exato e sem opções perigosas', async () => {
    mockReaddir.mockResolvedValue(['b.md']);
    await removerObsoletos('/destino', 'teses', new Set(), false);

    // 1. readdir lê SÓ o subdiretório recebido, sem varrer recursivamente.
    //    `toHaveBeenCalledWith` de um único argumento falha se a chamada
    //    real também passou `{ recursive: true }` como segundo argumento.
    expect(mockReaddir).toHaveBeenCalledWith(join('/destino', 'teses'));

    // 2. rm recebe o caminho EXATO dentro do subdiretório — não
    //    `outputDir` direto (que apagaria fora de `teses/`) e não um
    //    caminho livre montado por fora.
    expect(mockRm).toHaveBeenCalledWith(join('/destino', 'teses', 'b.md'));

    // 3. rm é chamado com um único argumento: sem `{ recursive: true }`
    //    nem `{ force: true }`, que alcançariam diretórios inteiros ou
    //    silenciariam erro de apagar algo que não deveria.
    expect(mockRm.mock.calls[0]).toEqual([join('/destino', 'teses', 'b.md')]);
  });

  // ---------------------------------------------------------------------
  // Acoplamento do separador de caminho entre os dois lados.
  //
  // `caminhoTese` monta `teses/x.md` com barra literal e `removerObsoletos`
  // compara com `${subdiretorio}/${nome}`, também literal. Os dois lados
  // nunca se encontram através de `path`: é uma convenção de string
  // acordada entre dois arquivos. Cada um era travado por uma string
  // literal em um arquivo de teste SEPARADO, e nenhum teste alimentava a
  // saída de um na entrada do outro.
  //
  // Trocar qualquer um dos dois por `path.join()` passa verde no CI
  // (`ubuntu-latest`, onde `join('teses','x.md') === 'teses/x.md'`) e só
  // quebra no Windows — que é onde o script roda, e onde o efeito seria
  // as chaves não casarem e a remoção apagar TODOS os arquivos que a
  // exportação acabou de escrever.
  //
  // Este teste falha nas duas direções da divergência, em qualquer
  // plataforma, porque usa a saída real de `caminhoTese` como esperado.
  // ---------------------------------------------------------------------
  it('o caminho gerado por caminhoTese é reconhecido por removerObsoletos', async () => {
    const caminho = caminhoTese({
      numeroAlvo: 1441,
      anoAlvo: 2016,
      colegiadoAlvo: 'Plenário',
    } as DestilacaoParaExport);
    // O basename como o `readdir` do subdiretório o devolveria — separador
    // qualquer que seja, é sempre o último componente.
    const nome = caminho.slice(Math.max(caminho.lastIndexOf('/'), caminho.lastIndexOf('\\')) + 1);
    mockReaddir.mockResolvedValue([nome]);

    const removidos = await removerObsoletos('/destino', 'teses', new Set([caminho]), false);

    expect(removidos).toEqual([]);
    expect(mockRm).not.toHaveBeenCalled();
  });
});

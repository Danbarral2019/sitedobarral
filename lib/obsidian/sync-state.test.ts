import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { readSyncState, writeSyncState, VAULT_OBSIDIAN_PADRAO } from './sync-state';

let raiz: string;
const OUTRO_VAULT = 'C:/Users/User/OneDrive - AGU/Elic - uniformização/20-Referencia - Base do Site do Barral';

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'sync-state-'));
});
afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe('estado por destino', () => {
  it('não mistura o estado de dois vaults', async () => {
    await writeSyncState(raiz, VAULT_OBSIDIAN_PADRAO, { lastExportAt: '2026-01-01T00:00:00.000Z' });
    await writeSyncState(raiz, OUTRO_VAULT, { lastExportAt: '2026-08-14T00:00:00.000Z' });

    expect((await readSyncState(raiz, VAULT_OBSIDIAN_PADRAO)).lastExportAt).toBe('2026-01-01T00:00:00.000Z');
    expect((await readSyncState(raiz, OUTRO_VAULT)).lastExportAt).toBe('2026-08-14T00:00:00.000Z');
  });

  it('escrever num vault preserva o estado do outro', async () => {
    await writeSyncState(raiz, VAULT_OBSIDIAN_PADRAO, { lastImportAt: '2026-02-02T00:00:00.000Z' });
    await writeSyncState(raiz, OUTRO_VAULT, { lastExportAt: '2026-08-14T00:00:00.000Z' });

    expect((await readSyncState(raiz, VAULT_OBSIDIAN_PADRAO)).lastImportAt).toBe('2026-02-02T00:00:00.000Z');
  });

  it('trata o mesmo caminho escrito de formas diferentes como um só vault', async () => {
    await writeSyncState(raiz, 'C:/Users/User/Cofre/Site', { lastExportAt: '2026-03-03T00:00:00.000Z' });

    const lido = await readSyncState(raiz, 'C:\\Users\\User\\Cofre\\Site');

    expect(lido.lastExportAt).toBe('2026-03-03T00:00:00.000Z');
  });

  it('vault nunca exportado começa zerado', async () => {
    await writeSyncState(raiz, VAULT_OBSIDIAN_PADRAO, { lastExportAt: '2026-01-01T00:00:00.000Z' });

    const novo = await readSyncState(raiz, OUTRO_VAULT);

    expect(novo).toEqual({ lastExportAt: null, lastImportAt: null, exportStats: null });
  });
});

describe('compatibilidade com o arquivo de estado antigo', () => {
  const ANTIGO = {
    lastExportAt: '2026-07-01T00:00:00.000Z',
    lastImportAt: '2026-07-02T00:00:00.000Z',
    exportStats: { documents: 10, acts: 2, decisions: 3 },
  };

  it('lê o formato antigo como estado do cofre do Obsidian', async () => {
    await writeFile(join(raiz, '.obsidian-sync-state.json'), JSON.stringify(ANTIGO), 'utf-8');

    const lido = await readSyncState(raiz, VAULT_OBSIDIAN_PADRAO);

    expect(lido.lastExportAt).toBe('2026-07-01T00:00:00.000Z');
    expect(lido.exportStats).toEqual({ documents: 10, acts: 2, decisions: 3 });
  });

  it('não empresta o estado antigo para um vault novo', async () => {
    await writeFile(join(raiz, '.obsidian-sync-state.json'), JSON.stringify(ANTIGO), 'utf-8');

    const lido = await readSyncState(raiz, OUTRO_VAULT);

    expect(lido.lastExportAt).toBeNull();
  });

  it('migra o formato antigo ao gravar, sem perder o histórico do cofre', async () => {
    await writeFile(join(raiz, '.obsidian-sync-state.json'), JSON.stringify(ANTIGO), 'utf-8');

    await writeSyncState(raiz, OUTRO_VAULT, { lastExportAt: '2026-08-14T00:00:00.000Z' });

    const salvo = JSON.parse(await readFile(join(raiz, '.obsidian-sync-state.json'), 'utf-8'));
    expect(salvo.vaults).toBeDefined();
    expect((await readSyncState(raiz, VAULT_OBSIDIAN_PADRAO)).lastExportAt).toBe('2026-07-01T00:00:00.000Z');
  });
});

import { readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

const STATE_FILENAME = '.obsidian-sync-state.json';

/**
 * Cofre do Obsidian — destino histórico e único até 08/2026, quando a base
 * passou a ser exportada também para a pasta do ELIC.
 */
export const VAULT_OBSIDIAN_PADRAO = 'C:/Users/User/projetos/Cofre do obsidian/Site do Barral';

export interface VaultState {
  lastExportAt: string | null;
  lastImportAt: string | null;
  exportStats: {
    documents: number;
    acts: number;
    decisions: number;
  } | null;
}

/**
 * O estado é POR DESTINO. Um `lastExportAt` global fazia a exportação para um
 * vault marcar como exportadas mudanças que o outro nunca recebeu — o segundo
 * destino entrava em modo incremental e pulava tudo, ficando desatualizado sem
 * emitir sinal nenhum.
 */
interface SyncStateFile {
  vaults: Record<string, VaultState>;
}

function estadoVazio(): VaultState {
  return { lastExportAt: null, lastImportAt: null, exportStats: null };
}

/**
 * Chave estável para o mesmo diretório escrito de formas diferentes: o Windows
 * aceita `/` e `\` e não diferencia caixa, então sem normalizar o mesmo vault
 * geraria duas entradas e o incremental se perderia.
 */
function chaveDoVault(vaultPath: string): string {
  return resolve(vaultPath).replace(/\\/g, '/').toLowerCase();
}

/**
 * Aceita o formato antigo (campos na raiz, um único vault implícito) e o
 * converte atribuindo o histórico ao cofre do Obsidian, que era o único destino
 * quando aquele arquivo foi escrito. Sem isso o primeiro sync após a mudança
 * viraria um full export desnecessário.
 */
function normalizar(bruto: unknown): SyncStateFile {
  if (bruto === null || typeof bruto !== 'object') return { vaults: {} };
  const obj = bruto as Record<string, unknown>;

  if (obj.vaults && typeof obj.vaults === 'object') {
    return { vaults: obj.vaults as Record<string, VaultState> };
  }

  if ('lastExportAt' in obj || 'lastImportAt' in obj || 'exportStats' in obj) {
    return {
      vaults: {
        [chaveDoVault(VAULT_OBSIDIAN_PADRAO)]: { ...estadoVazio(), ...(obj as Partial<VaultState>) },
      },
    };
  }

  return { vaults: {} };
}

async function lerArquivo(projectRoot: string): Promise<SyncStateFile> {
  try {
    return normalizar(JSON.parse(await readFile(join(projectRoot, STATE_FILENAME), 'utf-8')));
  } catch {
    return { vaults: {} };
  }
}

export async function readSyncState(projectRoot: string, vaultPath: string): Promise<VaultState> {
  const arquivo = await lerArquivo(projectRoot);
  return { ...estadoVazio(), ...arquivo.vaults[chaveDoVault(vaultPath)] };
}

export async function writeSyncState(
  projectRoot: string,
  vaultPath: string,
  state: Partial<VaultState>,
): Promise<void> {
  const arquivo = await lerArquivo(projectRoot);
  const chave = chaveDoVault(vaultPath);
  arquivo.vaults[chave] = { ...estadoVazio(), ...arquivo.vaults[chave], ...state };
  await writeFile(join(projectRoot, STATE_FILENAME), JSON.stringify(arquivo, null, 2) + '\n', 'utf-8');
}

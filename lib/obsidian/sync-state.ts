import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const STATE_FILENAME = '.obsidian-sync-state.json';

export interface SyncState {
  lastExportAt: string | null;
  lastImportAt: string | null;
  exportStats: {
    documents: number;
    acts: number;
    decisions: number;
  } | null;
}

function defaultState(): SyncState {
  return {
    lastExportAt: null,
    lastImportAt: null,
    exportStats: null,
  };
}

export async function readSyncState(projectRoot: string): Promise<SyncState> {
  const filePath = join(projectRoot, STATE_FILENAME);
  try {
    const raw = await readFile(filePath, 'utf-8');
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

export async function writeSyncState(
  projectRoot: string,
  state: Partial<SyncState>,
): Promise<void> {
  const filePath = join(projectRoot, STATE_FILENAME);
  const current = await readSyncState(projectRoot);
  const merged = { ...current, ...state };
  await writeFile(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
}

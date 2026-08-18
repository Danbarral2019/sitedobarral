// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBaixar } = vi.hoisted(() => ({ mockBaixar: vi.fn() }));

vi.mock('../consulta', () => ({
  baixar: (...a: unknown[]) => mockBaixar(...a),
  RespostaBloqueadaError: class extends Error {},
}));

import { listarDumps } from '../catalogo';

const RESPOSTA_CKAN = JSON.stringify({
  result: {
    results: [
      {
        name: 'espelhos-de-acordaos-primeira-secao',
        resources: [
          { name: '20260630.json', format: 'JSON', url: 'https://x/20260630.json' },
          { name: '20260531.json', format: 'JSON', url: 'https://x/20260531.json' },
          { name: 'tudo.zip', format: 'ZIP', url: 'https://x/tudo.zip' },
          { name: '20260430.csv', format: 'CSV', url: 'https://x/20260430.csv' },
        ],
      },
    ],
  },
});

beforeEach(() => mockBaixar.mockReset());

describe('listarDumps', () => {
  it('devolve só os recursos JSON', async () => {
    mockBaixar.mockResolvedValue(RESPOSTA_CKAN);
    const dumps = await listarDumps('espelhos-de-acordaos-primeira-secao');
    expect(dumps.map((d) => d.nome)).toEqual(['20260630.json', '20260531.json']);
  });

  it('ordena do mais recente para o mais antigo', async () => {
    mockBaixar.mockResolvedValue(RESPOSTA_CKAN);
    const dumps = await listarDumps('espelhos-de-acordaos-primeira-secao');
    expect(dumps[0].nome).toBe('20260630.json');
  });

  it('usa package_search, não package_show — package_show é rejeitada pelo WAF', async () => {
    mockBaixar.mockResolvedValue(RESPOSTA_CKAN);
    await listarDumps('espelhos-de-acordaos-primeira-secao');
    const urlChamada = String(mockBaixar.mock.calls[0][0]);
    expect(urlChamada).toContain('package_search');
    expect(urlChamada).not.toContain('package_show');
  });

  it('devolve lista vazia quando o dataset não existe', async () => {
    mockBaixar.mockResolvedValue(JSON.stringify({ result: { results: [] } }));
    expect(await listarDumps('inexistente')).toEqual([]);
  });
});

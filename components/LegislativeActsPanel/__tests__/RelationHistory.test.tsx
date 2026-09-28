// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RelationHistory } from '../RelationHistory';

const baseRel = {
  id: 'r1',
  relationType: 'altera',
  excerpt: 'altera o art. 75 da Lei nº 14.133',
  confidence: 0.85,
  reviewStatus: 'confirmed',
};

describe('RelationHistory', () => {
  it('não renderiza nada quando não há relações', () => {
    const { container } = render(<RelationHistory alters={[]} alteredBy={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renderiza atos que este ato altera, com o verbo ativo', () => {
    render(<RelationHistory
      alters={[{ ...baseRel, targetAct: { id: 'a1', fullNumber: 'Lei 14.133/2021', title: 'Nova Lei de Licitações', hierarchyLevel: 1 } }]}
      alteredBy={[]}
    />);
    expect(screen.getByText(/atos afetados por este/i)).toBeTruthy();
    expect(screen.getByText('altera')).toBeTruthy();
    expect(screen.getByText('Lei 14.133/2021')).toBeTruthy();
    expect(screen.getByText(/nova lei de licitações/i)).toBeTruthy();
    expect(screen.getByText(/identificadas automaticamente/i)).toBeTruthy();
  });

  it('renderiza atos que alteram este ato, com o verbo passivo', () => {
    render(<RelationHistory
      alters={[]}
      alteredBy={[{ ...baseRel, sourceAct: { id: 'a2', fullNumber: 'Decreto 12.926/2026', title: 'Atualização', hierarchyLevel: 2 } }]}
    />);
    expect(screen.getByText(/atos que afetam este/i)).toBeTruthy();
    expect(screen.getByText('alterado por')).toBeTruthy();
    expect(screen.getByText('Decreto 12.926/2026')).toBeTruthy();
  });

  it('não expõe o estado interno de revisão', () => {
    render(<RelationHistory
      alters={[{ ...baseRel, reviewStatus: 'pending', targetAct: { id: 'a3', fullNumber: 'Lei X', title: 't', hierarchyLevel: 1 } }]}
      alteredBy={[]}
    />);
    expect(screen.queryByText(/pendente/i)).toBeNull();
    expect(screen.getByText('Lei X')).toBeTruthy();
  });

  it('omite a epígrafe repetida no título do outro ato', () => {
    render(<RelationHistory
      alters={[{ ...baseRel, targetAct: { id: 'a4', fullNumber: 'Decreto 7.404/2010', title: 'DECRETO Nº\n7.404,\nDE 23 DE DEZEMBRO DE 2010.', hierarchyLevel: 2 } }]}
      alteredBy={[]}
      currentHierarchyLevel={2}
    />);
    expect(screen.queryByText(/DE 23 DE DEZEMBRO/)).toBeNull();
  });

  it('omite relação atípica: IN (h=4) "altera" Lei (h=1)', () => {
    const { container } = render(<RelationHistory
      alters={[]}
      alteredBy={[{ ...baseRel, sourceAct: { id: 's1', fullNumber: 'IN SEGES 1/2024', title: 'IN qualquer', hierarchyLevel: 4 } }]}
      currentHierarchyLevel={1}
    />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByText(/atípico/i)).toBeNull();
  });

  it('mantém Decreto (h=2) que altera outro Decreto (h=2)', () => {
    render(<RelationHistory
      alters={[{ ...baseRel, targetAct: { id: 't1', fullNumber: 'Decreto X', title: 't', hierarchyLevel: 2 } }]}
      alteredBy={[]}
      currentHierarchyLevel={2}
    />);
    expect(screen.getByText('Decreto X')).toBeTruthy();
  });

  it('omite Lei (h=1) que "regulamenta" Decreto (h=2), direção inversa', () => {
    render(<RelationHistory
      alters={[{ ...baseRel, relationType: 'regulamenta', targetAct: { id: 't2', fullNumber: 'Decreto X', title: 't', hierarchyLevel: 2 } }]}
      alteredBy={[{ ...baseRel, id: 'r2', sourceAct: { id: 't3', fullNumber: 'Lei Y', title: 't', hierarchyLevel: 1 } }]}
      currentHierarchyLevel={1}
    />);
    expect(screen.queryByText('Decreto X')).toBeNull();
    expect(screen.getByText('Lei Y')).toBeTruthy();
  });
});

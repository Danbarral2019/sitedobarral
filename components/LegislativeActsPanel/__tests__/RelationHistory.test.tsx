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
  it('mostra placeholder quando não há relações', () => {
    render(<RelationHistory alters={[]} alteredBy={[]} />);
    expect(screen.getByText(/sem relações detectadas/i)).toBeTruthy();
  });

  it('renderiza atos que este ato altera', () => {
    render(<RelationHistory
      alters={[{ ...baseRel, targetAct: { id: 'a1', fullNumber: 'Lei 14.133/2021', title: 'Nova Lei de Licitações', hierarchyLevel: 1 } }]}
      alteredBy={[]}
    />);
    expect(screen.getByText(/este ato afeta os seguintes atos/i)).toBeTruthy();
    expect(screen.getByText('Lei 14.133/2021')).toBeTruthy();
    expect(screen.getByText(/nova lei de licitações/i)).toBeTruthy();
  });

  it('renderiza atos que alteram este ato', () => {
    render(<RelationHistory
      alters={[]}
      alteredBy={[{ ...baseRel, sourceAct: { id: 'a2', fullNumber: 'Decreto 12.926/2026', title: 'Atualização', hierarchyLevel: 2 } }]}
    />);
    expect(screen.getByText(/é afetado pelos seguintes atos/i)).toBeTruthy();
    expect(screen.getByText('Decreto 12.926/2026')).toBeTruthy();
  });

  it('mostra badge "pending" pra relações não-confirmadas', () => {
    render(<RelationHistory
      alters={[{ ...baseRel, reviewStatus: 'pending', targetAct: { id: 'a3', fullNumber: 'Lei X', title: 't', hierarchyLevel: 1 } }]}
      alteredBy={[]}
    />);
    expect(screen.getByText(/pendente/i)).toBeTruthy();
  });

  it('mostra badge "atípico" quando IN (h=4) "altera" Lei (h=1)', () => {
    render(<RelationHistory
      alters={[]}
      alteredBy={[{ ...baseRel, sourceAct: { id: 's1', fullNumber: 'IN SEGES 1/2024', title: 'IN qualquer', hierarchyLevel: 4 } }]}
      currentHierarchyLevel={1}
    />);
    expect(screen.getByText(/atípico/i)).toBeTruthy();
  });

  it('NÃO mostra "atípico" quando Decreto (h=2) altera outro Decreto (h=2)', () => {
    render(<RelationHistory
      alters={[{ ...baseRel, targetAct: { id: 't1', fullNumber: 'Decreto X', title: 't', hierarchyLevel: 2 } }]}
      alteredBy={[]}
      currentHierarchyLevel={2}
    />);
    expect(screen.queryByText(/atípico/i)).toBeNull();
  });

  it('mostra "atípico" quando Lei (h=1) "regulamenta" Decreto (h=2) — direção inversa', () => {
    render(<RelationHistory
      alters={[{ ...baseRel, relationType: 'regulamenta', targetAct: { id: 't2', fullNumber: 'Decreto X', title: 't', hierarchyLevel: 2 } }]}
      alteredBy={[]}
      currentHierarchyLevel={1}
    />);
    expect(screen.getByText(/atípico/i)).toBeTruthy();
  });
});

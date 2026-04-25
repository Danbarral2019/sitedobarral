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
      alters={[{ ...baseRel, targetAct: { fullNumber: 'Lei 14.133/2021', title: 'Nova Lei de Licitações' } }]}
      alteredBy={[]}
    />);
    expect(screen.getByText(/este ato altera/i)).toBeTruthy();
    expect(screen.getByText('Lei 14.133/2021')).toBeTruthy();
    expect(screen.getByText(/nova lei de licitações/i)).toBeTruthy();
  });

  it('renderiza atos que alteram este ato', () => {
    render(<RelationHistory
      alters={[]}
      alteredBy={[{ ...baseRel, sourceAct: { fullNumber: 'Decreto 12.926/2026', title: 'Atualização' } }]}
    />);
    expect(screen.getByText(/foi alterado por/i)).toBeTruthy();
    expect(screen.getByText('Decreto 12.926/2026')).toBeTruthy();
  });

  it('mostra badge "pending" pra relações não-confirmadas', () => {
    render(<RelationHistory
      alters={[{ ...baseRel, reviewStatus: 'pending', targetAct: { fullNumber: 'Lei X', title: 't' } }]}
      alteredBy={[]}
    />);
    expect(screen.getByText(/pendente/i)).toBeTruthy();
  });
});

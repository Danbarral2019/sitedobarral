/**
 * Testes para lib/dou-normative-filter.ts
 *
 * Testa classificação de atos normativos:
 * - isAtoNormativoGeral, shouldAutoApprove, detectAtoType, isProcurementRelated
 */

import { describe, it, expect } from 'vitest';
import {
  isAtoNormativoGeral,
  shouldAutoApprove,
  detectAtoType,
  isProcurementRelated,
} from '../dou-normative-filter';

describe('dou-normative-filter', () => {
  describe('detectAtoType', () => {
    it('deve detectar decreto', () => {
      expect(detectAtoType('Decreto nº 12.000/2025')).toBe('decreto');
    });

    it('deve detectar lei federal', () => {
      expect(detectAtoType('Lei nº 14.133/2021')).toBe('lei');
    });

    it('deve detectar lei complementar', () => {
      expect(detectAtoType('Lei Complementar nº 101')).toBe('lei');
    });

    it('deve detectar medida provisória', () => {
      expect(detectAtoType('Medida Provisória nº 1.234')).toBe('mp');
    });

    it('deve detectar medida provisoria sem acento', () => {
      expect(detectAtoType('Medida Provisoria nº 500')).toBe('mp');
    });

    it('deve detectar instrução normativa', () => {
      expect(detectAtoType('Instrução Normativa SEGES nº 98')).toBe('in');
    });

    it('deve detectar IN por sigla', () => {
      expect(detectAtoType('IN SEGES nº 73/2022')).toBe('in');
    });

    it('deve detectar orientação normativa', () => {
      expect(detectAtoType('Orientação Normativa AGU nº 55')).toBe('on');
    });

    it('deve detectar ON por sigla', () => {
      expect(detectAtoType('ON AGU nº 41/2014')).toBe('on');
    });

    it('deve detectar portaria', () => {
      expect(detectAtoType('Portaria nº 443/2025')).toBe('portaria');
    });

    it('deve retornar null para texto sem tipo', () => {
      expect(detectAtoType('Comunicado Geral nº 5')).toBeNull();
    });

    it('deve retornar null para texto vazio', () => {
      expect(detectAtoType('')).toBeNull();
    });
  });

  describe('isAtoNormativoGeral', () => {
    // Atos concretos
    it('deve classificar "designar servidor" como concreto', () => {
      expect(isAtoNormativoGeral('Portaria nº 100', 'designar servidor para...')).toBe('concreto');
    });

    it('deve classificar extrato como concreto', () => {
      expect(isAtoNormativoGeral('Extrato de Contrato', 'Extrato de contrato celebrado')).toBe('concreto');
    });

    it('deve classificar edital no título como concreto', () => {
      expect(isAtoNormativoGeral('Edital nº 01/2025', 'Texto do edital')).toBe('concreto');
    });

    it('deve classificar aviso no título como concreto', () => {
      expect(isAtoNormativoGeral('Aviso de Licitação', 'Aviso de dispensa')).toBe('concreto');
    });

    it('deve classificar despacho no título como concreto', () => {
      expect(isAtoNormativoGeral('Despacho do Secretário', 'Texto')).toBe('concreto');
    });

    it('deve classificar retificação no título como concreto', () => {
      expect(isAtoNormativoGeral('Retificação nº 5', 'Retifica publicação anterior')).toBe('concreto');
    });

    // Atos normativos gerais
    it('deve classificar "regulamenta" como geral', () => {
      expect(isAtoNormativoGeral('Decreto nº 12.000', 'Regulamenta a Lei 14.133')).toBe('geral');
    });

    it('deve classificar "dispõe sobre" como geral', () => {
      expect(isAtoNormativoGeral('Portaria nº 443', 'Dispõe sobre procedimentos de licitação')).toBe('geral');
    });

    it('deve classificar "estabelece normas" como geral', () => {
      expect(isAtoNormativoGeral('IN nº 98', 'Estabelece normas para contratações')).toBe('geral');
    });

    it('deve classificar "institui" como geral', () => {
      expect(isAtoNormativoGeral('Decreto nº 11.000', 'Institui o programa de compras')).toBe('geral');
    });

    it('deve classificar "altera o decreto" como geral', () => {
      expect(isAtoNormativoGeral('Decreto nº 12.001', 'Altera o Decreto nº 11.462')).toBe('geral');
    });

    // Ambíguos
    it('deve classificar como ambíguo quando tem indicadores de ambos', () => {
      expect(isAtoNormativoGeral(
        'Portaria nº 500',
        'Regulamenta procedimentos e designar servidor como gestor de contrato'
      )).toBe('ambiguo');
    });

    // Sem indicadores - inferir pelo tipo
    it('deve classificar decreto sem indicadores como geral', () => {
      expect(isAtoNormativoGeral('Decreto nº 12.345', 'Texto genérico sem indicadores')).toBe('geral');
    });

    it('deve classificar lei sem indicadores como geral', () => {
      expect(isAtoNormativoGeral('Lei nº 15.000', 'Texto genérico')).toBe('geral');
    });

    it('deve classificar IN sem indicadores como geral', () => {
      expect(isAtoNormativoGeral('Instrução Normativa nº 100', 'Texto genérico')).toBe('geral');
    });

    it('deve classificar ON sem indicadores como geral', () => {
      expect(isAtoNormativoGeral('Orientação Normativa nº 55', 'Texto genérico')).toBe('geral');
    });

    it('deve classificar texto completamente genérico como ambíguo', () => {
      expect(isAtoNormativoGeral('Comunicado nº 5', 'Informamos a todos')).toBe('ambiguo');
    });

    it('deve remover HTML do título antes de verificar padrões', () => {
      expect(isAtoNormativoGeral('<b>Edital</b> nº 01', 'Texto')).toBe('concreto');
    });
  });

  describe('shouldAutoApprove', () => {
    it('deve auto-aprovar decreto da Presidência', () => {
      expect(shouldAutoApprove(
        'Decreto nº 12.000',
        'Presidência da República / Casa Civil',
        'decreto'
      )).toBe(true);
    });

    it('deve auto-aprovar portaria da SEGES', () => {
      expect(shouldAutoApprove(
        'Portaria nº 443',
        'Secretaria de Gestão e Inovação / MGI',
        'portaria'
      )).toBe(true);
    });

    it('deve auto-aprovar IN da SEGES', () => {
      expect(shouldAutoApprove(
        'IN SEGES nº 73',
        'Ministério da Gestão e da Inovação',
        'in'
      )).toBe(true);
    });

    it('deve auto-aprovar ON quando autoridade é MGI', () => {
      expect(shouldAutoApprove(
        'ON nº 55',
        'Ministério da Gestão e da Inovação',
        'on'
      )).toBe(true);
    });

    it('NÃO deve auto-aprovar decreto de ministério', () => {
      expect(shouldAutoApprove(
        'Decreto nº 100',
        'Ministério da Saúde',
        'decreto'
      )).toBe(false);
    });

    it('NÃO deve auto-aprovar portaria de outro ministério', () => {
      expect(shouldAutoApprove(
        'Portaria nº 200',
        'Ministério da Educação',
        'portaria'
      )).toBe(false);
    });

    it('deve retornar false para tipo null', () => {
      expect(shouldAutoApprove('Título', 'Hierarchy', null)).toBe(false);
    });

    it('deve auto-aprovar quando autoridade está no título', () => {
      expect(shouldAutoApprove(
        'Decreto do Presidente da República nº 12.000',
        'Governo Federal',
        'decreto'
      )).toBe(true);
    });
  });

  describe('isProcurementRelated', () => {
    it('deve retornar true para título com "licitação"', () => {
      expect(isProcurementRelated('Portaria sobre Licitação', '')).toBe(true);
    });

    it('deve retornar true para título com "contratação"', () => {
      expect(isProcurementRelated('Normas de Contratação Pública', '')).toBe(true);
    });

    it('deve retornar true para referência à Lei 14.133', () => {
      expect(isProcurementRelated('Portaria nº 443', 'Regulamenta a Lei 14.133')).toBe(true);
    });

    it('deve retornar true para "pregão"', () => {
      expect(isProcurementRelated('Regulamento de Pregão Eletrônico', '')).toBe(true);
    });

    it('deve retornar true para "dispensa de licitação"', () => {
      expect(isProcurementRelated('Norma', 'Regulamenta dispensa de licitação')).toBe(true);
    });

    it('deve retornar true para "registro de preços"', () => {
      expect(isProcurementRelated('Norma', 'Estabelece regras para registro de preços')).toBe(true);
    });

    it('deve retornar true para "gestão de contratos"', () => {
      expect(isProcurementRelated('Portaria nº 100', 'Regras de gestão de contratos')).toBe(true);
    });

    it('deve retornar true para "sanção administrativa"', () => {
      expect(isProcurementRelated('Portaria', 'Dispõe sobre sanção administrativa')).toBe(true);
    });

    it('deve retornar true para órgão SEGES na hierarquia', () => {
      expect(isProcurementRelated('Portaria nº 100', 'Texto genérico', 'SEGES/MGI')).toBe(true);
    });

    it('deve retornar true para órgão AGU na hierarquia', () => {
      expect(isProcurementRelated('Orientação', 'Texto', 'Advocacia-Geral da União')).toBe(true);
    });

    it('deve retornar true para órgão MGI na hierarquia', () => {
      expect(isProcurementRelated('Portaria', 'Texto', 'Ministério da Gestão')).toBe(true);
    });

    it('deve retornar false para tema não relacionado', () => {
      expect(isProcurementRelated('Portaria de Saúde', 'Regulamenta vacinação', 'Ministério da Saúde')).toBe(false);
    });

    it('deve retornar false para título e abstract vazios', () => {
      expect(isProcurementRelated('', '')).toBe(false);
    });

    it('deve funcionar sem abstract e hierarchy', () => {
      expect(isProcurementRelated('Regras de Licitações', undefined, undefined)).toBe(true);
    });

    it('deve retornar true para "compras públicas" no abstract', () => {
      expect(isProcurementRelated('Portaria nº 500', 'Regulamenta compras públicas')).toBe(true);
    });
  });
});

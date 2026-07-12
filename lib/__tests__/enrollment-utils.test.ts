/**
 * Testes para lib/enrollment-utils.ts
 *
 * Testa funções puras de gerenciamento de matrículas:
 * - checkAccessStatus, getAccessStatusMessage, getAccessStatusColor, shouldSendExpirationNotification
 */

import { describe, it, expect } from 'vitest';
import {
  checkAccessStatus,
  getAccessStatusMessage,
  getAccessStatusColor,
  shouldSendExpirationNotification,
  checkSubscriptionAccess,
  getActivePlan,
  Enrollment,
  AccessStatus,
  SubscriptionInfo,
} from '../enrollment-utils';

// Helper para criar datas relativas ao hoje
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function makeEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: 'enroll-1',
    courseId: 'course-1',
    expiresAt: daysFromNow(180),
    isLifetime: false,
    ...overrides,
  };
}

describe('enrollment-utils', () => {
  describe('checkAccessStatus', () => {
    it('deve retornar sem acesso para enrollment null', () => {
      const status = checkAccessStatus(null);
      expect(status.hasAccess).toBe(false);
      expect(status.isExpired).toBe(false);
      expect(status.isLifetime).toBe(false);
      expect(status.daysRemaining).toBeNull();
      expect(status.expiresAt).toBeNull();
      expect(status.isExpiringSoon).toBe(false);
    });

    it('deve retornar acesso vitalício', () => {
      const enrollment = makeEnrollment({ isLifetime: true });
      const status = checkAccessStatus(enrollment);
      expect(status.hasAccess).toBe(true);
      expect(status.isLifetime).toBe(true);
      expect(status.isExpired).toBe(false);
      expect(status.daysRemaining).toBeNull();
      expect(status.isExpiringSoon).toBe(false);
    });

    it('deve retornar acesso ativo sem data de expiração', () => {
      const enrollment = makeEnrollment({ expiresAt: null });
      const status = checkAccessStatus(enrollment);
      expect(status.hasAccess).toBe(true);
      expect(status.isExpired).toBe(false);
      expect(status.isLifetime).toBe(false);
      expect(status.daysRemaining).toBeNull();
    });

    it('deve retornar expirado para data no passado', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(-1) });
      const status = checkAccessStatus(enrollment);
      expect(status.hasAccess).toBe(false);
      expect(status.isExpired).toBe(true);
      expect(status.daysRemaining).toBe(0);
    });

    it('deve retornar expirando em breve (1 dia)', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(1) });
      const status = checkAccessStatus(enrollment);
      expect(status.hasAccess).toBe(true);
      expect(status.isExpiringSoon).toBe(true);
      expect(status.daysRemaining).toBe(1);
    });

    it('deve retornar expirando em breve (7 dias)', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(7) });
      const status = checkAccessStatus(enrollment);
      expect(status.hasAccess).toBe(true);
      expect(status.isExpiringSoon).toBe(true);
      expect(status.daysRemaining).toBeGreaterThanOrEqual(7);
    });

    it('deve retornar expirando em breve (30 dias)', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(30) });
      const status = checkAccessStatus(enrollment);
      expect(status.hasAccess).toBe(true);
      expect(status.isExpiringSoon).toBe(true);
    });

    it('deve retornar expirando em breve (89 dias - limite)', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(89) });
      const status = checkAccessStatus(enrollment);
      expect(status.hasAccess).toBe(true);
      expect(status.isExpiringSoon).toBe(true);
    });

    it('deve retornar NÃO expirando em breve (91 dias)', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(91) });
      const status = checkAccessStatus(enrollment);
      expect(status.hasAccess).toBe(true);
      expect(status.isExpiringSoon).toBe(false);
    });

    it('deve retornar acesso ativo com muitos dias restantes', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(365) });
      const status = checkAccessStatus(enrollment);
      expect(status.hasAccess).toBe(true);
      expect(status.isExpired).toBe(false);
      expect(status.isExpiringSoon).toBe(false);
      expect(status.daysRemaining).toBeGreaterThan(300);
    });

    it('deve aceitar expiresAt como string ISO', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(30).toISOString() });
      const status = checkAccessStatus(enrollment);
      expect(status.hasAccess).toBe(true);
      expect(status.expiresAt).toBeInstanceOf(Date);
    });

    it('deve calcular daysRemaining corretamente', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(10) });
      const status = checkAccessStatus(enrollment);
      expect(status.daysRemaining).toBeGreaterThanOrEqual(10);
      expect(status.daysRemaining).toBeLessThanOrEqual(11);
    });
  });

  describe('getAccessStatusMessage', () => {
    it('deve retornar mensagem para acesso vitalício', () => {
      const status: AccessStatus = {
        hasAccess: true, isExpired: false, isLifetime: true,
        daysRemaining: null, expiresAt: null, isExpiringSoon: false,
      };
      expect(getAccessStatusMessage(status)).toBe('Você tem acesso vitalício a este curso');
    });

    it('deve retornar mensagem para acesso expirado', () => {
      const status: AccessStatus = {
        hasAccess: false, isExpired: true, isLifetime: false,
        daysRemaining: 0, expiresAt: new Date(), isExpiringSoon: false,
      };
      expect(getAccessStatusMessage(status)).toBe('Seu acesso a este curso expirou');
    });

    it('deve retornar mensagem para sem acesso', () => {
      const status: AccessStatus = {
        hasAccess: false, isExpired: false, isLifetime: false,
        daysRemaining: null, expiresAt: null, isExpiringSoon: false,
      };
      expect(getAccessStatusMessage(status)).toBe('Você não tem acesso a este curso');
    });

    it('deve retornar "expira amanhã" para 1 dia restante', () => {
      const status: AccessStatus = {
        hasAccess: true, isExpired: false, isLifetime: false,
        daysRemaining: 1, expiresAt: daysFromNow(1), isExpiringSoon: true,
      };
      expect(getAccessStatusMessage(status)).toBe('Seu acesso expira amanhã');
    });

    it('deve retornar "expira em X dias" para <= 7 dias', () => {
      const status: AccessStatus = {
        hasAccess: true, isExpired: false, isLifetime: false,
        daysRemaining: 5, expiresAt: daysFromNow(5), isExpiringSoon: true,
      };
      expect(getAccessStatusMessage(status)).toBe('Seu acesso expira em 5 dias');
    });

    it('deve retornar "expira em X dias" para <= 30 dias', () => {
      const status: AccessStatus = {
        hasAccess: true, isExpired: false, isLifetime: false,
        daysRemaining: 25, expiresAt: daysFromNow(25), isExpiringSoon: true,
      };
      expect(getAccessStatusMessage(status)).toBe('Seu acesso expira em 25 dias');
    });

    it('deve retornar "expira em X meses" para > 30 dias e expirando em breve', () => {
      const status: AccessStatus = {
        hasAccess: true, isExpired: false, isLifetime: false,
        daysRemaining: 60, expiresAt: daysFromNow(60), isExpiringSoon: true,
      };
      expect(getAccessStatusMessage(status)).toBe('Seu acesso expira em 2 meses');
    });

    it('deve retornar "1 mês" no singular', () => {
      const status: AccessStatus = {
        hasAccess: true, isExpired: false, isLifetime: false,
        daysRemaining: 45, expiresAt: daysFromNow(45), isExpiringSoon: true,
      };
      expect(getAccessStatusMessage(status)).toBe('Seu acesso expira em 1 mês');
    });

    it('deve retornar "acesso por mais X dias" para ativo não expirando', () => {
      const status: AccessStatus = {
        hasAccess: true, isExpired: false, isLifetime: false,
        daysRemaining: 20, expiresAt: daysFromNow(20), isExpiringSoon: false,
      };
      expect(getAccessStatusMessage(status)).toBe('Você tem acesso por mais 20 dias');
    });

    it('deve retornar "acesso por mais X meses" para > 30 dias ativo', () => {
      const status: AccessStatus = {
        hasAccess: true, isExpired: false, isLifetime: false,
        daysRemaining: 180, expiresAt: daysFromNow(180), isExpiringSoon: false,
      };
      expect(getAccessStatusMessage(status)).toBe('Você tem acesso por mais 6 meses');
    });

    it('deve retornar mensagem genérica quando daysRemaining é null', () => {
      const status: AccessStatus = {
        hasAccess: true, isExpired: false, isLifetime: false,
        daysRemaining: null, expiresAt: null, isExpiringSoon: false,
      };
      expect(getAccessStatusMessage(status)).toBe('Você tem acesso a este curso');
    });
  });

  describe('getAccessStatusColor', () => {
    it('deve retornar success para vitalício', () => {
      const status: AccessStatus = {
        hasAccess: true, isExpired: false, isLifetime: true,
        daysRemaining: null, expiresAt: null, isExpiringSoon: false,
      };
      expect(getAccessStatusColor(status)).toBe('success');
    });

    it('deve retornar error para expirado', () => {
      const status: AccessStatus = {
        hasAccess: false, isExpired: true, isLifetime: false,
        daysRemaining: 0, expiresAt: new Date(), isExpiringSoon: false,
      };
      expect(getAccessStatusColor(status)).toBe('error');
    });

    it('deve retornar error para sem acesso', () => {
      const status: AccessStatus = {
        hasAccess: false, isExpired: false, isLifetime: false,
        daysRemaining: null, expiresAt: null, isExpiringSoon: false,
      };
      expect(getAccessStatusColor(status)).toBe('error');
    });

    it('deve retornar warning para expirando em breve', () => {
      const status: AccessStatus = {
        hasAccess: true, isExpired: false, isLifetime: false,
        daysRemaining: 30, expiresAt: daysFromNow(30), isExpiringSoon: true,
      };
      expect(getAccessStatusColor(status)).toBe('warning');
    });

    it('deve retornar neutral para ativo normal', () => {
      const status: AccessStatus = {
        hasAccess: true, isExpired: false, isLifetime: false,
        daysRemaining: 200, expiresAt: daysFromNow(200), isExpiringSoon: false,
      };
      expect(getAccessStatusColor(status)).toBe('neutral');
    });
  });

  describe('shouldSendExpirationNotification', () => {
    it('deve retornar false para vitalício', () => {
      const enrollment = makeEnrollment({ isLifetime: true });
      expect(shouldSendExpirationNotification(enrollment, null)).toBe(false);
    });

    it('deve retornar false sem data de expiração', () => {
      const enrollment = makeEnrollment({ expiresAt: null });
      expect(shouldSendExpirationNotification(enrollment, null)).toBe(false);
    });

    it('deve retornar true dentro da janela de 90 dias sem notificação prévia', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(60) });
      expect(shouldSendExpirationNotification(enrollment, null)).toBe(true);
    });

    it('deve retornar true para 1 dia restante sem notificação prévia', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(1) });
      expect(shouldSendExpirationNotification(enrollment, null)).toBe(true);
    });

    it('deve retornar false para já expirado', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(-5) });
      expect(shouldSendExpirationNotification(enrollment, null)).toBe(false);
    });

    it('deve retornar false fora da janela de 90 dias', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(100) });
      expect(shouldSendExpirationNotification(enrollment, null)).toBe(false);
    });

    it('deve retornar false se notificação já foi enviada', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(60) });
      expect(shouldSendExpirationNotification(enrollment, new Date())).toBe(false);
    });

    it('deve retornar false se notificação enviada como string ISO', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(60) });
      expect(shouldSendExpirationNotification(enrollment, new Date().toISOString())).toBe(false);
    });

    it('deve retornar true no limite exato de 90 dias', () => {
      const enrollment = makeEnrollment({ expiresAt: daysFromNow(90) });
      expect(shouldSendExpirationNotification(enrollment, null)).toBe(true);
    });
  });
});

// Helper para criar SubscriptionInfo com defaults
function makeSub(partial: Partial<SubscriptionInfo> = {}): SubscriptionInfo {
  return {
    id: 'sub_1',
    plan: 'basico',
    courseId: null,
    billingCycle: 'monthly',
    status: 'active',
    currentPeriodEnd: new Date(),
    cancelAtPeriodEnd: false,
    ...partial,
  };
}

describe('checkSubscriptionAccess', () => {
  it('nega acesso sem subscriptions', () => {
    expect(checkSubscriptionAccess(undefined, '1')).toBe(false);
    expect(checkSubscriptionAccess([], '1')).toBe(false);
  });

  it('Premium ativo dá acesso a qualquer curso', () => {
    const subs = [makeSub({ plan: 'premium' })];
    expect(checkSubscriptionAccess(subs, '1')).toBe(true);
    expect(checkSubscriptionAccess(subs, '99')).toBe(true);
  });

  it('Básico ativo dá acesso apenas ao curso contratado', () => {
    const subs = [makeSub({ plan: 'basico', courseId: '3' })];
    expect(checkSubscriptionAccess(subs, '3')).toBe(true);
    expect(checkSubscriptionAccess(subs, '5')).toBe(false);
  });

  it('subscription não-ativa nunca dá acesso', () => {
    const subs = [makeSub({ plan: 'premium', status: 'canceled' })];
    expect(checkSubscriptionAccess(subs, '1')).toBe(false);
  });

  it('plano diferente de premium/basico é negado', () => {
    const subs = [makeSub({ plan: 'trial', courseId: '1' })];
    expect(checkSubscriptionAccess(subs, '1')).toBe(false);
  });
});

describe('getActivePlan', () => {
  it('retorna null sem subscriptions', () => {
    expect(getActivePlan(undefined)).toBeNull();
    expect(getActivePlan([])).toBeNull();
  });

  it('prioriza premium quando há premium ativo', () => {
    const subs = [makeSub({ plan: 'basico' }), makeSub({ plan: 'premium' })];
    expect(getActivePlan(subs)).toBe('premium');
  });

  it('retorna basico quando só há básico ativo', () => {
    expect(getActivePlan([makeSub({ plan: 'basico' })])).toBe('basico');
  });

  it('ignora subscriptions não-ativas e retorna null', () => {
    const subs = [
      makeSub({ plan: 'premium', status: 'canceled' }),
      makeSub({ plan: 'basico', status: 'past_due' }),
    ];
    expect(getActivePlan(subs)).toBeNull();
  });
});

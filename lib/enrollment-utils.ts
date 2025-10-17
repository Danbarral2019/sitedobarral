/**
 * Utilidades para gerenciamento de matrículas e acesso aos cursos
 */

export interface Enrollment {
  id: string;
  courseId: string;
  expiresAt: Date | string | null;
  isLifetime: boolean;
  turma?: string | null;
  qrCodeId?: string | null;
}

export interface AccessStatus {
  hasAccess: boolean;
  isExpired: boolean;
  isLifetime: boolean;
  daysRemaining: number | null;
  expiresAt: Date | null;
  isExpiringSoon: boolean; // Menos de 3 meses para expirar
}

/**
 * Verifica o status de acesso de uma matrícula
 */
export function checkAccessStatus(enrollment: Enrollment | null): AccessStatus {
  if (!enrollment) {
    return {
      hasAccess: false,
      isExpired: false,
      isLifetime: false,
      daysRemaining: null,
      expiresAt: null,
      isExpiringSoon: false,
    };
  }

  // Se for acesso vitalício, sempre tem acesso
  if (enrollment.isLifetime) {
    return {
      hasAccess: true,
      isExpired: false,
      isLifetime: true,
      daysRemaining: null,
      expiresAt: null,
      isExpiringSoon: false,
    };
  }

  // Se não tem data de expiração, tratar como ativo por padrão
  if (!enrollment.expiresAt) {
    return {
      hasAccess: true,
      isExpired: false,
      isLifetime: false,
      daysRemaining: null,
      expiresAt: null,
      isExpiringSoon: false,
    };
  }

  const now = new Date();
  const expiresAt = new Date(enrollment.expiresAt);
  const isExpired = now > expiresAt;

  // Calcular dias restantes
  const timeDiff = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  // Verificar se está expirando em breve (menos de 90 dias / 3 meses)
  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 90;

  return {
    hasAccess: !isExpired,
    isExpired,
    isLifetime: false,
    daysRemaining: isExpired ? 0 : daysRemaining,
    expiresAt,
    isExpiringSoon,
  };
}

/**
 * Formata a mensagem de status de acesso
 */
export function getAccessStatusMessage(status: AccessStatus): string {
  if (status.isLifetime) {
    return 'Você tem acesso vitalício a este curso';
  }

  if (status.isExpired) {
    return 'Seu acesso a este curso expirou';
  }

  if (!status.hasAccess) {
    return 'Você não tem acesso a este curso';
  }

  if (status.isExpiringSoon && status.daysRemaining !== null) {
    if (status.daysRemaining === 1) {
      return 'Seu acesso expira amanhã';
    }
    if (status.daysRemaining <= 7) {
      return `Seu acesso expira em ${status.daysRemaining} dias`;
    }
    if (status.daysRemaining <= 30) {
      return `Seu acesso expira em ${status.daysRemaining} dias`;
    }
    const months = Math.floor(status.daysRemaining / 30);
    return `Seu acesso expira em ${months} ${months === 1 ? 'mês' : 'meses'}`;
  }

  if (status.daysRemaining !== null) {
    if (status.daysRemaining <= 30) {
      return `Você tem acesso por mais ${status.daysRemaining} dias`;
    }
    const months = Math.floor(status.daysRemaining / 30);
    return `Você tem acesso por mais ${months} ${months === 1 ? 'mês' : 'meses'}`;
  }

  return 'Você tem acesso a este curso';
}

/**
 * Retorna a cor do badge de status
 */
export function getAccessStatusColor(status: AccessStatus): 'success' | 'warning' | 'error' | 'neutral' {
  if (status.isLifetime) {
    return 'success';
  }

  if (status.isExpired || !status.hasAccess) {
    return 'error';
  }

  if (status.isExpiringSoon) {
    return 'warning';
  }

  return 'neutral';
}

/**
 * Verifica se o usuário deve receber notificação de expiração
 * (3 meses antes do vencimento)
 */
export function shouldSendExpirationNotification(
  enrollment: Enrollment,
  notificationSentAt: Date | string | null
): boolean {
  // Não enviar se for vitalício
  if (enrollment.isLifetime) {
    return false;
  }

  // Não enviar se não tem data de expiração
  if (!enrollment.expiresAt) {
    return false;
  }

  const now = new Date();
  const expiresAt = new Date(enrollment.expiresAt);

  // Calcular dias restantes
  const timeDiff = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  // Verificar se está dentro da janela de notificação (90 dias)
  const isInNotificationWindow = daysRemaining > 0 && daysRemaining <= 90;

  // Se não está na janela, não enviar
  if (!isInNotificationWindow) {
    return false;
  }

  // Se já foi enviada notificação, não enviar novamente
  if (notificationSentAt) {
    return false;
  }

  return true;
}

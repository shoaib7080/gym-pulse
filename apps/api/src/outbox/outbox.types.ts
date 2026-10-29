export interface EnqueueNotificationDto {
  gymId: string;
  memberId?: string | null;
  channel: 'push' | 'whatsapp' | 'sms' | 'email';
  template: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
}

export interface DispatchOutboxDto {
  limit: number;
}

export interface ValidationIssue {
  name: string;
  reason: string;
}

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: ValidationIssue[] } };

export const enqueueNotificationSchema = {
  safeParse(raw: unknown): ParseResult<EnqueueNotificationDto> {
    const issues: ValidationIssue[] = [];
    if (!raw || typeof raw !== 'object') {
      return { success: false, error: { issues: [{ name: 'body', reason: 'Expected object' }] } };
    }
    const val = raw as Record<string, unknown>;

    if (typeof val.gymId !== 'string' || !val.gymId) {
      issues.push({ name: 'gymId', reason: 'gymId is required' });
    }

    const validChannels = ['push', 'whatsapp', 'sms', 'email'] as const;
    if (!validChannels.includes(val.channel as 'push' | 'whatsapp' | 'sms' | 'email')) {
      issues.push({ name: 'channel', reason: 'channel must be one of: push, whatsapp, sms, email' });
    }

    if (typeof val.template !== 'string' || !val.template) {
      issues.push({ name: 'template', reason: 'template is required' });
    }

    if (typeof val.dedupeKey !== 'string' || !val.dedupeKey) {
      issues.push({ name: 'dedupeKey', reason: 'dedupeKey is required' });
    }

    const payload =
      val.payload && typeof val.payload === 'object' ? (val.payload as Record<string, unknown>) : {};

    if (issues.length > 0) {
      return { success: false, error: { issues } };
    }

    return {
      success: true,
      data: {
        gymId: val.gymId as string,
        memberId: typeof val.memberId === 'string' ? val.memberId : null,
        channel: val.channel as 'push' | 'whatsapp' | 'sms' | 'email',
        template: val.template as string,
        payload,
        dedupeKey: val.dedupeKey as string,
      },
    };
  },
};

export const dispatchOutboxSchema = {
  safeParse(raw: unknown): ParseResult<DispatchOutboxDto> {
    if (!raw || typeof raw !== 'object') {
      return { success: true, data: { limit: 50 } };
    }
    const val = raw as Record<string, unknown>;
    const limit = typeof val.limit === 'number' && val.limit >= 1 ? Math.min(500, Math.round(val.limit)) : 50;
    return { success: true, data: { limit } };
  },
};

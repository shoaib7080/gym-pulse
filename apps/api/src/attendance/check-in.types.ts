export type CheckInMethod =
  | 'self_tap_temporary'
  | 'qr'
  | 'desk_search'
  | 'manual'
  | 'turnstile';

export type CheckInResultStatus = 'allowed' | 'denied' | 'override_allowed';

export interface MemberCheckInAttemptEvent {
  gymId: string;
  memberId?: string;
  membershipId?: string;
  branchId?: string;
  actorUserId?: string;
  method: CheckInMethod;
  timestamp: Date;
  sourceIp?: string;
  deviceId?: string;
}

export interface CheckInResponsePayload {
  success: boolean;
  checkInId: string;
  result: CheckInResultStatus;
  method: CheckInMethod;
  recordedAt: string;
  checkIn: {
    id: string;
    memberId: string | null;
    membershipId: string | null;
    branchId: string;
    result: CheckInResultStatus;
    method: CheckInMethod;
    createdAt: Date;
  };
  member: {
    id: string;
    fullName: string;
    memberNumber: string;
  };
  membership: {
    id: string;
    planTitle: string;
    status: string;
    startDate: string;
    endDate: string;
  };
  streak: {
    currentStreak: number;
    visitDate: string;
    message: string;
  };
}

export interface ICheckInService {
  processCheckIn(event: MemberCheckInAttemptEvent): Promise<CheckInResponsePayload>;
  getCheckInHistory(
    gymId: string,
    filters?: {
      memberId?: string;
      membershipId?: string;
      branchId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ items: unknown[]; total: number }>;
}

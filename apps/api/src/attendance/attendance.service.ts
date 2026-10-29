import { Injectable } from '@nestjs/common';
import { CheckInService } from './check-in.service';

export interface MarkAttendanceDto {
  memberId?: string;
  membershipId?: string;
  branchId?: string;
}

@Injectable()
export class AttendanceService {
  constructor(private readonly checkInService: CheckInService) {}

  /**
   * Tap to mark attendance (Check-in from member app or desk)
   * Delegates to decoupled CheckInService domain processor
   */
  async tapAttendance(
    gymId: string,
    input: MarkAttendanceDto,
    actorUserId?: string,
  ) {
    return this.checkInService.processCheckIn({
      gymId,
      memberId: input.memberId,
      membershipId: input.membershipId,
      branchId: input.branchId,
      actorUserId,
      method: 'manual',
      timestamp: new Date(),
    });
  }

  /**
   * Get attendance history for the gym
   */
  async getAttendanceHistory(
    gymId: string,
    filters: {
      memberId?: string;
      membershipId?: string;
      branchId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    return this.checkInService.getCheckInHistory(gymId, filters);
  }
}

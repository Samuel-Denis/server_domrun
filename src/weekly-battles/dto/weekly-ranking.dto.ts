/**
 * DTO para ranking da sala
 */
export class WeeklyRankingEntryDto {
  position: number;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  totalPoints: number;
  consistencyBonus: number;
  runsValidCount: number;
  promoted: boolean;
  demoted: boolean;
}

export class WeeklyRankingDto {
  roomId: string;
  league: {
    code: string;
    displayName: string;
  };
  weekKey: string;
  rankings: WeeklyRankingEntryDto[];
}

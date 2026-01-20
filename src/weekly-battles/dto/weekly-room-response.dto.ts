/**
 * DTO de resposta para informações da sala semanal
 */
export class WeeklyRoomResponseDto {
  id: string;
  leagueId: string;
  league: {
    code: string;
    displayName: string;
  };
  seasonNumber: number;
  weekNumber: number;
  weekKey: string;
  roomNumber: number;
  startDate: Date;
  endDate: Date;
  status: string;
  participantsCount: number;
  userParticipant?: {
    id: string;
    totalPoints: number;
    runsValidCount: number;
    position?: number;
  };
}

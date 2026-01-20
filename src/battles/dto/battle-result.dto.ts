export class BattleResultDto {
  battleId: string;
  winnerId: string;
  loserId: string;
  p1Score: number;
  p2Score: number;
  p1TrophyChange: number;
  p2TrophyChange: number;
  p1NewTrophies: number;
  p2NewTrophies: number;
  p1NewLeague?: string;
  p2NewLeague?: string;
  invalidated?: boolean;
  reason?: string; // Motivo se foi invalidado (anti-cheat)
}

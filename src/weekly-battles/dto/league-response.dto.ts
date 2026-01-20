/**
 * DTO de resposta para lista de ligas
 */
export class LeagueResponseDto {
  id: string;
  code: string;
  displayName: string;
  order: number;
  isChampion: boolean;
  minTrophiesToEnter?: number;
  paceTopSecKm: number;
  paceBaseSecKm: number;
  smurfCapSecKm?: number;
  weeklyConsistencyMaxBonus: number;
}

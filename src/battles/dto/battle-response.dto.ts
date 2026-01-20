export class BattleResponseDto {
  id: string;
  player1Id: string;
  player2Id: string;
  status: string;
  mode: string;
  player1?: {
    id: string;
    username: string;
    name: string;
    color: string;
    photoUrl?: string;
    trophies: number;
    league?: string;
  };
  player2?: {
    id: string;
    username: string;
    name: string;
    color: string;
    photoUrl?: string;
    trophies: number;
    league?: string;
  };
  p1Score?: number;
  p2Score?: number;
  winnerId?: string;
  createdAt: Date;
  finishedAt?: Date;
}

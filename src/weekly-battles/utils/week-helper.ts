/**
 * Utilitários para manipulação de semanas e datas
 */

/**
 * Gera o weekKey no formato YYYY-Www (ex: "2026-W03")
 * Baseado em timezone America/Sao_Paulo
 */
export function generateWeekKey(date: Date = new Date()): string {
  // Converter para timezone de São Paulo
  const saoPauloDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  // Calcular o início da semana (segunda-feira)
  const dayOfWeek = saoPauloDate.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Segunda = 1
  const monday = new Date(saoPauloDate);
  monday.setDate(saoPauloDate.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  // Calcular o número da semana ISO
  const year = monday.getFullYear();
  const weekNumber = getISOWeek(monday);

  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Calcula o número da semana ISO (1-53)
 */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Retorna o início e fim da semana atual (segunda 00:00 - domingo 23:59:59)
 * Timezone: America/Sao_Paulo
 */
export function getCurrentWeekRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const saoPauloDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  const dayOfWeek = saoPauloDate.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const startDate = new Date(saoPauloDate);
  startDate.setDate(saoPauloDate.getDate() + diff);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);
  
  return { startDate, endDate };
}

/**
 * Retorna o período competitivo da semana atual (terça 00:00 - domingo 23:59:59)
 * Timezone: America/Sao_Paulo
 * 
 * Período competitivo é diferente da semana técnica:
 * - Semana técnica: Segunda 00:00 → Domingo 23:59
 * - Período competitivo: Terça 00:00 → Domingo 23:59
 */
export function getCompetitionWeekRange(): { startDate: Date; endDate: Date } {
  const weekRange = getCurrentWeekRange();
  
  // Período competitivo começa na terça (segunda + 1 dia)
  const competitionStart = new Date(weekRange.startDate);
  competitionStart.setDate(weekRange.startDate.getDate() + 1); // Terça
  competitionStart.setHours(0, 0, 0, 0);
  
  // Período competitivo termina no domingo (mesmo fim da semana técnica)
  const competitionEnd = new Date(weekRange.endDate);
  
  return { startDate: competitionStart, endDate: competitionEnd };
}

/**
 * Retorna o período de inscrição para a próxima semana
 * Segunda 00:00 → 23:59:59 (período de 24h para inscrição)
 */
export function getEnrollmentPeriod(): { startDate: Date; endDate: Date } {
  const weekRange = getCurrentWeekRange();
  
  // Período de inscrição é a segunda-feira completa da semana atual
  const enrollmentStart = new Date(weekRange.startDate);
  enrollmentStart.setHours(0, 0, 0, 0);
  
  const enrollmentEnd = new Date(weekRange.startDate);
  enrollmentEnd.setHours(23, 59, 59, 999);
  
  return { startDate: enrollmentStart, endDate: enrollmentEnd };
}

/**
 * Verifica se estamos no período de inscrição (segunda-feira)
 */
export function isEnrollmentPeriod(): boolean {
  const now = new Date();
  const saoPauloDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dayOfWeek = saoPauloDate.getDay();
  
  return dayOfWeek === 1; // Segunda-feira = 1
}

/**
 * Verifica se estamos no período competitivo (terça → domingo)
 */
export function isCompetitionPeriod(): boolean {
  const now = new Date();
  const saoPauloDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dayOfWeek = saoPauloDate.getDay();
  
  return dayOfWeek >= 2 && dayOfWeek <= 0; // Terça (2) até Domingo (0)
}

/**
 * Gera dayKey no formato YYYY-MM-DD
 * Timezone: America/Sao_Paulo
 */
export function generateDayKey(date: Date = new Date()): string {
  const saoPauloDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const year = saoPauloDate.getFullYear();
  const month = (saoPauloDate.getMonth() + 1).toString().padStart(2, '0');
  const day = saoPauloDate.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcula seasonNumber baseado na data
 * Temporada = ano * 100 + número da semana ISO
 */
export function calculateSeasonNumber(date: Date = new Date()): number {
  const weekKey = generateWeekKey(date);
  const [year, week] = weekKey.split('-W');
  return parseInt(year) * 100 + parseInt(week);
}

/**
 * Extrai seasonNumber e weekNumber do weekKey
 */
export function parseWeekKey(weekKey: string): { seasonNumber: number; weekNumber: number; year: number } {
  const [year, week] = weekKey.split('-W');
  const yearNum = parseInt(year);
  const weekNum = parseInt(week);
  return {
    seasonNumber: yearNum * 100 + weekNum,
    weekNumber: weekNum,
    year: yearNum,
  };
}

/**
 * Retorna o weekKey da próxima semana
 */
export function getNextWeekKey(): string {
  const weekRange = getCurrentWeekRange();
  const nextWeekStart = new Date(weekRange.startDate);
  nextWeekStart.setDate(weekRange.startDate.getDate() + 7);
  return generateWeekKey(nextWeekStart);
}

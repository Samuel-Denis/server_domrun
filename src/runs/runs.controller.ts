import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus, BadRequestException, Query } from '@nestjs/common';
import { RunsService } from './runs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateTerritoryDto } from './dto/create-territory.dto';
import { CreateRunDto } from './dto/create-run.dto';
import { plainToInstance } from 'class-transformer';

@Controller('runs')
export class RunsController {
    constructor(private readonly runsService: RunsService) { }

    /**
     * Endpoint para criar corrida simples (sem território)
     * Salva apenas o trajeto de ponto A até ponto B
     */
    @UseGuards(JwtAuthGuard)
    @Post('simple')
    @HttpCode(HttpStatus.CREATED)
    async createSimpleRun(
        @CurrentUser() user: any,
        @Body() body: any,
    ) {
        // Se veio como multipart/form-data, o JSON está no campo 'data'
        // Se veio como JSON puro, está diretamente no body
        let dataToParse = body || {};
        if (body && body.data && typeof body.data === 'string') {
            // multipart/form-data: campo 'data' contém JSON string
            try {
                dataToParse = JSON.parse(body.data);
            } catch (error) {
                throw new BadRequestException('Formato inválido: campo "data" deve ser um JSON válido');
            }
        }

        // Converter para DTO
        const dto = plainToInstance(CreateRunDto, dataToParse);
        return this.runsService.createSimpleRun(user.id, dto);
    }

    @UseGuards(JwtAuthGuard)
    @Post()
    @HttpCode(HttpStatus.CREATED)
    
    async createRun(
        @CurrentUser() user: any,
        
        @Body() body: any,
    ) {
        // Se veio como multipart/form-data, o JSON está no campo 'data'
        // Se veio como JSON puro, está diretamente no body
        let dataToParse = body || {};
        if (body && body.data && typeof body.data === 'string') {
            // multipart/form-data: campo 'data' contém JSON string
            try {
                dataToParse = JSON.parse(body.data);
            } catch (error) {
                throw new BadRequestException('Formato inválido: campo "data" deve ser um JSON válido');
            }
        }

        // Debug: Log do que está chegando
        console.log('📥 [RunsController] Dados recebidos:');
        console.log('   - body keys:', Object.keys(dataToParse));
        console.log('   - boundary existe?', !!dataToParse.boundary);
        console.log('   - boundary type:', typeof dataToParse.boundary);

        // Remover userId se estiver presente (usa do token)
        if (dataToParse.userId) {
            delete dataToParse.userId;
        }

        // Converter formato GeoJSON para formato esperado se necessário
        if (dataToParse.boundary && typeof dataToParse.boundary === 'object' && !Array.isArray(dataToParse.boundary)) {
            // É formato GeoJSON: { type: "LineString", coordinates: [[lng, lat], ...] }
            if (dataToParse.boundary.type === 'LineString' && Array.isArray(dataToParse.boundary.coordinates)) {
                console.log('🔄 Convertendo GeoJSON para formato esperado...');
                const now = new Date();
                dataToParse.boundary = dataToParse.boundary.coordinates.map((coord: number[], index: number) => {
                    const [longitude, latitude] = coord;
                    // Criar timestamp progressivo se não tiver capturedAt
                    const timestamp = dataToParse.capturedAt
                        ? new Date(new Date(dataToParse.capturedAt).getTime() + (index * 1000)).toISOString()
                        : new Date(now.getTime() + (index * 1000)).toISOString();

                    return {
                        latitude,
                        longitude,
                        timestamp,
                    };
                });
                console.log(`✅ Convertido: ${dataToParse.boundary.length} pontos`);
            } else {
                throw new BadRequestException('Formato GeoJSON inválido: boundary deve ter type="LineString" e coordinates array');
            }
        }

        // Verificar boundary ANTES de converter para DTO
        if (dataToParse.boundary && Array.isArray(dataToParse.boundary) && dataToParse.boundary.length > 0) {
            // Converter body para DTO
            const dto = plainToInstance(CreateTerritoryDto, dataToParse);
            return this.runsService.createTerritory(user.id, dto);
        }

        // Compatibilidade com formato antigo (path - para corridas simples)
        if (dataToParse.path && Array.isArray(dataToParse.path) && dataToParse.path.length > 0) {
            // @ts-ignore
            return this.runsService.processRun(user.id, dataToParse.path);
        }

        // Se chegou aqui, não tem boundary nem path válido
        console.error('❌ [RunsController] Formato inválido:');
        console.error('   - dataToParse keys:', Object.keys(dataToParse));
        console.error('   - dataToParse boundary type:', typeof dataToParse.boundary);
        console.error('   - dataToParse:', JSON.stringify(dataToParse, null, 2).substring(0, 500));
        throw new BadRequestException('Formato inválido: forneça "boundary" (LineString) ou "path" (corrida simples)');
    }

    @Get('map')
    async getMap(@Query('bbox') bboxParam?: string) {
        let bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | undefined;

        if (bboxParam) {
            try {
                bbox = this.parseBbox(bboxParam);
            } catch (error: any) {
                throw new BadRequestException(`BBOX inválido: ${error.message}`);
            }
        }

        return this.runsService.getMapData(bbox);
    }

    /**
     * Parse e valida o parâmetro bbox da query string
     * Formato esperado: "minLng,minLat,maxLng,maxLat"
     */
    private parseBbox(bboxParam: string): { minLng: number; minLat: number; maxLng: number; maxLat: number } {
        const parts = bboxParam.split(',');

        if (parts.length !== 4) {
            throw new Error('BBOX deve ter 4 valores separados por vírgula');
        }

        const [minLng, minLat, maxLng, maxLat] = parts.map(parseFloat);

        // Validação de valores numéricos
        if (isNaN(minLng) || isNaN(minLat) || isNaN(maxLng) || isNaN(maxLat)) {
            throw new Error('BBOX contém valores não numéricos');
        }

        // Validação lógica
        if (minLng >= maxLng || minLat >= maxLat) {
            throw new Error('min deve ser menor que max para longitude e latitude');
        }

        // Validação de limites geográficos
        if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) {
            throw new Error('BBOX fora dos limites geográficos válidos (-180 a 180 para longitude, -90 a 90 para latitude)');
        }

        return { minLng, minLat, maxLng, maxLat };
    }
}

// Controller adicional para compatibilidade com /api/territories
@Controller('/territories')
export class TerritoriesController {
    constructor(private readonly runsService: RunsService) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createTerritory(
        @CurrentUser() user: any,
        @Body() body: any,
    ) {
        // Se veio como multipart/form-data, o JSON está no campo 'data'
        // Se veio como JSON puro, está diretamente no body
        let dataToParse = body || {};
        if (body && body.data && typeof body.data === 'string') {
            // multipart/form-data: campo 'data' contém JSON string
            try {
                dataToParse = JSON.parse(body.data);
            } catch (error) {
                throw new BadRequestException('Formato inválido: campo "data" deve ser um JSON válido');
            }
        }

        // Remover userId se estiver presente (usa do token)
        if (dataToParse.userId) {
            delete dataToParse.userId;
        }

        // Converter body para DTO
        const dto = plainToInstance(CreateTerritoryDto, dataToParse);

        // Verificar boundary (deve ser array de objetos com latitude, longitude, timestamp)
        if (dto.boundary && Array.isArray(dto.boundary) && dto.boundary.length > 0) {
            return this.runsService.createTerritory(user.id, dto);
        }

        // Compatibilidade com formato antigo (path - para corridas simples)
        // @ts-ignore - mantendo compatibilidade
        if (dataToParse.path && Array.isArray(dataToParse.path) && dataToParse.path.length > 0) {
            // @ts-ignore
            return this.runsService.processRun(user.id, dataToParse.path);
        }

        throw new BadRequestException('Formato inválido: forneça "boundary" (array de objetos com latitude, longitude, timestamp) ou "path" (corrida simples)');
    }
}

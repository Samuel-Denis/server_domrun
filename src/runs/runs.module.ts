import { Module, forwardRef } from '@nestjs/common';
import { RunsService } from './runs.service';
import { RunsController, TerritoriesController } from './runs.controller';
import { RunsRepository } from './runs.repository';
import { MapMatchingService } from './map-matching.service';
import { UsersModule } from '../users/users.module';
import { RunsCalculationService } from './services/runs-calculation.service';
import { TerritoryCalculationService } from './services/territory-calculation.service';
import { TerritoryProcessingService } from './services/territory-processing.service';
import { TerritoryService } from './services/territory.service';

@Module({
    imports: [forwardRef(() => UsersModule)],
    controllers: [RunsController, TerritoriesController],
    providers: [
        RunsService,
        RunsRepository,
        MapMatchingService,
        RunsCalculationService,
        TerritoryCalculationService,
        TerritoryProcessingService,
        TerritoryService,
    ],
    exports: [RunsService],
})
export class RunsModule { }
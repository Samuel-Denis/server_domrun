import { Module, forwardRef } from '@nestjs/common';
import { RunsService } from './runs.service';
import { RunsController, TerritoriesController } from './runs.controller';
import { RunsRepository } from './runs.repository';
import { MapMatchingService } from './map-matching.service';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [forwardRef(() => UsersModule)],
    controllers: [RunsController, TerritoriesController],
    providers: [RunsService, RunsRepository, MapMatchingService], // Repository registrado aqui!
    exports: [RunsService],
})
export class RunsModule { }
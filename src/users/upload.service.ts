import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
    private readonly uploadPath = path.join(process.cwd(), 'uploads', 'profiles');
    private readonly runsUploadPath = path.join(process.cwd(), 'uploads', 'runs');

    constructor() {
        // Criar diretórios de uploads se não existirem
        if (!fs.existsSync(this.uploadPath)) {
            fs.mkdirSync(this.uploadPath, { recursive: true });
        }
        if (!fs.existsSync(this.runsUploadPath)) {
            fs.mkdirSync(this.runsUploadPath, { recursive: true });
        }
    }

    async saveProfileImage(file: Express.Multer.File, userId: string): Promise<string> {
        // Gerar nome único para o arquivo
        const fileExtension = path.extname(file.originalname);
        const fileName = `${userId}-${randomUUID()}${fileExtension}`;
        const filePath = path.join(this.uploadPath, fileName);

        // Salvar arquivo
        fs.writeFileSync(filePath, file.buffer);

        // Retornar caminho relativo para ser armazenado no banco
        return `/uploads/profiles/${fileName}`;
    }

    async deleteProfileImage(photoUrl: string): Promise<void> {
        if (!photoUrl) return;

        // Remover o prefixo /uploads/profiles/ se existir
        const fileName = photoUrl.replace('/uploads/profiles/', '');
        const filePath = path.join(this.uploadPath, fileName);

        // Deletar arquivo se existir
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    async saveRunMapImage(file: Express.Multer.File, runId: string): Promise<string> {
        // Gerar nome único para o arquivo
        const fileExtension = path.extname(file.originalname) || '.png';
        const fileName = `${runId}-${randomUUID()}${fileExtension}`;
        const filePath = path.join(this.runsUploadPath, fileName);

        // Salvar arquivo
        fs.writeFileSync(filePath, file.buffer);

        // Retornar caminho relativo para ser armazenado no banco
        return `/uploads/runs/${fileName}`;
    }

    async deleteRunMapImage(imageUrl: string): Promise<void> {
        if (!imageUrl) return;

        // Remover o prefixo /uploads/runs/ se existir
        const fileName = imageUrl.replace('/uploads/runs/', '');
        const filePath = path.join(this.runsUploadPath, fileName);

        // Deletar arquivo se existir
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    getUploadPath(): string {
        return this.uploadPath;
    }
}

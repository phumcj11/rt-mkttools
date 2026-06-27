import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { SystemSettingsService } from '../system-settings/system-settings.service';

export interface DriveUploadResult {
  fileId: string;
  name: string;
  webViewLink: string;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string | null;
  webViewLink?: string | null;
}

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);

  constructor(private readonly settings: SystemSettingsService) {}

  private async client(folderKey = 'google_drive_folder_id') {
    const [folderId, saJson] = await Promise.all([
      this.settings.get(folderKey),
      this.settings.get('google_service_account_json'),
    ]);

    if (!folderId || !saJson) {
      throw new Error('DRIVE_NOT_CONFIGURED');
    }

    const driveLib = await import('@googleapis/drive');
    const driveApi = driveLib.default ?? driveLib;
    const credentials = JSON.parse(saJson) as {
      client_email: string;
      private_key: string;
    };

    const { JWT } = await import('google-auth-library');
    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return {
      folderId,
      drive: driveApi.drive({ version: 'v3', auth }),
    };
  }

  async isConfigured(): Promise<boolean> {
    const [folderId, sa] = await Promise.all([
      this.settings.get('google_drive_folder_id'),
      this.settings.get('google_service_account_json'),
    ]);
    return !!(folderId && sa && sa.length > 20);
  }

  /**
   * Upload a local file to the configured Google Drive folder.
   * Requires `google_service_account_json` and `google_drive_folder_id` in system settings.
   */
  async uploadFile(localPath: string, mimeType = 'image/png'): Promise<DriveUploadResult> {
    const { drive, folderId } = await this.client();
    const filename = path.basename(localPath);

    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: fs.createReadStream(localPath),
      },
      fields: 'id,name,webViewLink',
    });

    const file = response.data;
    if (!file.id) throw new Error('Drive upload failed: no file ID returned');

    this.logger.log(`Uploaded to Drive: ${file.name} (${file.id})`);
    return {
      fileId: file.id,
      name: file.name ?? filename,
      webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
    };
  }

  async listFiles(opts?: {
    folderKey?: string;
    nameContains?: string;
    mimeTypes?: string[];
    pageSize?: number;
  }): Promise<DriveFileInfo[]> {
    const { drive, folderId } = await this.client(opts?.folderKey);
    const clauses = [`'${folderId}' in parents`, 'trashed = false'];
    if (opts?.nameContains) {
      clauses.push(`name contains '${opts.nameContains.replace(/'/g, "\\'")}'`);
    }
    if (opts?.mimeTypes?.length) {
      clauses.push(`(${opts.mimeTypes.map((m) => `mimeType = '${m}'`).join(' or ')})`);
    }
    const res = await drive.files.list({
      q: clauses.join(' and '),
      pageSize: opts?.pageSize ?? 50,
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return (res.data.files ?? [])
      .filter((f) => f.id && f.name)
      .map((f) => ({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType ?? '',
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink,
      }));
  }

  async downloadFile(fileId: string, folderKey?: string): Promise<Buffer> {
    const { drive } = await this.client(folderKey);
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data as ArrayBuffer);
  }

  /**
   * Sync all files in the local uploads/media directory to Google Drive.
   */
  async syncMediaFolder(): Promise<{
    uploaded: DriveUploadResult[];
    failed: { file: string; error: string }[];
  }> {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'media');
    if (!fs.existsSync(uploadsDir)) {
      return { uploaded: [], failed: [] };
    }

    const files = fs.readdirSync(uploadsDir).filter(
      (f) => f.endsWith('.png') || f.endsWith('.mp4') || f.endsWith('.jpg'),
    );

    const uploaded: DriveUploadResult[] = [];
    const failed: { file: string; error: string }[] = [];

    for (const filename of files) {
      const localPath = path.join(uploadsDir, filename);
      const mime = filename.endsWith('.mp4') ? 'video/mp4' : 'image/png';
      try {
        const result = await this.uploadFile(localPath, mime);
        uploaded.push(result);
      } catch (err: unknown) {
        failed.push({ file: filename, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return { uploaded, failed };
  }
}

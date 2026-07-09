import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getStorageConfig, isLocalStorageEnabled, isR2StorageEnabled } from '../../storage/storageConfig.js';
import { createR2RuntimeClient } from '../../storage/r2/r2Clients.js';
import {
  buildProfileAvatarPrefix,
  buildProfileAvatarVariantKey,
  resolveProfileAvatarLocalPath,
} from '../../storage/profileAvatarKeys.js';
import { ServiceError } from '../../utils/serviceErrors.js';

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class ProfileAvatarStorage {
  private client: S3Client | null = null;

  private getR2Client() {
    const config = getStorageConfig();
    if (!config.r2) {
      throw new ServiceError('R2 não configurado.', 'R2_CONFIG_MISSING', 500);
    }
    this.client ??= createR2RuntimeClient(config.r2);
    return { client: this.client, bucket: config.r2.defaultBucket };
  }

  async storeVariant(input: {
    userId: string;
    version: number;
    size: number;
    extension: 'webp' | 'png';
    buffer: Buffer;
    contentType: string;
  }): Promise<string> {
    const objectKey = buildProfileAvatarVariantKey({
      userId: input.userId,
      version: input.version,
      size: input.size,
      extension: input.extension,
    });

    if (isR2StorageEnabled()) {
      const { client, bucket } = this.getR2Client();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: input.buffer,
          ContentType: input.contentType,
          CacheControl: 'private, max-age=31536000, immutable',
        }),
      );
      return objectKey;
    }

    if (isLocalStorageEnabled()) {
      const config = getStorageConfig();
      const absolute = resolveProfileAvatarLocalPath(config.localRoot, objectKey);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, input.buffer);
      return objectKey;
    }

    throw new ServiceError('Storage de avatar indisponível.', 'AVATAR_STORAGE_UNAVAILABLE', 503);
  }

  async readVariant(objectKey: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (isR2StorageEnabled()) {
      const { client, bucket } = this.getR2Client();
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      );
      const buffer = await streamToBuffer(response.Body);
      return {
        buffer,
        contentType: response.ContentType ?? 'image/webp',
      };
    }

    if (isLocalStorageEnabled()) {
      const config = getStorageConfig();
      const absolute = resolveProfileAvatarLocalPath(config.localRoot, objectKey);
      const buffer = await readFile(absolute);
      const contentType = objectKey.endsWith('.png') ? 'image/png' : 'image/webp';
      return { buffer, contentType };
    }

    throw new ServiceError('Storage de avatar indisponível.', 'AVATAR_STORAGE_UNAVAILABLE', 503);
  }

  async deleteVersionPrefix(userId: string, version: number): Promise<void> {
    const prefix = buildProfileAvatarPrefix(userId, version);

    if (isR2StorageEnabled()) {
      const { client, bucket } = this.getR2Client();
      const listed = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
      );
      const keys = (listed.Contents ?? []).map((item) => item.Key).filter(Boolean) as string[];
      await Promise.all(
        keys.map((key) =>
          client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
        ),
      );
      return;
    }

    if (isLocalStorageEnabled()) {
      const config = getStorageConfig();
      const absolutePrefix = resolveProfileAvatarLocalPath(config.localRoot, prefix);
      const { readdir } = await import('node:fs/promises');
      try {
        const files = await readdir(absolutePrefix);
        await Promise.all(files.map((file) => unlink(path.join(absolutePrefix, file))));
      } catch {
        // pasta pode não existir
      }
    }
  }
}

export const profileAvatarStorage = new ProfileAvatarStorage();

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getStorageInfo } from '@/lib/file-storage';

describe('File Storage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to local provider', () => {
    const info = getStorageInfo();
    expect(info.provider).toBe('local');
    expect(info.configured).toBe(true);
  });

  it('detects s3 provider from env', () => {
    vi.stubEnv('FILE_STORAGE_PROVIDER', 's3');
    vi.stubEnv('AWS_S3_BUCKET', 'test-bucket');
    const info = getStorageInfo();
    expect(info.provider).toBe('s3');
    expect(info.configured).toBe(true);
  });

  it('reports unconfigured s3 when bucket missing', () => {
    vi.stubEnv('FILE_STORAGE_PROVIDER', 's3');
    vi.stubEnv('AWS_S3_BUCKET', '');
    const info = getStorageInfo();
    expect(info.provider).toBe('s3');
    expect(info.configured).toBe(false);
  });

  it('detects r2 provider from env', () => {
    vi.stubEnv('FILE_STORAGE_PROVIDER', 'r2');
    vi.stubEnv('R2_BUCKET', 'test-bucket');
    const info = getStorageInfo();
    expect(info.provider).toBe('r2');
    expect(info.configured).toBe(true);
  });
});

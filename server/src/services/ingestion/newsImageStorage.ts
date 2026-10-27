import { createHash } from 'node:crypto';
import { access, mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Article from '../../models/Article.js';

const IMAGE_DIRECTORY = fileURLToPath(new URL('../../../uploads/news/', import.meta.url));
const PUBLIC_IMAGE_PATH = '/api/media/news';
const MAX_IMAGE_SIZE_BYTES = 1_500_000;
const MAX_LOCAL_IMAGE_COUNT = 300;
const storedImagePaths = new Map<string, string>();
let localImageCount: number | undefined;

const extensionByContentType: Record<string, string> = {
  'image/avif': '.avif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function isHostAllowed(hostname: string, allowedHosts: string[]): boolean {
  return allowedHosts.some((allowedHost) =>
    hostname === allowedHost || hostname.endsWith(`.${allowedHost}`),
  );
}

function getAllowedImageUrl(imageUrl: string, allowedHosts: string[]): URL | undefined {
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== 'https:' || !isHostAllowed(url.hostname, allowedHosts)) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

async function fetchAllowedImage(
  startingUrl: URL,
  allowedHosts: string[],
): Promise<Response | undefined> {
  let imageUrl = startingUrl;

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetch(imageUrl, {
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg' },
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
    });

    if (response.status < 300 || response.status >= 400) return response;

    const redirectLocation = response.headers.get('location');
    if (!redirectLocation || redirectCount === 3) return undefined;

    const nextUrl = getAllowedImageUrl(new URL(redirectLocation, imageUrl).href, allowedHosts);
    if (!nextUrl) return undefined;
    imageUrl = nextUrl;
  }

  return undefined;
}

async function readImageBody(response: Response): Promise<Buffer | undefined> {
  if (!response.body) return undefined;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for await (const chunk of response.body) {
    totalBytes += chunk.byteLength;
    if (totalBytes > MAX_IMAGE_SIZE_BYTES) return undefined;
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export async function storeNewsImage(
  imageUrl: string,
  allowedHosts: string[],
): Promise<string | undefined> {
  const parsedUrl = getAllowedImageUrl(imageUrl, allowedHosts);
  if (!parsedUrl) return undefined;

  const cachedPath = storedImagePaths.get(imageUrl);
  if (cachedPath) {
    try {
      await access(path.join(IMAGE_DIRECTORY, path.basename(cachedPath)));
      return cachedPath;
    } catch {
      storedImagePaths.delete(imageUrl);
    }
  }

  try {
    const response = await fetchAllowedImage(parsedUrl, allowedHosts);
    if (!response) return undefined;
    if (!response.ok) return undefined;

    const finalUrl = getAllowedImageUrl(response.url, allowedHosts);
    if (!finalUrl) return undefined;

    const rawContentType = response.headers.get('content-type');
    const contentType = rawContentType?.split(';')[0]?.trim().toLowerCase();
    const extension = contentType ? extensionByContentType[contentType] : undefined;
    if (!extension) return undefined;

    const declaredSize = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_SIZE_BYTES) {
      return undefined;
    }

    const imageBytes = await readImageBody(response);
    if (!imageBytes?.length) return undefined;

    await mkdir(IMAGE_DIRECTORY, { recursive: true });
    if (localImageCount === undefined) {
      const existingFiles = await readdir(IMAGE_DIRECTORY, { withFileTypes: true });
      localImageCount = existingFiles.filter((file) => file.isFile()).length;
    }
    if (localImageCount >= MAX_LOCAL_IMAGE_COUNT) return undefined;

    const fileName = `${createHash('sha256').update(imageUrl).digest('hex')}${extension}`;
    const filePath = path.join(IMAGE_DIRECTORY, fileName);

    localImageCount += 1;
    try {
      await writeFile(filePath, imageBytes, { flag: 'wx' });
    } catch (error) {
      localImageCount -= 1;
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }

    const publicPath = `${PUBLIC_IMAGE_PATH}/${fileName}`;
    storedImagePaths.set(imageUrl, publicPath);
    return publicPath;
  } catch (error) {
    console.warn(`[NEWS] Could not cache image from ${parsedUrl.hostname}:`, error);
    return undefined;
  }
}

export async function removeUnreferencedNewsImages(): Promise<void> {
  try {
    const articlesWithLocalImages = await Article.find({
      imageUrl: { $regex: '^/api/media/news/' },
    }).select('imageUrl').lean();
    const referencedFileNames = new Set(
      articlesWithLocalImages.map((article) => path.basename(article.imageUrl ?? '')),
    );
    const files = await readdir(IMAGE_DIRECTORY, { withFileTypes: true });

    for (const file of files) {
      if (file.isFile() && !referencedFileNames.has(file.name)) {
        await unlink(path.join(IMAGE_DIRECTORY, file.name));
      }
    }
    localImageCount = files.filter(
      (file) => file.isFile() && referencedFileNames.has(file.name),
    ).length;
    for (const [sourceUrl, localPath] of storedImagePaths) {
      if (!referencedFileNames.has(path.basename(localPath))) {
        storedImagePaths.delete(sourceUrl);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[NEWS] Could not clean unused local article images:', error);
    }
  }
}

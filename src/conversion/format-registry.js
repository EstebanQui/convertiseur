import path from 'path';

export const SUPPORTED_SOURCE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
export const SUPPORTED_OUTPUT_FORMATS = ['pdf', 'webp', 'svg'];
export const SUPPORTED_UPLOAD_MIME_TYPES = ['image/png', 'image/jpeg'];

export function normalizeExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

export function getBaseNameWithoutExtension(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

export function isSupportedSourceExtension(filePath) {
  return SUPPORTED_SOURCE_EXTENSIONS.includes(normalizeExtension(filePath));
}

export function isSupportedUploadMimeType(mimeType) {
  return SUPPORTED_UPLOAD_MIME_TYPES.includes(mimeType);
}

export function isSupportedOutputFormat(format) {
  return SUPPORTED_OUTPUT_FORMATS.includes(String(format).toLowerCase());
}

export function ensureSupportedOutputFormat(format) {
  const normalizedFormat = String(format).toLowerCase();

  if (!isSupportedOutputFormat(normalizedFormat)) {
    throw new Error(
      `Type de conversion invalide. Utilisez ${SUPPORTED_OUTPUT_FORMATS.join(', ')}.`,
    );
  }

  return normalizedFormat;
}

export function buildOutputFilePath(outputDirectory, inputFilePath, targetFormat) {
  return path.join(
    outputDirectory,
    `${getBaseNameWithoutExtension(inputFilePath)}.${targetFormat}`,
  );
}

export function replacePathExtension(filePath, targetFormat) {
  return path.join(
    path.dirname(filePath),
    `${getBaseNameWithoutExtension(filePath)}.${targetFormat}`,
  );
}

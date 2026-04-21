import fs from 'fs/promises';
import path from 'path';
import { discoverSupportedFiles } from './file-discovery.js';
import {
  buildOutputFilePath,
  ensureSupportedOutputFormat,
  isSupportedSourceExtension,
} from './format-registry.js';
import {
  convertImageToPdf,
  convertImageToSvg,
  convertImageToWebp,
} from './image-converters.js';

async function dispatchConversion(inputPath, outputPath, targetFormat) {
  if (targetFormat === 'webp') {
    await convertImageToWebp(inputPath, outputPath);
    return;
  }

  if (targetFormat === 'pdf') {
    await convertImageToPdf(inputPath, outputPath);
    return;
  }

  if (targetFormat === 'svg') {
    await convertImageToSvg(inputPath, outputPath);
    return;
  }

  throw new Error(`Type de conversion invalide. Utilisez pdf, webp, svg.`);
}

export async function convertFile(inputPath, outputPath, targetFormat) {
  if (!isSupportedSourceExtension(inputPath)) {
    throw new Error('Le fichier source doit etre au format PNG, JPG ou JPEG.');
  }

  const normalizedTargetFormat = ensureSupportedOutputFormat(targetFormat);
  const outputDirectory = path.dirname(outputPath);
  await fs.mkdir(outputDirectory, { recursive: true });
  await dispatchConversion(inputPath, outputPath, normalizedTargetFormat);
}

export async function processDirectory(inputDirectory, outputDirectory, targetFormat, recursive) {
  const normalizedTargetFormat = ensureSupportedOutputFormat(targetFormat);
  await fs.mkdir(outputDirectory, { recursive: true });

  const files = await discoverSupportedFiles(inputDirectory, recursive);
  if (files.length === 0) {
    return { files: [], successCount: 0, failures: [] };
  }

  let successCount = 0;
  const failures = [];
  for (const filePath of files) {
    const relativePath = path.relative(inputDirectory, filePath);
    const outputSubDirectory = path.dirname(path.join(outputDirectory, relativePath));
    await fs.mkdir(outputSubDirectory, { recursive: true });

    const outputFilePath = buildOutputFilePath(outputSubDirectory, filePath, normalizedTargetFormat);

    try {
      await dispatchConversion(filePath, outputFilePath, normalizedTargetFormat);
      successCount += 1;
    } catch (error) {
      failures.push({
        inputPath: filePath,
        outputPath: outputFilePath,
        message: error.message,
      });
    }
  }

  return { files, successCount, failures };
}

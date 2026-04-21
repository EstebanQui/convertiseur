import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { discoverSupportedFiles } from '../src/conversion/file-discovery.js';
import { convertFile, processDirectory } from '../src/conversion/converter-service.js';

async function createTempDirectory() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'dark-spell-converter-test-'));
}

async function createPng(filePath) {
  await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
             <rect width="32" height="32" fill="white"/>
             <circle cx="16" cy="16" r="10" fill="black"/>
           </svg>`,
        ),
      },
    ])
    .png()
    .toFile(filePath);
}

async function createJpeg(filePath) {
  await sharp({
    create: {
      width: 24,
      height: 24,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
             <rect width="24" height="24" fill="#f0f0f0"/>
             <path d="M4 20 L12 4 L20 20 Z" fill="#202020"/>
           </svg>`,
        ),
      },
    ])
    .jpeg()
    .toFile(filePath);
}

test('convertFile keeps png to webp working', async () => {
  const tempDirectory = await createTempDirectory();
  const inputFile = path.join(tempDirectory, 'shape.png');
  const outputFile = path.join(tempDirectory, 'shape.webp');

  await createPng(inputFile);
  await convertFile(inputFile, outputFile, 'webp');

  const metadata = await sharp(outputFile).metadata();
  assert.equal(metadata.format, 'webp');
});

test('convertFile supports jpeg to pdf', async () => {
  const tempDirectory = await createTempDirectory();
  const inputFile = path.join(tempDirectory, 'shape.jpg');
  const outputFile = path.join(tempDirectory, 'shape.pdf');

  await createJpeg(inputFile);
  await convertFile(inputFile, outputFile, 'pdf');

  const pdfBytes = await fs.readFile(outputFile, 'utf8');
  assert.match(pdfBytes.slice(0, 8), /^%PDF-/);
});

test('convertFile generates non-empty svg output', async () => {
  const tempDirectory = await createTempDirectory();
  const inputFile = path.join(tempDirectory, 'shape.png');
  const outputFile = path.join(tempDirectory, 'shape.svg');

  await createPng(inputFile);
  await convertFile(inputFile, outputFile, 'svg');

  const svgContent = await fs.readFile(outputFile, 'utf8');
  assert.match(svgContent, /<svg[\s>]/i);
  assert.match(svgContent, /<path[\s>]/i);
});

test('discoverSupportedFiles and processDirectory support mixed png jpg jpeg inputs', async () => {
  const tempDirectory = await createTempDirectory();
  const nestedDirectory = path.join(tempDirectory, 'nested');
  const outputDirectory = path.join(tempDirectory, 'output');

  await fs.mkdir(nestedDirectory, { recursive: true });
  await createPng(path.join(tempDirectory, 'first.png'));
  await createJpeg(path.join(tempDirectory, 'second.jpg'));
  await createJpeg(path.join(nestedDirectory, 'third.jpeg'));
  await fs.writeFile(path.join(tempDirectory, 'ignored.txt'), 'not an image');

  const discoveredFiles = await discoverSupportedFiles(tempDirectory, true);
  assert.equal(discoveredFiles.length, 3);

  const result = await processDirectory(tempDirectory, outputDirectory, 'svg', true);
  assert.equal(result.files.length, 3);
  assert.equal(result.successCount, 3);
  assert.equal(result.failures.length, 0);

  const outputFiles = await discoverSupportedFiles(outputDirectory, true);
  assert.equal(outputFiles.length, 0);
  const svgFile = await fs.readFile(path.join(outputDirectory, 'nested', 'third.svg'), 'utf8');
  assert.match(svgFile, /<svg[\s>]/i);
});

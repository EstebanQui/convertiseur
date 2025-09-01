#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

const program = new Command();

program
  .name('dark-spell-converter')
  .description('Convert PNG files to PDF or WebP format')
  .version('1.0.0')
  .author('Moi');

program
  .requiredOption('-i, --input <path>', 'Input file or directory path')
  .requiredOption('-o, --output <path>', 'Output file or directory path')
  .requiredOption('-t, --type <type>', 'Output type (pdf or webp)')
  .option('-r, --recursive', 'Process directories recursively', false)
  .parse(process.argv);

const options = program.opts();

async function convertPngToWebp(inputPath, outputPath) {
  await sharp(inputPath).webp({ quality: 90 }).toFile(outputPath);
}

async function convertPngToPdf(inputPath, outputPath) {
  const image = await sharp(inputPath).toBuffer();
  const { width, height } = await sharp(inputPath).metadata();

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([width, height]);

  const pngImage = await pdfDoc.embedPng(image);
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width,
    height,
  });

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);
}

async function convertFile(inputPath, outputPath, type) {
  try {
    const spinner = ora(`Converting ${path.basename(inputPath)} to ${type}`).start();

    if (type === 'webp') {
      await convertPngToWebp(inputPath, outputPath);
    } else if (type === 'pdf') {
      await convertPngToPdf(inputPath, outputPath);
    }

    spinner.succeed(`Converted ${path.basename(inputPath)} to ${path.basename(outputPath)}`);
    return true;
  } catch (error) {
    console.error(chalk.red(`Error converting ${inputPath}: ${error.message}`));
    return false;
  }
}

async function processDirectory(inputDir, outputDir, type, recursive) {
  try {
    await fs.mkdir(outputDir, { recursive: true });

    const pattern = recursive ? `${inputDir}/**/*.png` : `${inputDir}/*.png`;
    const files = await glob(pattern);

    if (files.length === 0) {
      console.log(chalk.yellow(`No PNG files found in ${inputDir}`));
      return;
    }

    console.log(chalk.blue(`Found ${files.length} PNG files to convert`));

    let successCount = 0;
    for (const file of files) {
      const relativePath = path.relative(inputDir, file);
      const outputSubdir = path.dirname(path.join(outputDir, relativePath));
      await fs.mkdir(outputSubdir, { recursive: true });

      const outputFile = path.join(outputSubdir, `${path.basename(file, '.png')}.${type}`);

      const success = await convertFile(file, outputFile, type);
      if (success) successCount++;
    }

    console.log(
      chalk.green(
        `Conversion complete: ${successCount} of ${files.length} files converted successfully`,
      ),
    );
  } catch (error) {
    console.error(chalk.red(`Error processing directory: ${error.message}`));
  }
}

async function main() {
  try {
    const { input, output, type, recursive } = options;

    if (type !== 'pdf' && type !== 'webp') {
      console.error(chalk.red('Error: Type must be either "pdf" or "webp"'));
      process.exit(1);
    }

    const inputStat = await fs.stat(input).catch(() => null);
    if (!inputStat) {
      console.error(chalk.red(`Error: Input path "${input}" does not exist`));
      process.exit(1);
    }

    if (inputStat.isDirectory()) {
      await processDirectory(input, output, type, recursive);
    } else if (path.extname(input).toLowerCase() === '.png') {
      // Ensure output directory exists
      const outputDir = path.dirname(output);
      await fs.mkdir(outputDir, { recursive: true });

      await convertFile(input, output, type);
    } else {
      console.error(chalk.red('Error: Input file must be a PNG image'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`Unexpected error: ${error.message}`));
    process.exit(1);
  }
}

main();

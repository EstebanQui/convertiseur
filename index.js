#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { convertFile, processDirectory } from './src/conversion/converter-service.js';
import {
  SUPPORTED_SOURCE_EXTENSIONS,
  ensureSupportedOutputFormat,
  isSupportedSourceExtension,
} from './src/conversion/format-registry.js';

const program = new Command();

program
  .name('dark-spell-converter')
  .description('Convert PNG, JPG or JPEG files to PDF, WebP or SVG format')
  .version('1.0.0');

program
  .requiredOption('-i, --input <path>', 'Input file or directory path')
  .requiredOption('-o, --output <path>', 'Output file or directory path')
  .requiredOption('-t, --type <type>', 'Output type (pdf, webp or svg)')
  .option('-r, --recursive', 'Process directories recursively', false)
  .parse(process.argv);

const options = program.opts();

async function convertSingleFile(inputPath, outputPath, type) {
  try {
    const spinner = ora(`Converting ${path.basename(inputPath)} to ${type}`).start();
    await convertFile(inputPath, outputPath, type);

    spinner.succeed(`Converted ${path.basename(inputPath)} to ${path.basename(outputPath)}`);
    return true;
  } catch (error) {
    console.error(chalk.red(`Error converting ${inputPath}: ${error.message}`));
    return false;
  }
}

async function processDirectoryWithFeedback(inputDir, outputDir, type, recursive) {
  try {
    const { files, successCount, failures } = await processDirectory(inputDir, outputDir, type, recursive);
    if (files.length === 0) {
      console.log(
        chalk.yellow(
          `No supported image files found in ${inputDir}. Accepted extensions: ${SUPPORTED_SOURCE_EXTENSIONS.join(', ')}`,
        ),
      );
      return;
    }

    console.log(chalk.blue(`Found ${files.length} image files to convert`));

    console.log(
      chalk.green(
        `Conversion complete: ${successCount} of ${files.length} files converted successfully`,
      ),
    );

    for (const failure of failures) {
      console.error(chalk.red(`Failed to convert ${failure.inputPath}: ${failure.message}`));
    }
  } catch (error) {
    console.error(chalk.red(`Error processing directory: ${error.message}`));
  }
}

async function main() {
  try {
    const { input, output, type, recursive } = options;
    const normalizedType = ensureSupportedOutputFormat(type);

    const inputStat = await fs.stat(input).catch(() => null);
    if (!inputStat) {
      console.error(chalk.red(`Error: Input path "${input}" does not exist`));
      process.exit(1);
    }

    if (inputStat.isDirectory()) {
      await processDirectoryWithFeedback(input, output, normalizedType, recursive);
    } else if (isSupportedSourceExtension(input)) {
      // Ensure output directory exists
      const outputDir = path.dirname(output);
      await fs.mkdir(outputDir, { recursive: true });

      await convertSingleFile(input, output, normalizedType);
    } else {
      console.error(
        chalk.red(
          `Error: Input file must use one of these extensions: ${SUPPORTED_SOURCE_EXTENSIONS.join(', ')}`,
        ),
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`Unexpected error: ${error.message}`));
    process.exit(1);
  }
}

main();

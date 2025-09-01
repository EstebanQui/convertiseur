#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import inquirer from 'inquirer';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const program = new Command();

program
  .name('dark-spell-converter')
  .description('Convertisseur de fichiers PNG vers PDF ou WebP')
  .version('1.0.0');

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
    const spinner = ora(`Conversion de ${path.basename(inputPath)} en ${type}`).start();

    if (type === 'webp') {
      await convertPngToWebp(inputPath, outputPath);
    } else if (type === 'pdf') {
      await convertPngToPdf(inputPath, outputPath);
    }

    spinner.succeed(
      `Conversion réussie: ${path.basename(inputPath)} → ${path.basename(outputPath)}`,
    );
    return true;
  } catch (error) {
    console.error(chalk.red(`Erreur lors de la conversion de ${inputPath}: ${error.message}`));
    return false;
  }
}

async function processDirectory(inputDir, outputDir, type, recursive) {
  try {
    await fs.mkdir(outputDir, { recursive: true });

    const pattern = recursive ? `${inputDir}/**/*.png` : `${inputDir}/*.png`;
    const files = await glob(pattern);

    if (files.length === 0) {
      console.log(chalk.yellow(`Aucun fichier PNG trouvé dans ${inputDir}`));
      return 0;
    }

    console.log(chalk.blue(`${files.length} fichiers PNG trouvés pour la conversion`));

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
        `Conversion terminée: ${successCount} sur ${files.length} fichiers convertis avec succès`,
      ),
    );
    return successCount;
  } catch (error) {
    console.error(chalk.red(`Erreur lors du traitement du répertoire: ${error.message}`));
    return 0;
  }
}

// Fonction pour ouvrir le sélecteur de dossier natif
function openFolderPicker(message) {
  try {
    // Système d'exploitation macOS
    if (process.platform === 'darwin') {
      const command = `osascript -e 'tell application "System Events" to return POSIX path of (choose folder with prompt "${message}")'`;
      const result = execSync(command).toString().trim();
      return result;
    }
    // Pour Windows et Linux, on utilise inquirer pour demander le chemin manuellement
    return null;
  } catch (error) {
    return null;
  }
}

async function main() {
  try {
    console.log(chalk.cyan.bold('🧙‍♂️ Dark Spell Converter 🧙‍♂️'));
    console.log(chalk.cyan('Convertisseur de fichiers PNG vers PDF ou WebP\n'));

    const choices = [
      {
        name: 'Convertir un fichier PNG spécifique',
        value: 'single',
      },
      {
        name: "Convertir tous les PNG d'un dossier",
        value: 'directory',
      },
      {
        name: 'Convertir un dossier et ses sous-dossiers',
        value: 'recursive',
      },
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Que souhaitez-vous faire ?',
        choices,
      },
    ]);

    let inputPath;

    if (action === 'single') {
      // Pour l'instant, on demande le chemin manuellement
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: 'Entrez le chemin complet du fichier PNG:',
          validate: async (input) => {
            if (!input) return 'Le chemin ne peut pas être vide';
            if (!existsSync(input)) return "Le fichier n'existe pas";
            if (!input.toLowerCase().endsWith('.png')) return 'Le fichier doit être au format PNG';
            return true;
          },
        },
      ]);
      inputPath = input;
    } else {
      let folderPath = openFolderPicker('Sélectionnez le dossier contenant les images PNG:');

      if (!folderPath) {
        // Si le sélecteur natif ne fonctionne pas, on demande le chemin manuellement
        const { input } = await inquirer.prompt([
          {
            type: 'input',
            name: 'input',
            message: 'Entrez le chemin du dossier contenant les PNG:',
            validate: async (input) => {
              if (!input) return 'Le chemin ne peut pas être vide';
              if (!existsSync(input)) return "Le dossier n'existe pas";
              return true;
            },
          },
        ]);
        folderPath = input;
      }

      inputPath = folderPath;
    }

    const { type } = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Choisissez le format de conversion:',
        choices: [
          { name: 'PDF', value: 'pdf' },
          { name: 'WebP', value: 'webp' },
        ],
      },
    ]);

    let outputPath = openFolderPicker(
      'Sélectionnez le dossier où enregistrer les fichiers convertis:',
    );

    if (!outputPath) {
      // Si le sélecteur natif ne fonctionne pas, on demande le chemin manuellement
      const { output } = await inquirer.prompt([
        {
          type: 'input',
          name: 'output',
          message: 'Entrez le chemin du dossier où enregistrer les fichiers convertis:',
          default: path.join(process.cwd(), 'output'),
        },
      ]);
      outputPath = output;
    }

    // Si c'est un fichier unique, on ajoute le nom du fichier au chemin de sortie
    if (action === 'single') {
      const fileName = path.basename(inputPath, '.png') + '.' + type;
      outputPath = path.join(outputPath, fileName);
    }

    // Confirmation finale
    console.log(chalk.cyan('\nRécapitulatif:'));
    console.log(`Source: ${chalk.yellow(inputPath)}`);
    console.log(`Destination: ${chalk.yellow(outputPath)}`);
    console.log(`Format: ${chalk.yellow(type.toUpperCase())}`);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Voulez-vous lancer la conversion ?',
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow('Conversion annulée.'));
      return;
    }

    const inputStat = await fs.stat(inputPath).catch(() => null);
    if (!inputStat) {
      console.error(chalk.red(`Erreur: Le chemin d'entrée "${inputPath}" n'existe pas`));
      return;
    }

    let result;

    if (action === 'single') {
      // Assurer que le dossier parent existe
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      result = await convertFile(inputPath, outputPath, type);
    } else {
      const recursive = action === 'recursive';
      result = await processDirectory(inputPath, outputPath, type, recursive);
    }

    if (result) {
      console.log(chalk.green.bold('\nConversion terminée avec succès! 🎉'));
      console.log(chalk.green(`Les fichiers convertis sont disponibles dans: ${outputPath}`));
    }
  } catch (error) {
    console.error(chalk.red(`Erreur inattendue: ${error.message}`));
  }
}

main();

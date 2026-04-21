#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { convertFile, processDirectory } from './src/conversion/converter-service.js';
import {
  SUPPORTED_SOURCE_EXTENSIONS,
  isSupportedSourceExtension,
} from './src/conversion/format-registry.js';

const program = new Command();

program
  .name('dark-spell-converter')
  .description('Convertisseur de fichiers PNG, JPG ou JPEG vers PDF, WebP ou SVG')
  .version('1.0.0');

async function convertSingleFile(inputPath, outputPath, type) {
  try {
    const spinner = ora(`Conversion de ${path.basename(inputPath)} en ${type}`).start();
    await convertFile(inputPath, outputPath, type);

    spinner.succeed(
      `Conversion réussie: ${path.basename(inputPath)} → ${path.basename(outputPath)}`,
    );
    return true;
  } catch (error) {
    console.error(chalk.red(`Erreur lors de la conversion de ${inputPath}: ${error.message}`));
    return false;
  }
}

async function processDirectoryWithFeedback(inputDir, outputDir, type, recursive) {
  try {
    const { files, successCount, failures } = await processDirectory(inputDir, outputDir, type, recursive);
    if (files.length === 0) {
      console.log(
        chalk.yellow(
          `Aucune image supportée trouvée dans ${inputDir}. Extensions acceptées: ${SUPPORTED_SOURCE_EXTENSIONS.join(', ')}`,
        ),
      );
      return 0;
    }

    console.log(chalk.blue(`${files.length} images trouvées pour la conversion`));

    console.log(
      chalk.green(
        `Conversion terminée: ${successCount} sur ${files.length} fichiers convertis avec succès`,
      ),
    );

    for (const failure of failures) {
      console.error(chalk.red(`Échec de conversion pour ${failure.inputPath}: ${failure.message}`));
    }

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
    console.log(chalk.cyan('Convertisseur de fichiers PNG, JPG ou JPEG vers PDF, WebP ou SVG\n'));

    const choices = [
      {
        name: 'Convertir un fichier image spécifique',
        value: 'single',
      },
      {
        name: "Convertir toutes les images supportées d'un dossier",
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
          message: 'Entrez le chemin complet du fichier image:',
          validate: async (input) => {
            if (!input) return 'Le chemin ne peut pas être vide';
            if (!existsSync(input)) return "Le fichier n'existe pas";
            if (!isSupportedSourceExtension(input)) {
              return `Le fichier doit être au format ${SUPPORTED_SOURCE_EXTENSIONS.join(', ')}`;
            }
            return true;
          },
        },
      ]);
      inputPath = input;
    } else {
      let folderPath = openFolderPicker('Sélectionnez le dossier contenant les images:');

      if (!folderPath) {
        // Si le sélecteur natif ne fonctionne pas, on demande le chemin manuellement
        const { input } = await inquirer.prompt([
          {
            type: 'input',
            name: 'input',
            message: 'Entrez le chemin du dossier contenant les images:',
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
          { name: 'SVG', value: 'svg' },
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
      const fileName = `${path.basename(inputPath, path.extname(inputPath))}.${type}`;
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

      result = await convertSingleFile(inputPath, outputPath, type);
    } else {
      const recursive = action === 'recursive';
      result = await processDirectoryWithFeedback(inputPath, outputPath, type, recursive);
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

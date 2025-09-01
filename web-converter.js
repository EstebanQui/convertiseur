#!/usr/bin/env node

import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { glob } from 'glob';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import open from 'open';
import chalk from 'chalk';

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 3000;
const UPLOAD_DIR = path.join(os.tmpdir(), 'dark-spell-converter', 'uploads');
const OUTPUT_DIR = path.join(os.tmpdir(), 'dark-spell-converter', 'output');

// Configuration de multer pour le stockage des fichiers
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// Filtre pour n'accepter que les fichiers PNG
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Seuls les fichiers PNG sont acceptés'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // Limite à 50 MB
  },
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(OUTPUT_DIR));

// Fonctions de conversion
async function convertPngToWebp(inputPath, outputPath) {
  await sharp(inputPath).webp({ quality: 90 }).toFile(outputPath);
  return path.basename(outputPath);
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
  return path.basename(outputPath);
}

// Créer les dossiers nécessaires
async function setupDirectories() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour convertir un ou plusieurs fichiers
app.post('/convert', upload.array('files', 100), async (req, res) => {
  try {
    const { type } = req.body; // pdf ou webp

    if (!type || (type !== 'pdf' && type !== 'webp')) {
      return res
        .status(400)
        .json({ error: 'Type de conversion invalide. Utilisez "pdf" ou "webp".' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Aucun fichier n'a été téléchargé." });
    }

    // Créer un dossier unique pour cette conversion
    const outputSessionDir = path.join(OUTPUT_DIR, uuidv4());
    await fs.mkdir(outputSessionDir, { recursive: true });

    // Convertir tous les fichiers
    const results = [];
    for (const file of req.files) {
      const outputFile = path.join(
        outputSessionDir,
        `${path.basename(file.filename, '.png')}.${type}`,
      );

      let result;
      if (type === 'webp') {
        result = await convertPngToWebp(file.path, outputFile);
      } else if (type === 'pdf') {
        result = await convertPngToPdf(file.path, outputFile);
      }

      results.push({
        originalName: file.originalname,
        convertedName: path.basename(outputFile),
        downloadPath: `/downloads/${path.basename(outputSessionDir)}/${path.basename(outputFile)}`,
        format: type,
      });
    }

    res.json({
      success: true,
      message: `${req.files.length} fichiers convertis avec succès.`,
      results,
      sessionDir: path.basename(outputSessionDir),
    });
  } catch (error) {
    console.error('Erreur lors de la conversion:', error);
    res.status(500).json({ error: `Erreur lors de la conversion: ${error.message}` });
  }
});

// Route pour convertir un dossier
app.post('/convert-folder', async (req, res) => {
  try {
    const { folderPath, type, recursive } = req.body;

    if (!folderPath || !type || (type !== 'pdf' && type !== 'webp')) {
      return res.status(400).json({ error: 'Paramètres invalides.' });
    }

    // Vérifier si le dossier existe
    try {
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: "Le chemin spécifié n'est pas un dossier." });
      }
    } catch (error) {
      return res.status(400).json({ error: "Le dossier spécifié n'existe pas." });
    }

    // Créer un dossier unique pour cette conversion
    const sessionId = uuidv4();
    const outputSessionDir = path.join(OUTPUT_DIR, sessionId);
    await fs.mkdir(outputSessionDir, { recursive: true });

    // Trouver tous les fichiers PNG dans le dossier
    const pattern = recursive === 'true' ? `${folderPath}/**/*.png` : `${folderPath}/*.png`;
    const files = await glob(pattern);

    if (files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier PNG trouvé dans le dossier spécifié.' });
    }

    // Convertir tous les fichiers
    const results = [];
    for (const file of files) {
      const relativePath = path.relative(folderPath, file);
      const outputSubdir = path.dirname(path.join(outputSessionDir, relativePath));
      await fs.mkdir(outputSubdir, { recursive: true });

      const outputFile = path.join(outputSubdir, `${path.basename(file, '.png')}.${type}`);

      let result;
      if (type === 'webp') {
        result = await convertPngToWebp(file, outputFile);
      } else if (type === 'pdf') {
        result = await convertPngToPdf(file, outputFile);
      }

      results.push({
        originalPath: file,
        convertedName: path.basename(outputFile),
        relativePath: relativePath,
        downloadPath: `/downloads/${sessionId}/${relativePath.replace(/\.png$/, `.${type}`)}`,
        format: type,
      });
    }

    res.json({
      success: true,
      message: `${files.length} fichiers convertis avec succès.`,
      results,
      sessionId,
    });
  } catch (error) {
    console.error('Erreur lors de la conversion du dossier:', error);
    res.status(500).json({ error: `Erreur lors de la conversion: ${error.message}` });
  }
});

// Route pour télécharger tous les fichiers sous forme d'archive ZIP
app.get('/download-all/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const sessionDir = path.join(OUTPUT_DIR, sessionId);

  try {
    // Vérifier si le dossier existe
    await fs.access(sessionDir);

    // Créer une archive ZIP (implémentation à faire, besoin d'ajouter une dépendance comme archiver)
    res.json({
      message: 'Téléchargement groupé pas encore implémenté',
      files: await fs.readdir(sessionDir),
    });
  } catch (error) {
    res.status(404).json({ error: 'Session introuvable' });
  }
});

// Route pour supprimer une session
app.delete('/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const sessionDir = path.join(OUTPUT_DIR, sessionId);

  try {
    await fs.rm(sessionDir, { recursive: true, force: true });
    res.json({ success: true, message: 'Session supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ error: `Erreur lors de la suppression: ${error.message}` });
  }
});

// Démarrer le serveur
async function startServer() {
  try {
    await setupDirectories();

    app.listen(port, () => {
      console.log(chalk.cyan.bold('🧙‍♂️ Dark Spell Converter - Interface Web 🧙‍♂️'));
      console.log(chalk.green(`Serveur démarré à l'adresse: http://localhost:${port}`));
      console.log(chalk.yellow('Ouverture du navigateur...'));

      // Ouvrir le navigateur automatiquement
      open(`http://localhost:${port}`);
    });
  } catch (error) {
    console.error(chalk.red(`Erreur lors du démarrage du serveur: ${error.message}`));
    process.exit(1);
  }
}

startServer();

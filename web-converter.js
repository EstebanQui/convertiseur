#!/usr/bin/env node

import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import open from 'open';
import chalk from 'chalk';
import { convertFile } from './src/conversion/converter-service.js';
import { discoverSupportedFiles } from './src/conversion/file-discovery.js';
import {
  SUPPORTED_SOURCE_EXTENSIONS,
  isSupportedUploadMimeType,
  ensureSupportedOutputFormat,
  getBaseNameWithoutExtension,
  replacePathExtension,
} from './src/conversion/format-registry.js';

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

// Filtre pour n'accepter que les formats d'image supportés
const fileFilter = (req, file, cb) => {
  if (isSupportedUploadMimeType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Seuls les fichiers ${SUPPORTED_SOURCE_EXTENSIONS.map((extension) => extension.slice(1).toUpperCase()).join(', ')} sont acceptes`,
      ),
      false,
    );
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
    const type = ensureSupportedOutputFormat(req.body.type);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Aucun fichier n'a été téléchargé." });
    }

    // Créer un dossier unique pour cette conversion
    const outputSessionDir = path.join(OUTPUT_DIR, uuidv4());
    await fs.mkdir(outputSessionDir, { recursive: true });

    // Convertir tous les fichiers
    const results = [];
    for (const file of req.files) {
      const outputFile = path.join(outputSessionDir, `${getBaseNameWithoutExtension(file.filename)}.${type}`);
      await convertFile(file.path, outputFile, type);

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
    const statusCode = error.message.startsWith('Type de conversion invalide') ? 400 : 500;
    console.error('Erreur lors de la conversion:', error);
    res.status(statusCode).json({ error: `Erreur lors de la conversion: ${error.message}` });
  }
});

// Route pour convertir un dossier
app.post('/convert-folder', async (req, res) => {
  try {
    const { folderPath, recursive } = req.body;
    const type = ensureSupportedOutputFormat(req.body.type);

    if (!folderPath) {
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

    // Trouver tous les fichiers image supportés dans le dossier
    const files = await discoverSupportedFiles(folderPath, recursive === 'true');

    if (files.length === 0) {
      return res.status(400).json({
        error: `Aucune image supportée trouvée dans le dossier spécifié. Extensions acceptées: ${SUPPORTED_SOURCE_EXTENSIONS.join(', ')}`,
      });
    }

    // Convertir tous les fichiers
    const results = [];
    for (const file of files) {
      const relativePath = path.relative(folderPath, file);
      const outputSubdir = path.dirname(path.join(outputSessionDir, relativePath));
      await fs.mkdir(outputSubdir, { recursive: true });

      const outputFile = path.join(outputSubdir, `${getBaseNameWithoutExtension(file)}.${type}`);
      await convertFile(file, outputFile, type);

      results.push({
        originalPath: file,
        convertedName: path.basename(outputFile),
        relativePath: relativePath,
        downloadPath: `/downloads/${sessionId}/${replacePathExtension(relativePath, type)}`,
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
    const statusCode = error.message.startsWith('Type de conversion invalide') ? 400 : 500;
    console.error('Erreur lors de la conversion du dossier:', error);
    res.status(statusCode).json({ error: `Erreur lors de la conversion: ${error.message}` });
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

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: `Erreur de téléchargement: ${error.message}` });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return next();
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

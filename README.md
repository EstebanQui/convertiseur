# Converter

Un convertisseur de fichiers PNG vers PDF ou WebP.

## Installation

```bash
# Installer les dépendances
npm install
```

## Utilisation

Il y a trois façons d'utiliser ce convertisseur:

### 1. Mode Interface Web (Recommandé)

```bash
# Lancer l'application web
npm run web
```

Cette commande lance un serveur web local et ouvre automatiquement votre navigateur avec l'interface graphique qui vous permet de:

- Glisser-déposer vos fichiers PNG
- Choisir entre les formats PDF et WebP
- Convertir un ou plusieurs fichiers en même temps
- Convertir des dossiers entiers (avec ou sans sous-dossiers)
- Prévisualiser les fichiers avant la conversion
- Télécharger les fichiers convertis individuellement ou en masse

L'interface web offre l'expérience la plus conviviale avec le glisser-déposer et la prévisualisation.

### 2. Mode interactif

```bash
# Lancer l'application interactive en ligne de commande
npm run interactive
```

Cette commande lance une interface interactive en ligne de commande qui vous guidera pas à pas:

1. Choisir entre convertir un fichier ou un dossier
2. Sélectionner le fichier/dossier source
3. Choisir le format de destination (PDF ou WebP)
4. Sélectionner le dossier où enregistrer les fichiers convertis

Sur macOS, le programme ouvrira automatiquement un sélecteur de fichier/dossier natif.

### 3. Mode en ligne de commande

```bash
# Convertir un fichier PNG en PDF
node index.js --input image.png --output image.pdf --type pdf

# Convertir un fichier PNG en WebP
node index.js --input image.png --output image.webp --type webp

# Convertir tous les fichiers PNG d'un dossier en PDF
node index.js --input ./images --output ./output --type pdf

# Convertir tous les fichiers PNG d'un dossier et ses sous-dossiers en WebP
node index.js --input ./images --output ./output --type webp --recursive
```

## Options en ligne de commande

- `-i, --input <path>` : Chemin du fichier ou dossier d'entrée (requis)
- `-o, --output <path>` : Chemin du fichier ou dossier de sortie (requis)
- `-t, --type <type>` : Format de sortie, "pdf" ou "webp" (requis)
- `-r, --recursive` : Traite les sous-dossiers (optionnel, par défaut: false)
- `-h, --help` : Affiche l'aide
- `-V, --version` : Affiche la version

## Exemples

1. Convertir une seule image PNG en PDF:

   ```bash
   node index.js -i ./images/photo.png -o ./output/photo.pdf -t pdf
   ```

2. Convertir toutes les images PNG d'un dossier en WebP:

   ```bash
   node index.js -i ./images -o ./output -t webp
   ```

3. Convertir toutes les images PNG d'un dossier et ses sous-dossiers en PDF:
   ```bash
   node index.js -i ./images -o ./output -t pdf -r
   ```

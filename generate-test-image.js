import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

async function generateTestImage(outputPath, width = 800, height = 600, color = 'blue') {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
      <text x="50%" y="50%" font-family="Arial" font-size="40" fill="white" text-anchor="middle" dominant-baseline="middle">
        Test Image
      </text>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(outputPath);

  console.log(`Test image generated at: ${outputPath}`);
}

// Create directories if they don't exist
async function ensureDirectories() {
  await fs.mkdir('test/images', { recursive: true });
  await fs.mkdir('test/images/subfolder', { recursive: true });
}

async function main() {
  await ensureDirectories();

  // Generate test images
  await generateTestImage('test/images/test1.png', 800, 600, 'blue');
  await generateTestImage('test/images/test2.png', 400, 300, 'red');
  await generateTestImage('test/images/subfolder/test3.png', 600, 400, 'green');
}

main().catch(console.error);

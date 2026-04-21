import fs from 'fs/promises';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import ImageTracer from 'imagetracerjs';

const SVG_TRACE_OPTIONS = {
  ltres: 1,
  qtres: 1,
  pathomit: 8,
  rightangleenhance: true,
  colorsampling: 0,
  numberofcolors: 8,
  colorquantcycles: 2,
  layering: 0,
  strokewidth: 0,
  linefilter: false,
  scale: 1,
  roundcoords: 1,
  viewbox: true,
  desc: false,
  blurradius: 1,
  blurdelta: 32,
};

export async function convertImageToWebp(inputPath, outputPath) {
  await sharp(inputPath).webp({ quality: 90 }).toFile(outputPath);
}

export async function convertImageToPdf(inputPath, outputPath) {
  const imageBytes = await fs.readFile(inputPath);
  const metadata = await sharp(inputPath).metadata();
  const width = metadata.width;
  const height = metadata.height;
  const format = metadata.format?.toLowerCase();

  if (!width || !height) {
    throw new Error('Impossible de determiner les dimensions de l image source.');
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([width, height]);

  let embeddedImage;
  if (format === 'png') {
    embeddedImage = await pdfDoc.embedPng(imageBytes);
  } else if (format === 'jpeg' || format === 'jpg') {
    embeddedImage = await pdfDoc.embedJpg(imageBytes);
  } else {
    throw new Error(`Le format source "${format ?? 'inconnu'}" n'est pas supporte pour le PDF.`);
  }

  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width,
    height,
  });

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);
}

export async function convertImageToSvg(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  if (!info.width || !info.height) {
    throw new Error('Impossible de determiner les dimensions de l image source.');
  }

  const imageData = {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data),
  };

  const svgContent = ImageTracer.imagedataToSVG(imageData, SVG_TRACE_OPTIONS);
  await fs.writeFile(outputPath, svgContent, 'utf8');
}

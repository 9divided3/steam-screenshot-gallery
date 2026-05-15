const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const THUMB_DIR = path.join(__dirname, '..', 'thumbnails');
const THUMB_SIZE = 400; // max width/height

async function generate(inputPath) {
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);
  const outputName = `thumb_${basename}_${Date.now()}.webp`;
  const outputPath = path.join(THUMB_DIR, outputName);

  await sharp(inputPath)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(outputPath);

  return outputName;
}

async function getDimensions(inputPath) {
  try {
    const meta = await sharp(inputPath).metadata();
    return { width: meta.width || 0, height: meta.height || 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

async function validate(inputPath) {
  try {
    await sharp(inputPath).metadata();
    return true;
  } catch {
    return false;
  }
}

module.exports = { generate, getDimensions, validate };

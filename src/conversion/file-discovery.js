import { glob } from 'glob';
import { isSupportedSourceExtension } from './format-registry.js';

export async function discoverSupportedFiles(inputDirectory, recursive = false) {
  const pattern = recursive ? `${inputDirectory}/**/*` : `${inputDirectory}/*`;
  const files = await glob(pattern, { nodir: true, nocase: true });

  return files.filter(isSupportedSourceExtension).sort((left, right) => left.localeCompare(right));
}

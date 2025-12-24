import { exec } from 'child_process';

export function pdfToThumbnail(pdfPath: string, outputPng: string) {
  return new Promise((resolve, reject) => {
    exec(
      `pdftoppm -png -singlefile -f 1 -l 1 "${pdfPath}" "${outputPng.replace('.png', '')}"`,
      (err) => (err ? reject(err) : resolve(true)),
    );
  });
}

export function officeToPdf(input: string, outDir: string) {
  return new Promise((resolve, reject) => {
    exec(
      `soffice --headless --convert-to pdf "${input}" --outdir "${outDir}"`,
      (err) => (err ? reject(err) : resolve(true)),
    );
  });
}

export function generateSvgPlaceholder(filename: string, label = 'DOCUMENT') {
  return `
<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f8fafc" />
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle"
        font-size="36" fill="#111827"
        font-family="Arial, Helvetica, sans-serif">
    ${label}
  </text>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
        font-size="20" fill="#6b7280"
        font-family="Arial, Helvetica, sans-serif">
    ${filename}
  </text>
</svg>
`;
}

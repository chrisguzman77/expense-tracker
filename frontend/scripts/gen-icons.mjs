// Renders public/icon.svg to the PNG sizes the manifest and iOS use.
// Run with `npm run gen:icons` after editing the SVG; commit the PNGs.
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const svg = readFileSync("public/icon.svg", "utf8");
const sizes = { "apple-touch-icon.png": 180, "icon-192.png": 192, "icon-512.png": 512 };

for (const [file, size] of Object.entries(sizes)) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(`public/${file}`, png);
  console.log(`public/${file} ${size}x${size}`);
}

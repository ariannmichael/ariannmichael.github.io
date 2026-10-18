// Full-screen PSX post pass: low-res scene texture → sRGB → ordered dither → 15-bit colour.
// Kept trivial on purpose: one nearest texture fetch and a handful of ALU ops per screen pixel.

export const POST_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const POST_FRAGMENT = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uRes;        // internal resolution (px)
uniform float uLevels;    // 2^bits - 1
uniform float uDither;    // dither amplitude in quantisation steps
uniform float uScanlines; // 0 = off, else darkening of odd rows
varying vec2 vUv;

// 4x4 Bayer index by bit interleaving (mirrors bayerIndex() in config.ts)
float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int xy = x ^ y;
  int v = ((xy & 1) << 3) | ((y & 1) << 2) | (((xy >> 1) & 1) << 1) | ((y >> 1) & 1);
  return (float(v) + 0.5) / 16.0 - 0.5;
}

vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  // The render target holds linear colour; quantise in display space like the PS1 framebuffer did
  vec3 c = toSRGB(texture2D(tScene, vUv).rgb);
  vec2 px = floor(vUv * uRes); // dither cells are internal pixels, so the pattern scales with them
  c += bayer4(px) * uDither / uLevels;
  c = floor(clamp(c, 0.0, 1.0) * uLevels + 0.5) / uLevels;
  if (uScanlines > 0.0) c *= 1.0 - uScanlines * mod(px.y, 2.0);
  gl_FragColor = vec4(c, 1.0);
}
`;

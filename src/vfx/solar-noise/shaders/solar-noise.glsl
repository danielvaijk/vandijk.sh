float glyphHash(vec2 value, float seed) {
  vec3 seeded = fract(vec3(value, seed) * vec3(0.1031, 0.11369, 0.13787));
  seeded += dot(seeded, seeded.yzx + 19.19);
  return fract((seeded.x + seeded.y) * seeded.z);
}

float glyphGradient(vec2 cell, vec2 offset, float seed) {
  float angle = glyphHash(cell, seed) * 6.28318530718;
  return dot(vec2(cos(angle), sin(angle)), offset);
}

float glyphPerlin(vec2 point, float seed) {
  vec2 cell = floor(point);
  vec2 offset = point - cell;
  vec2 fade =
    offset * offset * offset * (offset * (offset * 6.0 - 15.0) + 10.0);
  float top = mix(
    glyphGradient(cell, offset, seed),
    glyphGradient(cell + vec2(1.0, 0.0), offset - vec2(1.0, 0.0), seed),
    fade.x
  );
  float bottom = mix(
    glyphGradient(cell + vec2(0.0, 1.0), offset - vec2(0.0, 1.0), seed),
    glyphGradient(cell + vec2(1.0, 1.0), offset - vec2(1.0, 1.0), seed),
    fade.x
  );
  return mix(top, bottom, fade.y);
}

float glyphFractalNoise(vec2 point, float seed) {
  float amplitude = 0.52;
  float frequency = 1.0;
  float total = 0.0;
  float range = 0.0;

  for (int octave = 0; octave < 4; octave += 1) {
    total +=
      glyphPerlin(point * frequency, seed + float(octave) * 101.0) * amplitude;
    range += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return total / range;
}

float glyphSolarBrightness(vec2 cell, float time, float seed) {
  float seconds = time / 1000.0;
  float x = cell.x * 0.075;
  float y = cell.y * 0.075;

  float convection = glyphFractalNoise(
    vec2(x * 0.55 + seconds * 0.035, y * 0.55 - seconds * 0.025),
    seed + 211.0
  );
  float shear = glyphFractalNoise(
    vec2(x * 0.32 - seconds * 0.02, y * 0.32 + seconds * 0.03),
    seed + 353.0
  );
  float burstNoise = glyphFractalNoise(
    vec2(
      x * 0.72 - seconds * 0.11 + convection * 0.35,
      y * 0.72 + seconds * 0.09 + shear * 0.35
    ),
    seed + 1201.0
  );
  float burst = smoothstep(0.48, 0.88, (burstNoise + 1.0) * 0.5);

  float displacement = convection * 2.4 + burst * 1.15;
  float arc =
    sin((x - y) * 1.65 + seconds * 0.62 + convection * 3.4) *
    (0.28 + burst * 0.95);
  float twistX = sin(y * 2.1 + seconds * 0.86 + shear * 4.2) * burst * 1.05;
  float twistY =
    cos(x * 1.9 - seconds * 0.74 + convection * 4.0) * burst * 0.92;
  float flowX =
    x +
    displacement +
    arc +
    twistX +
    sin(y * 1.3 + seconds * 0.45 + shear * 2.4) * 0.45;
  float flowY =
    y +
    shear * 1.85 -
    arc * 0.72 +
    twistY +
    cos(x * 1.1 - seconds * 0.38 + convection * 2.1) * 0.42;

  float plumeNoise = glyphFractalNoise(
    vec2(flowX * 0.95 - seconds * 0.24, flowY * 0.95 + seconds * 0.18),
    seed + 401.0
  );
  float filamentNoise = glyphFractalNoise(
    vec2(
      flowX * 2.6 + plumeNoise * 1.4 - seconds * 0.5,
      flowY * 1.8 - convection * 1.2 + seconds * 0.28
    ),
    seed + 809.0
  );

  float cells = smoothstep(0.34, 0.78, (plumeNoise + 1.0) * 0.5);
  float filaments = smoothstep(0.5, 0.9, (filamentNoise + 1.0) * 0.5);
  float pulse =
    0.5 +
    sin(seconds * 0.7 + convection * 3.2 + shear * 2.4) * 0.06 +
    burst * 0.12;
  float softCells = smoothstep(0.16, 0.82, (plumeNoise + 1.0) * 0.5);
  float coreCells = cells * cells;
  float depth =
    softCells * 0.28 + coreCells * 0.42 + filaments * 0.24 + burst * 0.18;

  return clamp(0.12 + (depth + (convection + 1.0) * 0.07) * pulse, 0.0, 1.0);
}

float glyphNoiseVisualBrightness(float brightness) {
  return clamp(
    brightness / GLYPH_NOISE_VISUAL_WHITE_POINT * u_visual_range,
    0.0,
    1.0
  );
}

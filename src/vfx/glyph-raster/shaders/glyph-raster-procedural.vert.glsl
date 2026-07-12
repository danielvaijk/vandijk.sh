#version 300 es
in vec2 a_corner;
in vec2 a_position;

uniform float u_entropy_seed;
uniform float u_glyph_count;
uniform float u_noise_seed;
uniform float u_source_time;
uniform float u_glyph_frame_rate;
uniform float u_visual_range;
uniform sampler2D u_field_modifier_brightness;
uniform int u_field_modifier_count;
uniform vec2 u_atlas_grid;
uniform vec2 u_canvas_size;
uniform vec2 u_cell_size;
uniform vec2 u_grid_origin;
uniform vec4 u_field_modifier_rects[GLYPH_MAX_FIELD_MODIFIER_REGIONS];
uniform float u_field_modifier_blends[GLYPH_MAX_FIELD_MODIFIER_REGIONS];

out float v_brightness;
out vec2 v_uv;

// SOLAR_NOISE_PLACEHOLDER

float hash(vec3 value) {
  value = fract(value * vec3(0.1031, 0.11369, 0.13787));
  value += dot(value, value.yxz + 19.19);
  return fract((value.x + value.y) * value.z);
}

float glyphBrightnessEntropy(float brightness) {
  return 0.04 + smoothstep(0.08, 0.92, brightness) * 0.24;
}

float glyphProceduralEntropyBrightness(float brightness) {
  return smoothstep(0.22, 0.78, brightness);
}

float glyphEntropyEvent(vec2 cell, float tick) {
  return hash(vec3(cell, tick + u_entropy_seed));
}

float glyphEntropyEpoch(vec2 cell, float brightness) {
  // Candidate events run at the brightest cell's maximum churn rate. Each
  // Cell accepts a deterministic subset based on its current brightness, so
  // Glyph entropy remains stateless and entirely GPU-driven.
  const float max_entropy_rate = 0.3304;
  const int event_search_size = 32;
  float entropy_scale =
    0.82 + hash(vec3(cell, u_entropy_seed + 17.0)) * 0.36;
  float entropy_rate = glyphBrightnessEntropy(
    glyphProceduralEntropyBrightness(brightness)
  );
  float event_probability = clamp(
    entropy_rate * entropy_scale / max_entropy_rate,
    0.0,
    1.0
  );
  float candidate_tick = floor(
    u_source_time * 0.001 * u_glyph_frame_rate * max_entropy_rate
  );
  float epoch =
    floor(candidate_tick / float(event_search_size)) *
      float(event_search_size) -
    float(event_search_size);

  for (int offset = 0; offset < event_search_size; offset += 1) {
    float tick = candidate_tick - float(offset);
    if (glyphEntropyEvent(cell, tick) < event_probability) {
      epoch = tick;
      break;
    }
  }

  return epoch;
}

float glyphFieldModifierSample(int index, vec2 modifier_uv) {
  modifier_uv = clamp(modifier_uv, vec2(0.0), vec2(0.999999));
  float sample_x =
    (modifier_uv.x * float(GLYPH_FIELD_MODIFIER_SAMPLE_SIZE - 1) + 0.5) /
    float(GLYPH_FIELD_MODIFIER_SAMPLE_SIZE);
  float sample_y =
    (float(index * GLYPH_FIELD_MODIFIER_SAMPLE_SIZE) +
      modifier_uv.y * float(GLYPH_FIELD_MODIFIER_SAMPLE_SIZE - 1) +
      0.5) /
    float(GLYPH_FIELD_MODIFIER_SAMPLE_SIZE * GLYPH_MAX_FIELD_MODIFIER_REGIONS);
  return texture(u_field_modifier_brightness, vec2(sample_x, sample_y)).r;
}

float glyphFieldModifierBrightness(vec2 world) {
  float modifier_brightness = 0.0;

  for (int index = 0; index < GLYPH_MAX_FIELD_MODIFIER_REGIONS; index += 1) {
    if (index >= u_field_modifier_count) break;

    vec4 rect = u_field_modifier_rects[index];
    float blend = u_field_modifier_blends[index];
    if (
      world.x < rect.x ||
      world.x >= rect.x + rect.z ||
      world.y < rect.y ||
      world.y >= rect.y + rect.w
    ) {
      continue;
    }

    vec2 modifier_uv = (world - rect.xy) / rect.zw;
    vec2 tap_offset = u_cell_size * 0.25 / rect.zw;
    float sampled_brightness =
      0.25 *
      (glyphFieldModifierSample(index, modifier_uv - tap_offset) +
        glyphFieldModifierSample(
          index,
          modifier_uv + vec2(tap_offset.x, -tap_offset.y)
        ) +
        glyphFieldModifierSample(
          index,
          modifier_uv + vec2(-tap_offset.x, tap_offset.y)
        ) +
        glyphFieldModifierSample(index, modifier_uv + tap_offset));
    float mapped_brightness = smoothstep(
      0.0,
      GLYPH_FIELD_MODIFIER_BRIGHTNESS_WHITE_POINT,
      sampled_brightness
    );
    float lifted_brightness =
      GLYPH_FIELD_MODIFIER_BRIGHTNESS_FLOOR +
      mapped_brightness * (1.0 - GLYPH_FIELD_MODIFIER_BRIGHTNESS_FLOOR);
    modifier_brightness = max(modifier_brightness, lifted_brightness * blend);
  }

  return modifier_brightness;
}

float glyphApplyFieldModifiers(float brightness, vec2 world) {
  float modifier_brightness = glyphFieldModifierBrightness(world);

  return brightness +
  min(1.0, modifier_brightness * GLYPH_FIELD_MODIFIER_BRIGHTNESS_BOOST) *
    (1.0 - brightness);
}

void main() {
  vec2 world = u_grid_origin + a_position + vec2(0.5) * u_cell_size;
  vec2 world_cell = floor(world / u_cell_size);
  vec2 field_point = world / u_cell_size;

  float color_brightness = glyphApplyFieldModifiers(
    glyphNoiseVisualBrightness(
      glyphSolarBrightness(field_point, u_source_time, u_noise_seed)
    ),
    world
  );

  float epoch = glyphEntropyEpoch(world_cell, color_brightness);
  float glyph_index = floor(
    hash(vec3(world_cell, epoch + u_entropy_seed)) * u_glyph_count
  );

  vec2 glyph_cell = vec2(
    mod(glyph_index, u_atlas_grid.x),
    floor(glyph_index / u_atlas_grid.x)
  );
  vec2 pixel = a_position + a_corner * u_cell_size;
  vec2 clip = pixel / u_canvas_size * 2.0 - 1.0;

  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_brightness = color_brightness;
  v_uv = (glyph_cell + a_corner) / u_atlas_grid;
}

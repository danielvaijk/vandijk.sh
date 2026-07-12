#version 300 es
in vec2 a_corner;
in vec2 a_position;
in vec2 a_brightness_uv;
in float a_entropy_position;
in float a_entropy_rate;
in float a_entropy_scale;

uniform float u_entropy_seed;
uniform float u_glyph_count;
uniform float u_source_time;
uniform float u_glyph_frame_rate;
uniform float u_shader_entropy;
uniform sampler2D u_brightness;
uniform vec2 u_atlas_grid;
uniform vec2 u_brightness_size;
uniform vec2 u_canvas_size;
uniform vec2 u_cell_size;

out vec2 v_uv;
out vec2 v_brightness_uv;

float hash(vec3 value) {
  value = fract(value * vec3(0.1031, 0.11369, 0.13787));
  value += dot(value, value.yxz + 19.19);
  return fract((value.x + value.y) * value.z);
}

float glyphBrightnessEntropy(float brightness) {
  return 0.04 + smoothstep(0.08, 0.92, brightness) * 0.24;
}
void main() {
  vec2 cell = floor(a_brightness_uv * u_brightness_size);
  float brightness = texture(u_brightness, a_brightness_uv).r;

  float shader_entropy_position =
    u_source_time *
    0.001 *
    u_glyph_frame_rate *
    a_entropy_rate *
    a_entropy_scale;
  float entropy_position = mix(
    a_entropy_position,
    shader_entropy_position,
    u_shader_entropy
  );

  float phase = hash(vec3(cell, u_entropy_seed));
  float epoch = floor(entropy_position + phase);
  float glyph_index = floor(
    hash(vec3(cell, epoch + u_entropy_seed)) * u_glyph_count
  );

  vec2 glyph_cell = vec2(
    mod(glyph_index, u_atlas_grid.x),
    floor(glyph_index / u_atlas_grid.x)
  );
  vec2 pixel = a_position + a_corner * u_cell_size;
  vec2 clip = pixel / u_canvas_size * 2.0 - 1.0;

  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = (glyph_cell + a_corner) / u_atlas_grid;
  v_brightness_uv = a_brightness_uv;
}

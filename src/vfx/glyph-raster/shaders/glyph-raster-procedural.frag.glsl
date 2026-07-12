#version 300 es
precision highp float;

uniform sampler2D u_atlas;
uniform sampler2D u_palette;
uniform int u_color_count;

in float v_brightness;
in vec2 v_uv;

out vec4 out_color;

vec4 glyphPaletteColor(float brightness) {
  float palette_position =
    clamp(brightness, 0.0, 1.0) * float(u_color_count - 1);
  int lower_index = int(floor(palette_position));
  int upper_index = min(u_color_count - 1, lower_index + 1);
  vec4 lower_color = texelFetch(u_palette, ivec2(lower_index, 0), 0);
  vec4 upper_color = texelFetch(u_palette, ivec2(upper_index, 0), 0);

  return mix(lower_color, upper_color, fract(palette_position));
}
void main() {
  float alpha = texture(u_atlas, v_uv).a;
  vec4 color = glyphPaletteColor(v_brightness);
  out_color = vec4(color.rgb, color.a * alpha);
}

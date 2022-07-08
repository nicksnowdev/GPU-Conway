#ifdef GL_ES
precision mediump float; // precision for all floats in this shader
#endif

varying vec2 vTexCoord;

uniform sampler2D u_texture; // own texture must be manually passed in as a uniform
uniform sampler2D u_targetTexture;
uniform float u_time;
uniform vec3 u_blend;

float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = vTexCoord;
    // the texture is loaded upside down by default and must be flipped
    uv.y = 1.0 - uv.y;

    vec4 frag = texture2D(u_texture, uv);
    frag.rgb *= floor(rand(uv * u_time) * 2.0) * u_blend;

    vec4 targetFrag = texture2D(u_targetTexture, uv);

    gl_FragColor = (1.0 - frag.a) * targetFrag + frag;
}
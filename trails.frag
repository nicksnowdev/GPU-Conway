#ifdef GL_ES
precision mediump float; // precision for all floats in this shader
#endif

varying vec2 vTexCoord;

uniform sampler2D u_texture; // own texture must be manually passed in as a uniform
uniform vec2 u_texel;
uniform float u_gMax;
uniform float u_bMax;
uniform float u_gGrow;
uniform float u_bGrow;
uniform float u_gDecay;
uniform float u_bDecay;

void main() {
    vec2 uv = vTexCoord;
    // the texture is loaded upside down by default and must be flipped
    uv.y = 1.0 - uv.y;

    float sum = 0.0;
    float noFive;

    for(float k = -1.0; k <= 1.0; k++) {
        for(float j = -1.0; j <= 1.0; j++) {
            noFive = min(1.0, abs(j) + abs(k));
            sum += texture2D(u_texture, vec2(mod(uv.x + j * u_texel.x, 1.0), mod(uv.y + k * u_texel.y, 1.0))).r * noFive;
        }
    }

    vec4 newState = texture2D(u_texture, uv);
    if(sum < 2.0 || sum > 3.0) {
        newState = vec4(0.0, max(newState.g - u_gDecay, 0.0), max(newState.b - u_bDecay, 0.0), 1.0);
    }
    else if(sum == 3.0) {
        newState = vec4(1.0, min(newState.g + u_gGrow, u_gMax), min(newState.b + u_bGrow, u_bMax), 1.0);
    }
    else {
        //newState.g = min(newState.g + u_gGrow, u_gMax);
        newState.b = min(newState.b + u_bGrow, u_bMax);
    }

    gl_FragColor = newState;
}
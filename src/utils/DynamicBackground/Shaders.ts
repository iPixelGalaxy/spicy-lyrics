import * as THREE from "@3d/three";

// Shaders
const Uniforms = `
uniform float Time;
uniform float RotationSpeed;
uniform float RotationAngle;
uniform sampler2D BlurredCoverArt;
uniform sampler2D NewBlurredCoverArt;
uniform float TransitionProgress;

uniform vec2 BackgroundCircleOrigin;
uniform float BackgroundCircleRadius;

uniform vec2 CenterCircleOrigin;
uniform float CenterCircleRadius;

uniform vec2 LeftCircleOrigin;
uniform float LeftCircleRadius;

uniform vec2 RightCircleOrigin;
uniform float RightCircleRadius;
`;

export type ShaderUniforms = {
  Time: { value: number };
  RotationSpeed: { value: number };
  RotationAngle: { value: number };
  BlurredCoverArt: { value: THREE.Texture };
  NewBlurredCoverArt: { value: THREE.Texture | null };
  TransitionProgress: { value: number };
  BackgroundCircleOrigin: { value: THREE.Vector2 };
  BackgroundCircleRadius: { value: number };
  CenterCircleOrigin: { value: THREE.Vector2 };
  CenterCircleRadius: { value: number };
  LeftCircleOrigin: { value: THREE.Vector2 };
  LeftCircleRadius: { value: number };
  RightCircleOrigin: { value: THREE.Vector2 };
  RightCircleRadius: { value: number };
};

export const VertexShader = `
void main() {
	gl_Position = vec4(position, 1.0);
}
`;

export const FragmentShader = `
${Uniforms}

const vec2 rotateCenter = vec2(0.5, 0.5);
vec2 RotateAroundCenter(vec2 point, float angle) {
	vec2 offset = (point - rotateCenter);

	float s = sin(angle);
	float c = cos(angle);
	mat2 rotation = mat2(c, -s, s, c);
	offset = (rotation * offset);

	return (rotateCenter + offset);
}

const vec4 DefaultColor = vec4(0.0, 0.0, 0.0, 0.0);
void main() {
	float transition = TransitionProgress;

	gl_FragColor = DefaultColor;

	vec2 BackgroundCircleOffset = (gl_FragCoord.xy - BackgroundCircleOrigin);
	if (length(BackgroundCircleOffset) <= BackgroundCircleRadius) {
		vec2 texCoord = RotateAroundCenter(
			(((BackgroundCircleOffset / BackgroundCircleRadius) + 1.0) * 0.5),
			(RotationAngle * -0.25)
		);

		vec4 currentTexColor = texture2D(BlurredCoverArt, texCoord);

		vec4 newTexColor = texture2D(NewBlurredCoverArt, texCoord);
		if (transition > 0.0 && length(newTexColor.rgb) > 0.0) {
			gl_FragColor = mix(currentTexColor, newTexColor, transition);
		} else {
			gl_FragColor = currentTexColor;
		}

		gl_FragColor.a = 1.0;
	}

	vec2 CenterCircleOffset = (gl_FragCoord.xy - CenterCircleOrigin);
	if (length(CenterCircleOffset) <= CenterCircleRadius) {
		vec2 texCoord = RotateAroundCenter(
			(((CenterCircleOffset / CenterCircleRadius) + 1.0) * 0.5),
			(RotationAngle * 0.5)
		);

		vec4 currentTexColor = texture2D(BlurredCoverArt, texCoord);
		vec4 newColor;

		vec4 newTexColor = texture2D(NewBlurredCoverArt, texCoord);
		if (transition > 0.0 && length(newTexColor.rgb) > 0.0) {
			newColor = mix(currentTexColor, newTexColor, transition);
		} else {
			newColor = currentTexColor;
		}

		newColor.a *= 0.75;
		gl_FragColor.rgb = ((newColor.rgb * newColor.a) + (gl_FragColor.rgb * (1.0 - newColor.a)));
		gl_FragColor.a = (newColor.a + (gl_FragColor.a * (1.0 - newColor.a)));
	}

	vec2 LeftCircleOffset = (gl_FragCoord.xy - LeftCircleOrigin);
	if (length(LeftCircleOffset) <= LeftCircleRadius) {
		vec2 texCoord = RotateAroundCenter(
			(((LeftCircleOffset / LeftCircleRadius) + 1.0) * 0.5),
			(RotationAngle * 1.0)
		);

		vec4 currentTexColor = texture2D(BlurredCoverArt, texCoord);
		vec4 newColor;

		vec4 newTexColor = texture2D(NewBlurredCoverArt, texCoord);
		if (transition > 0.0 && length(newTexColor.rgb) > 0.0) {
			newColor = mix(currentTexColor, newTexColor, transition);
		} else {
			newColor = currentTexColor;
		}

		newColor.a *= 0.5;
		gl_FragColor.rgb = ((newColor.rgb * newColor.a) + (gl_FragColor.rgb * (1.0 - newColor.a)));
		gl_FragColor.a = (newColor.a + (gl_FragColor.a * (1.0 - newColor.a)));
	}

	vec2 RightCircleOffset = (gl_FragCoord.xy - RightCircleOrigin);
	if (length(RightCircleOffset) <= RightCircleRadius) {
		vec2 texCoord = RotateAroundCenter(
			(((RightCircleOffset / RightCircleRadius) + 1.0) * 0.5),
			(RotationAngle * -0.75)
		);

		vec4 currentTexColor = texture2D(BlurredCoverArt, texCoord);
		vec4 newColor;

		vec4 newTexColor = texture2D(NewBlurredCoverArt, texCoord);
		if (transition > 0.0 && length(newTexColor.rgb) > 0.0) {
			newColor = mix(currentTexColor, newTexColor, transition);
		} else {
			newColor = currentTexColor;
		}

		newColor.a *= 0.5;
		gl_FragColor.rgb = ((newColor.rgb * newColor.a) + (gl_FragColor.rgb * (1.0 - newColor.a)));
		gl_FragColor.a = (newColor.a + (gl_FragColor.a * (1.0 - newColor.a)));
	}
}
`;

const ShaderUniformStructure: Map<string, string> = new Map();
for (const match of Uniforms.matchAll(/uniform\s+(\w+)\s+(\w+);/g)) {
  ShaderUniformStructure.set(match[2], match[1]);
}

export const DisposeShaderUniforms = (uniforms: ShaderUniforms): void => {
  if (!uniforms) return;
  if (uniforms.BlurredCoverArt?.value) {
    (uniforms.BlurredCoverArt.value as THREE.Texture).dispose();
    uniforms.BlurredCoverArt.value = undefined as unknown as THREE.Texture;
  }
  if (uniforms.NewBlurredCoverArt?.value) {
    (uniforms.NewBlurredCoverArt.value as THREE.Texture).dispose();
    uniforms.NewBlurredCoverArt.value = null;
  }
  if (uniforms.TransitionProgress) uniforms.TransitionProgress.value = 0;
  if (uniforms.BackgroundCircleOrigin?.value) uniforms.BackgroundCircleOrigin.value.set(0, 0);
  if (uniforms.CenterCircleOrigin?.value) uniforms.CenterCircleOrigin.value.set(0, 0);
  if (uniforms.LeftCircleOrigin?.value) uniforms.LeftCircleOrigin.value.set(0, 0);
  if (uniforms.RightCircleOrigin?.value) uniforms.RightCircleOrigin.value.set(0, 0);
};

export const GetShaderUniforms = (): ShaderUniforms => {
  const uniforms: Record<string, unknown> = {};
  for (const [uniformName, uniformType] of ShaderUniformStructure.entries()) {
    if (uniformType === "float") {
      if (uniformName === "RotationSpeed") {
        uniforms[uniformName] = { value: 1.0 };
      } else if (uniformName === "TransitionProgress") {
        uniforms[uniformName] = { value: 0.0 };
      } else {
        uniforms[uniformName] = { value: 0 };
      }
    } else if (uniformType === "vec2") {
      uniforms[uniformName] = { value: new THREE.Vector2() };
    } else if (uniformType === "sampler2D") {
      if (uniformName === "NewBlurredCoverArt") {
        const tempCanvas = new OffscreenCanvas(1, 1);
        const tempTexture = new THREE.CanvasTexture(tempCanvas);
        uniforms[uniformName] = { value: tempTexture };
      } else {
        uniforms[uniformName] = { value: null };
      }
    }
  }
  return uniforms as ShaderUniforms;
};

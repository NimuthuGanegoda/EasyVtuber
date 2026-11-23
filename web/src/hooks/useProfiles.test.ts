import { describe, expect, it } from 'vitest';
import { parseProfileJson, sanitizeProfileData } from './useProfiles';

describe('useProfiles sanitization', () => {
  it('clamps numeric values and rejects unsafe overlay or background image URLs', () => {
    const data = sanitizeProfileData({
      expression: { mouthOpen: 5, eyebrowRaise: -1, eyeSmile: 0.5, cheekPuff: 0.2, angry: 2 },
      background: 'image',
      backgroundValue: 'javascript:alert(1)',
      overlays: [
        {
          id: '1',
          type: 'text',
          content: 'Live!',
          x: 2,
          y: -1,
          scale: 9,
          rotation: 999,
          opacity: 2,
        },
        {
          id: '2',
          type: 'image',
          content: 'https://evil.example/a.png',
          x: 0.5,
          y: 0.5,
          scale: 1,
          rotation: 0,
          opacity: 1,
        },
        {
          id: '3',
          type: 'image',
          content: 'data:image/png;base64,AAAA',
          x: 0.5,
          y: 0.5,
          scale: 1,
          rotation: 0,
          opacity: 1,
        },
      ],
      camera: { zoom: 99, offsetX: -5, offsetY: 5, orbitYaw: 180 },
      lighting: { preset: 'neon', keyIntensity: 10, rimColor: 'not-hex' },
      tuning: { headSensitivity: 9, smoothing: 5, autoBlink: false, idleBreathing: true },
      mirrored: true,
    });

    expect(data).not.toBeNull();
    expect(data!.expression.mouthOpen).toBe(1);
    expect(data!.expression.eyebrowRaise).toBe(0);
    expect(data!.expression.angry).toBe(1);
    expect(data!.backgroundValue).toBe('transparent');
    expect(data!.overlays).toHaveLength(2);
    expect(data!.overlays[0]!.x).toBe(0.95);
    expect(data!.overlays[0]!.y).toBe(0.05);
    expect(data!.overlays[0]!.rotation).toBe(180);
    expect(data!.camera.zoom).toBe(2.5);
    expect(data!.camera.orbitYaw).toBe(45);
    expect(data!.lighting.rimColor).toBe('#a855f7');
    expect(data!.tuning.autoBlink).toBe(false);
    expect(data!.mirrored).toBe(true);
  });

  it('parses exported profile JSON and throws on malformed input', () => {
    const parsed = parseProfileJson(
      JSON.stringify({
        name: 'Stream Night',
        data: {
          background: 'gradient',
          backgroundValue: '#00b140',
          mirrored: true,
        },
      }),
    );
    expect(parsed.name).toBe('Stream Night');
    expect(parsed.data.backgroundValue).toBe('#00b140');
    expect(parsed.data.mirrored).toBe(true);

    expect(() => parseProfileJson('null')).toThrow();
    expect(() => parseProfileJson('{bad')).toThrow();
  });
});

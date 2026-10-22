import { afterEach, describe, expect, it } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import lock from '../../assets/source-lock.json';
import crops from '../../assets/crops.json';
import { prepareAssets } from '../../tools/assets/prepare';
import { WowButton } from '../../src/ui/wow/Button';
import { IconSlot } from '../../src/ui/wow/IconSlot';
import { UnitFrame } from '../../src/ui/wow/UnitFrame';
import { ProgressBar } from '../../src/ui/wow/ProgressBar';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
const mount = (node: React.ReactNode) => {
  const host = document.createElement('div'); document.body.appendChild(host);
  root = createRoot(host); act(() => root!.render(node)); return host;
};
afterEach(() => { if (root) act(() => root!.unmount()); root = undefined; document.body.innerHTML = ''; });

describe('verified native atlas', () => {
  it('atlasCropUsesDeclaredRectangle', () => {
    const out = mkdtempSync(join(tmpdir(), 'wow-assets-'));
    try {
      const result = prepareAssets({ sourceRoot: 'public/assets/native', outputRoot: out, sourceLock: lock, crops });
      const corner = result.crops['dialog-top-left'];
      expect(corner.rectangle).toEqual([128, 0, 32, 32]);
      expect(corner.sourceDimensions).toEqual([256, 32]);
      expect(readFileSync(join(out, 'crops/dialog-top-left.svg'), 'utf8')).toContain('viewBox="128 0 32 32"');
      expect(() => prepareAssets({ sourceRoot: 'public/assets/native', outputRoot: out, sourceLock: lock, crops: [{ ...crops[0], rectangle: [250, 0, 32, 32] }] })).toThrow(/outside/);
      expect(() => prepareAssets({ sourceRoot: 'public/assets/native', outputRoot: out, sourceLock: { ...lock, files: lock.files.map((f, i) => i === 0 ? { ...f, width: f.width + 1 } : f) }, crops })).toThrow(/dimensions/);
    } finally { rmSync(out, { recursive: true, force: true }); }
  });
});

describe('presentation states', () => {
  it.each(['normal', 'pressed', 'highlighted', 'disabled', 'selected'] as const)('renders %s button state with long German labels', state => {
    let clicks = 0;
    const label = 'Außergewöhnlich lange Charakterzusammenstellung';
    const host = mount(createElement(WowButton, { state, onClick: () => clicks++, children: label }));
    const button = host.querySelector('button')!;
    expect(button.textContent).toBe(label);
    expect(button.dataset.state).toBe(state);
    expect(button.disabled).toBe(state === 'disabled');
    act(() => button.click()); expect(clicks).toBe(state === 'disabled' ? 0 : 1);
    if (state === 'selected' || state === 'pressed') expect(button.getAttribute('aria-pressed')).toBe('true');
  });
  it.each(['normal', 'pressed', 'highlighted', 'disabled', 'selected'] as const)('exposes %s icon presentation without game rules', state => {
    const host = mount(createElement(IconSlot, { label: 'Schlachtruf', pressed: state === 'pressed', highlighted: state === 'highlighted', disabled: state === 'disabled', selected: state === 'selected' }));
    const button = host.querySelector('button')!;
    expect(button.disabled).toBe(state === 'disabled');
    expect(button.hasAttribute('data-pressed')).toBe(state === 'pressed');
    expect(button.hasAttribute('data-highlighted')).toBe(state === 'highlighted');
    expect(button.hasAttribute('data-selected')).toBe(state === 'selected');
  });
  it('renders fallback icon on missing input and image error; keeps cooldown descriptive', () => {
    const host = mount(createElement(IconSlot, { label: 'Großer Heiltrank', icon: '/missing.png', cooldown: 0.6, cooldownLabel: '6 Sekunden', selected: true }));
    act(() => host.querySelector('img')!.dispatchEvent(new Event('error')));
    expect(host.querySelector('[data-fallback]')).not.toBeNull();
    expect(host.querySelector('button')!.getAttribute('aria-label')).toContain('6 Sekunden');
    expect(host.querySelector('[data-cooldown]')).not.toBeNull();
    expect(host.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
  });
  it('exposes an absent icon and never treats cooldown as a game rule', () => {
    let count = 0;
    const host = mount(createElement(IconSlot, { label: 'Unbekanntes Symbol', cooldown: 1, onClick: () => count++ }));
    expect(host.querySelector('[data-fallback]')).not.toBeNull();
    act(() => host.querySelector('button')!.click()); expect(count).toBe(1);
  });
  it('preserves long unit names and accessible clamped meter values', () => {
    const name = 'Erzmagierin von der Immerwährenden Morgenröte';
    const host = mount(createElement(UnitFrame, { name, level: '12', health: { value: 80, max: 100, label: 'Gesundheit' }, resource: { value: 40, max: 100, label: 'Mana' }, variant: 'target' }));
    expect(host.textContent).toContain(name);
    expect(host.querySelector('[data-variant="target"]')).not.toBeNull();
    expect(host.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('80');
  });
  it('handles invalid and zero meter ranges without NaN', () => {
    const host = mount(createElement(ProgressBar, { label: 'Erfahrung', value: Infinity, max: 0 }));
    expect(host.innerHTML).not.toContain('NaN');
    expect(host.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('0');
  });
});

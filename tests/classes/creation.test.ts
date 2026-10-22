import { describe, it, expect } from 'vitest';
import { createCharacter, createClassCatalog } from '../../src/game/classes/creation';
import { buildClassDefaults } from '../../tools/content/classes';
import { makeCatalog } from '../fixtures/factories';
const catalog = () => createClassCatalog(makeCatalog());
describe('source-backed creation', () => {
  it('rebuilds the checked-in package from hash-verified source bytes', () => {
    expect(buildClassDefaults()).toEqual(catalog().classes);
  });
  it('creates all 56 combinations without claiming nine implemented class packages', () => {
    const c = catalog(); expect(c.classes.combinations).toHaveLength(56);
    expect(c.classes.racials).toHaveLength(52);
    expect(c.classes.talents.filter(t=>t.classKey==='forever:class:1')).toHaveLength(52);
    expect(c.classes.talents.filter(t=>t.classKey==='forever:class:1' && t.handler)).toHaveLength(6);
    expect(c.classes.talents.filter(t=>!t.handler).every(t=>t.gap.length>0)).toBe(true);
    for (const combination of c.classes.combinations) {
      const result = createCharacter({ id: String(combination.key), name: 'Heldin', ...combination, combinationKey: combination.key }, c);
      expect(result.ok).toBe(true);
    }
    expect(c.classes.definitions.filter(d => d.mechanics === 'playable').map(d => d.slug)).toEqual(['warrior','paladin','hunter','rogue','priest','shaman']);
  });
  it('rejects forbidden combinations and spoofed faction directly', () => {
    const c = catalog(), combo = c.classes.combinations[0];
    expect(createCharacter({ id: 'bad', name: 'Heldin', ...combo, combinationKey: combo.key, classKey: 'forever:class:11' }, c).ok).toBe(false);
    expect(createCharacter({ id: 'bad', name: 'Heldin', ...combo, combinationKey: combo.key, factionKey: 'forever:faction:2' }, c).ok).toBe(false);
  });
});

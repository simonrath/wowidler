'use client';
import { useState } from 'react';
import { WowFrame } from './Frame';
import { WowButton, type WowButtonState } from './Button';
import { IconSlot } from './IconSlot';
import { UnitFrame } from './UnitFrame';
import { WowTooltip } from './Tooltip';
import { ActionBar } from './ActionBar';
import { Minimap } from './Minimap';
import { ProgressBar } from './ProgressBar';
const icon = (name: string) => `/assets/native/Interface/Icons/${name}.png`;
const abilities = [
  ['Schlachtruf','Ability_Warrior_BattleShout'],['Sturmangriff','Ability_Warrior_Charge'],['Heldenhafter Stoß','Ability_Warrior_OffensiveStance'],['Verwunden','Ability_Gouge'],['Donnerknall','Spell_Nature_ThunderClap'],['Wirbelwind','Ability_Whirlwind'],
  ['Heiltrank','INV_Potion_51'],['Leinenstoff','INV_Fabric_Linen_01'],['Kupfererz','INV_Ore_Copper_01'],['Brot','INV_Misc_Food_10'],['Rucksack','INV_Misc_Bag_08'],['Unbekanntes Symbol',''],
];
const states: { state: WowButtonState; label: string }[] = [{ state:'normal',label:'Normal' },{ state:'pressed',label:'Gedrückt' },{ state:'highlighted',label:'Hervorgehoben' },{ state:'disabled',label:'Deaktiviert' },{ state:'selected',label:'Gewählt' }];
const refs = [
  ['Dialog · acht Segmente','DialogFrame/UI-DialogBox-Border.png'],['Knopf · Grundzustand','Buttons/UI-Panel-Button-Up.png'],['Aktionsleiste · Endstück','MainMenuBar/UI-MainMenuBar-EndCap-Human.png'],['Minimap · Originalatlas','Minimap/UI-Minimap-Border.png'],['Spielerrahmen · zwei Größen','CharacterFrame/UI-Player-Portrait.png'],['Zielrahmen · Porträt rechts','TargetingFrame/UI-TargetingFrame.png'],['Tasche · eingebautes 4 × 4 Raster','ContainerFrame/UI-BackpackBackground.png'],['Charakterbogen · oben links','PaperDoll/UI-PaperDollBackground-L1.png'],['Questpergament · oben links','QuestFrame/UI-QuestGreeting-TopLeft.png'],['Feuertalente · oben links','TalentFrame/MageFire-TopLeft.png'],['Tooltip · acht Segmente','Tooltips/UI-Tooltip-Border.png'],
];
export function ComponentWorkbench() {
  const [notice, setNotice] = useState('Bereit. Bediene die Bauteile mit Maus oder Tastatur. Alle Werte sind reine Darstellungsbeispiele.');
  const [previewWidth, setPreviewWidth] = useState('full');
  const [chosen, setChosen] = useState('Schlachtruf');
  const [dialogOpen, setDialogOpen] = useState(true);
  const respond = (name: string) => setNotice(`Darstellungsereignis: ${name}. Es wurde keine Spielaktion ausgeführt.`);
  return <><div className="wow-workbench-width-controls" role="group" aria-label="Interne Prüfbreite"><span>Prüfbreite:</span>{[['full','Volle Breite'],['375','375 px'],['320','320 px']].map(([value,label])=><WowButton key={value} aria-pressed={previewWidth===value} state={previewWidth===value?'selected':'normal'} onClick={()=>setPreviewWidth(value)}>{label}</WowButton>)}<span className="wow-muted">Containerprüfung</span></div><div className="wow-workbench-viewport" style={{ width: previewWidth==='full'?'100%':`${previewWidth}px` }}><main className="wow-workbench">
    <header className="wow-masthead"><div>
      <div className="wow-eyebrow">Interne Komponentenwerkbank · Originale 1.12-Oberfläche</div>
      <h1>WoW Forever Idle</h1>
      <p className="wow-subtitle">Die Bauteile Azeroths. Native Rahmen, Pergament und Symbole — zusammengesetzt für die deutsche Oberfläche.</p>
      <p className="wow-muted">UI-Vorschau · noch kein spielbares Spiel</p>
      <nav className="wow-workbench-nav" aria-label="Werkbankbereiche"><a href="#hud">Spieloberfläche</a><a href="#panels">Fenster & Inventar</a><a href="#states">Zustände & Bedienung</a><a href="#references">Originalreferenzen</a></nav>
    </div><Minimap label="Wald von Elwynn" image="/assets/native/Interface/WorldMap/Elwynn/Elwynn5.png" markers={[{ id:'sample', label:'Beispielmarkierung: Nordhain', x:53, y:48, onClick:()=>respond('Minimap-Markierung') }]} /></header>
    <div className="wow-workbench-main">
      <section id="hud" className="wow-stage" aria-labelledby="hud-title"><div className="wow-stage-heading"><h2 id="hud-title">01 · Am Rand der Welt</h2><span>Unitframes, Aktionsleiste & Fortschritt · native Größe</span></div>
        <div className="wow-hud-row">
          <UnitFrame name="Arthoran" level="12" health={{ label:'Gesundheit',value:78,max:100 }} resource={{ label:'Wut',value:36,max:100,tone:'rage' }} onClick={()=>respond('Spieler auswählen')} />
          <UnitFrame variant="target" name="Erzmagierin von der Immerwährenden Morgenröte" level="14" health={{ label:'Gesundheit des Ziels',value:92,max:100 }} resource={{ label:'Mana des Ziels',value:62,max:100 }} onClick={()=>respond('Ziel auswählen')} />
          <div className="wow-hud-note">Lange Namen bleiben per Fokus und Titel zugänglich. Spielerporträt links, Zielporträt rechts. Alle Leistenwerte sind Musterwerte.</div>
        </div>
        <ActionBar items={abilities.map(([label,name],i)=>({ id:label,label,icon:name ? icon(name):undefined,hotkey:i<9 ? String(i+1):['0','−','='][i-9],selected:chosen===label,cooldown:i===2?.65:0,cooldownLabel:i===2?'6 Sekunden':undefined,count:i===6?3:undefined,onClick:()=>{setChosen(label);respond(label);} }))} />
        <div style={{ maxWidth:652, marginTop:8 }}><ProgressBar label="Erfahrung – Musterwert" value={640} max={1000} text="Erfahrung · 640 / 1.000" tone="experience" /></div>
      </section>
      <section id="panels" className="wow-stage" aria-labelledby="panel-title"><div className="wow-stage-heading"><h2 id="panel-title">02 · Ausrüstung & Geschichten</h2><span>Native Texturteile · ohne gestreckte Atlasstreifen</span></div>
        <div className="wow-native-gallery">
          <article className="wow-specimen"><h3>Charakterbogen</h3><div className="wow-paperdoll" aria-label="Charakterbogen als Darstellungsbeispiel"><div className="wow-paperdoll-name">Arthoran · Krieger</div><img src="/assets/authored/armour-study.svg" className="wow-paperdoll-figure" alt="Handgezeichnete Rüstungsstudie als Figurenplatzhalter" />
            <div className="wow-equipment wow-equipment--left">{['INV_Chest_Chain','INV_Sword_04','INV_Misc_LeatherScrap_03','INV_Misc_Bag_08'].map((name,i)=><IconSlot key={name} label={['Kettenrüstung','Schwert','Leder','Tasche'][i]} icon={icon(name)} onClick={()=>respond('Ausrüstungsplatz')} />)}</div>
            <div className="wow-equipment wow-equipment--right">{['Schultern','Handgelenke','Handschuhe','Stiefel'].map(label=><IconSlot key={label} label={`${label} – fehlendes Symbol`} disabled />)}</div>
            <dl className="wow-paperdoll-stats"><dt>Stärke (Muster)</dt><dd>32</dd><dt>Beweglichkeit (Muster)</dt><dd>21</dd><dt>Ausdauer (Muster)</dt><dd>28</dd></dl>
          </div><p className="wow-caption">Originale PaperDoll-Teile, unveränderte Pixelgröße. Die Rüstungsfigur ist separat von Hand gezeichnet.</p></article>
          <article className="wow-specimen"><h3>Questpergament</h3><div className="wow-quest"><img className="wow-quest-seal" src={icon('INV_Misc_Coin_01')} alt="" /><div className="wow-quest-name">Eine Nachricht aus Nordhain</div><div className="wow-quest-body"><h4>Ein neuer Anfang</h4><p>Jede Reise beginnt mit einem ersten Schritt. Hier werden später die Geschichten, Aufgaben und Belohnungen deiner Reise stehen.</p><p>Dieses Pergament zeigt einen frei verfassten Beispieltext zur Prüfung der Lesbarkeit.</p><h5>Darstellungsziel</h5><p>Lange deutsche Beschreibungen, klare Überschriften und klassische Bedienelemente.</p><WowButton onClick={()=>respond('Questfenster bestätigen')}>Weiterlesen</WowButton></div></div><p className="wow-caption">Vier originale QuestGreeting-Teile. Mustertext, keine importierte oder spielbare Quest.</p></article>
          <div className="wow-right-column">
            <article className="wow-specimen"><h3>Rucksack</h3><div className="wow-bag"><div className="wow-bag-name">Rucksack</div><div className="wow-bag-slots">{Array.from({length:16},(_,i)=>i<4 ? <IconSlot key={i} label={['Heiltrank','Kupfererz','Leinenstoff','Schwert'][i]} icon={icon(['INV_Potion_51','INV_Ore_Copper_01','INV_Fabric_Linen_01','INV_Sword_04'][i])} count={i<3?[3,12,8][i]:undefined} onClick={()=>respond(`Rucksackplatz ${i+1}`)} />:<span key={i} className="wow-bag-empty" aria-hidden="true" />)}</div><span className="wow-bag-money">12 Gold · 34 Silber · Muster</span></div><p className="wow-caption" style={{maxWidth:191}}>Native 4 × 4 Fächer. Symbole liegen in den vorhandenen Aussparungen.</p></article>
            <article className="wow-specimen"><h3>Talente · Magier / Feuer</h3><div className="wow-talent"><div className="wow-talent-title">Feuer · Darstellungsbeispiel</div><i className="wow-talent-connector" aria-hidden="true" /><div className="wow-talent-slots">{['Spell_Fire_FlameBolt','Spell_Fire_FireBolt','Spell_Fire_Immolation','Spell_Holy_MagicalSentry','Spell_Frost_FrostArmor02','Spell_Frost_FrostBolt02'].map((name,i)=><span className="wow-talent-rank" key={name}><IconSlot label={`Talentplatz ${i+1} – Symbolbeispiel, keine Talentregel`} icon={icon(name)} selected={i===0} disabled={i>2} onClick={()=>respond(`Talentplatz ${i+1}`)} /><small>{i===0?'5/5':'0/5'}</small></span>)}</div></div><p className="wow-caption" style={{maxWidth:280}}>Originaler MageFire-Hintergrund. Knoten, Ränge und Verbindung sind ausschließlich Layoutproben.</p></article>
          </div>
        </div>
      </section>
      <section id="states" className="wow-stage" aria-labelledby="state-title"><div className="wow-stage-heading"><h2 id="state-title">03 · Jeder Zustand zählt</h2><span>Tastatur · lange deutsche Texte · fehlende Symbole</span></div>
        <WowFrame title="Knöpfe & Symbolplätze"><div className="wow-state-grid">{states.map(({state,label})=><div key={state}><span className="wow-state-label">{label}</span><WowButton state={state} onClick={()=>respond(label)} aria-label="Charakterzusammenstellung" title="Charakterzusammenstellung">Charakter­zusammen­stellung</WowButton><IconSlot label={`${label}: Schlachtruf`} icon={icon('Ability_Warrior_BattleShout')} disabled={state==='disabled'} selected={state==='selected'} pressed={state==='pressed'} highlighted={state==='highlighted'} onClick={()=>respond(`${label}: Symbol`)} /></div>)}<div><span className="wow-state-label">Cooldown & fehlendes Icon</span><WowButton onClick={()=>respond('Sehr langer Text')} aria-label="Außergewöhnlich lange Charakterzusammenstellung" title="Außergewöhnlich lange Charakterzusammenstellung">Außergewöhnlich lange Charakter­zusammen­stellung</WowButton><IconSlot label="Unbekanntes Symbol" cooldown={.65} cooldownLabel="6 Sekunden" onClick={()=>respond('Cooldown ist nur Darstellung')} /></div></div></WowFrame>
        <div className="wow-dialog-grid"><div>{dialogOpen ? <WowFrame title="Reise unterbrechen?"><p>Dies ist ein Dialogbeispiel. Ecken bleiben in Originalgröße; Kanten und Hintergrund werden wiederholt.</p><p className="wow-muted">Auch diese längere deutsche Bestätigungsnachricht passt in den Rahmen.</p><div className="wow-dialog-actions"><WowButton onClick={()=>{setDialogOpen(false);respond('Dialog bestätigt');}}>Bestätigen</WowButton><WowButton onClick={()=>{setDialogOpen(false);respond('Dialog abgebrochen');}}>Abbrechen</WowButton></div></WowFrame>:<WowFrame title="Dialog geschlossen"><WowButton onClick={()=>setDialogOpen(true)}>Dialog erneut öffnen</WowButton></WowFrame>}</div>
          <div><WowFrame variant="tooltip"><strong className="wow-item-name">Schwert der langen deutschen Bezeichnung</strong><p>Wird beim Anlegen gebunden<br/>Haupthand · Schwert<br/><span className="wow-gold">Ein klassischer Tooltip als Texturprobe</span></p><span className="wow-muted">Keine Gegenstandswerte oder Spielregeln enthalten.</span></WowFrame><p className="wow-caption">Tooltiprahmen aus acht nativen 16-Pixel-Segmenten. Den folgenden Knopf fokussieren oder berühren; Escape schließt den Hinweis.</p><WowTooltip content={<><strong className="wow-item-name">Tastatur-Hinweis</strong><p>Der Tooltip folgt Fokus und Maus. Escape blendet ihn aus.</p></>}><WowButton onClick={()=>respond('Tooltip-Auslöser')}>Tooltip prüfen</WowButton></WowTooltip></div>
        </div>
        <output className="wow-readout" aria-live="polite">{notice}</output>
      </section>
      <footer id="references" className="wow-source-notes"><details><summary>Originalreferenzen, Herkunft & Nutzungsstand</summary><p>170 verifizierte PNGs aus doorknob6/vanilla-wow-interface-textures. Alle Quellen sind auf Commit <code>fce08de771abbb8ce8989b6c859f3071aff3f6c6</code> fixiert. Die folgenden Originale werden mit einem Bildpixel pro CSS-Pixel angezeigt.</p><div className="wow-reference-grid">{refs.map(([label,path])=><figure key={path}><img src={`/assets/native/Interface/${path}`} alt={label} /><figcaption>{label}</figcaption></figure>)}</div><p>World of Warcraft-Grafiken: Blizzard Entertainment. Die öffentliche Verfügbarkeit ist keine bestätigte Weiterveröffentlichungslizenz. Nutzungsstand: interne UI-Prüfung. Fehlendes Symbol, Kartenersatz und Rüstungsstudie wurden von Hand als SVG erstellt. Die klassische 1.12-Grafikreferenz beschreibt keine Gleichsetzung von Original, Classic Era und Forever.</p></details></footer>
    </div>
  </main></div></>;
}

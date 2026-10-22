'use client';
import { useState } from 'react';
export interface MinimapProps { label: string; image?: string; markers?: { id: string; label: string; x: number; y: number; onClick?: () => void }[] }
export function Minimap({ label, image, markers = [] }: MinimapProps) {
  const [failed, setFailed] = useState<string>();
  return <figure className="wow-minimap">
    <figcaption title={label}>{label}</figcaption>
    <div className="wow-minimap-disc"><img className="wow-minimap-map" src={!image || failed === image ? '/assets/authored/map-placeholder.svg' : image} onError={() => setFailed(image)} alt={label} />
      {markers.map(marker => <button key={marker.id} type="button" className="wow-minimap-marker" aria-label={marker.label} title={marker.label} onClick={marker.onClick} style={{ left: `${Number.isFinite(marker.x) ? Math.min(92, Math.max(8, marker.x)) : 50}%`, top: `${Number.isFinite(marker.y) ? Math.min(92, Math.max(8, marker.y)) : 50}%` }}>◆</button>)}
    </div>
  </figure>;
}

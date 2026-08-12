// Module 2 — carte corporelle interactive. Chaque zone est un point cliquable
// positionné sur une silhouette. Les positions sont indexées par code de zone.
import React from "react";

// Coordonnées (en %) des points sur la silhouette, par code de zone backend.
const POSITIONS = {
  cou: { x: 50, y: 15 },
  epaule: { x: 33, y: 22 },
  omoplate: { x: 66, y: 24 },
  dos: { x: 50, y: 34 },
  fesse: { x: 42, y: 48 },
  hanche: { x: 58, y: 46 },
  cuisse: { x: 43, y: 60 },
  genou: { x: 43, y: 72 },
  jambe: { x: 57, y: 74 },
  cheville: { x: 43, y: 88 },
  pied: { x: 43, y: 95 },
};

export default function BodyMap({ zones, selection, onSelect }) {
  return (
    <div className="bodymap">
      <svg viewBox="0 0 100 100" className="bodymap-svg" aria-hidden="true">
        {/* Silhouette stylisée */}
        <g fill="#dbeee4" stroke="#0f9d58" strokeWidth="0.6">
          <circle cx="50" cy="9" r="6" />
          <rect x="47" y="14" width="6" height="4" rx="2" />
          <path d="M35 19 Q50 16 65 19 L64 45 Q50 49 36 45 Z" />
          <path d="M35 20 L27 40 L31 41 L38 24 Z" />
          <path d="M65 20 L73 40 L69 41 L62 24 Z" />
          <path d="M39 45 L37 74 L45 74 L48 47 Z" />
          <path d="M61 45 L63 74 L55 74 L52 47 Z" />
          <path d="M40 74 L39 96 L46 96 L46 74 Z" />
          <path d="M60 74 L61 96 L54 96 L54 74 Z" />
        </g>
      </svg>
      {zones.map((z) => {
        const p = POSITIONS[z.code] || { x: 50, y: 50 };
        const actif = selection === z.code;
        return (
          <button
            key={z.code}
            className={`bodymap-point ${actif ? "actif" : ""}`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            onClick={() => onSelect(z)}
            title={z.libelle}
          >
            <span className="pulse" />
            <span className="bodymap-label">{z.libelle}</span>
          </button>
        );
      })}
    </div>
  );
}

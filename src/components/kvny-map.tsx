/**
 * Hand-drawn schematic of Van Nuys Airport (KVNY) for the contact page.
 *
 * Why an SVG and not a map embed or AI render: a tile embed needs a
 * Mapbox key (env we don't have yet) and image models reliably draw the
 * wrong field — KVNY's runways are parallel, generated "maps" cross
 * them. Every factual mark here is checked against the FAA airport
 * diagram: two parallel runways on a ~164° magnetic alignment, 16R/34L
 * at 8,001 ft, 16L/34R at 4,011 ft ending mid-field, FBO row down the
 * east side, field elevation 802 ft, 34.21°N 118.49°W.
 *
 * Styling matches the Placeholder blocks it replaces — ink backdrop,
 * mono uppercase captions — so the page reads as designed, not patched.
 */

const BONE = "rgba(232,226,210,0.92)";
const BONE_DIM = "rgba(232,226,210,0.45)";
const STEEL = "rgba(154,163,178,0.6)";
const GRID = "rgba(232,226,210,0.05)";
const CLEARANCE = "#C8B98C";

export function KvnyMap({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[4px] border border-ink-3 bg-gradient-to-br from-ink-3 to-[#0A0C10]",
        className,
      ].join(" ")}
      data-testid="kvny-map"
    >
      <svg
        viewBox="0 0 500 625"
        role="img"
        aria-label="Schematic diagram of Van Nuys Airport: two parallel runways, 16R/34L at 8,001 feet and 16L/34R at 4,011 feet, with the FBO row along the east side of the field."
        className="block h-auto w-full"
      >
        {/* Faint survey grid */}
        <g stroke={GRID} strokeWidth="1">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} x1={50 * (i + 1)} y1="0" x2={50 * (i + 1)} y2="625" />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={50 * (i + 1)} x2="500" y2={50 * (i + 1)} />
          ))}
        </g>

        {/* Field boundary — loose polygon suggesting the airport property */}
        <path
          d="M 96 52 L 332 40 L 368 78 L 380 560 L 300 588 L 120 575 L 100 320 Z"
          fill="rgba(232,226,210,0.025)"
          stroke="rgba(232,226,210,0.12)"
          strokeWidth="1"
          strokeDasharray="5 5"
        />

        {/* Runways. True alignment is ~176° — a hair off north-south —
            so the whole group leans 4°. Lengths at scale: 8,001 ft main
            ≈ 440 units, 4,011 ft parallel ≈ 220 units. */}
        <g transform="rotate(4 250 312)">
          {/* 16R/34L — 8,001 × 150 ft, the long western runway */}
          <rect x="178" y="72" width="26" height="440" fill="rgba(232,226,210,0.16)" stroke={BONE_DIM} strokeWidth="1.25" />
          <line x1="191" y1="92" x2="191" y2="492" stroke={BONE_DIM} strokeWidth="1.5" strokeDasharray="14 12" />
          {/* threshold bars */}
          <g stroke={BONE} strokeWidth="2">
            <line x1="182" y1="80" x2="200" y2="80" />
            <line x1="182" y1="86" x2="200" y2="86" />
            <line x1="182" y1="504" x2="200" y2="504" />
            <line x1="182" y1="498" x2="200" y2="498" />
          </g>
          <text x="191" y="116" textAnchor="middle" fill={BONE} fontSize="13" fontFamily="ui-monospace, 'JetBrains Mono', monospace" letterSpacing="1">
            16R
          </text>
          <text x="191" y="478" textAnchor="middle" fill={BONE} fontSize="13" fontFamily="ui-monospace, 'JetBrains Mono', monospace" letterSpacing="1">
            34L
          </text>

          {/* 16L/34R — 4,011 × 75 ft, shorter, east side, ends mid-field */}
          <rect x="258" y="84" width="16" height="220" fill="rgba(232,226,210,0.13)" stroke={BONE_DIM} strokeWidth="1" />
          <line x1="266" y1="100" x2="266" y2="288" stroke={BONE_DIM} strokeWidth="1" strokeDasharray="9 8" />
          <text x="266" y="122" textAnchor="middle" fill={BONE} fontSize="10" fontFamily="ui-monospace, 'JetBrains Mono', monospace" letterSpacing="1">
            16L
          </text>
          <text x="266" y="280" textAnchor="middle" fill={BONE} fontSize="10" fontFamily="ui-monospace, 'JetBrains Mono', monospace" letterSpacing="1">
            34R
          </text>

          {/* Parallel taxiway between the runways + stubs */}
          <line x1="228" y1="84" x2="228" y2="512" stroke="rgba(232,226,210,0.22)" strokeWidth="3" />
          <g stroke="rgba(232,226,210,0.18)" strokeWidth="2">
            <line x1="204" y1="140" x2="228" y2="140" />
            <line x1="204" y1="250" x2="228" y2="250" />
            <line x1="204" y1="360" x2="228" y2="360" />
            <line x1="204" y1="470" x2="228" y2="470" />
            <line x1="228" y1="120" x2="258" y2="120" />
            <line x1="228" y1="296" x2="258" y2="296" />
          </g>

          {/* FBO row — east side aprons */}
          <g>
            {[150, 215, 280, 345, 410].map((y) => (
              <rect key={y} x="306" y={y} width="34" height="42" fill="rgba(232,226,210,0.07)" stroke="rgba(232,226,210,0.2)" strokeWidth="1" />
            ))}
            <line x1="298" y1="140" x2="298" y2="462" stroke="rgba(232,226,210,0.18)" strokeWidth="2" />
          </g>
          <text x="360" y="308" fill={STEEL} fontSize="10" fontFamily="ui-monospace, 'JetBrains Mono', monospace" letterSpacing="2" transform="rotate(90 360 308)" textAnchor="middle">
            FBO ROW
          </text>

          {/* Tower */}
          <circle cx="152" cy="300" r="4" fill="none" stroke={CLEARANCE} strokeWidth="1.5" />
          <circle cx="152" cy="300" r="1.5" fill={CLEARANCE} />
          <text x="138" y="304" textAnchor="end" fill={STEEL} fontSize="9" fontFamily="ui-monospace, 'JetBrains Mono', monospace" letterSpacing="1.5">
            TWR
          </text>
        </g>

        {/* North arrow */}
        <g transform="translate(444 70)">
          <line x1="0" y1="22" x2="0" y2="-12" stroke={BONE_DIM} strokeWidth="1.25" />
          <path d="M 0 -18 L -5 -6 L 0 -9 L 5 -6 Z" fill={BONE} />
          <text x="0" y="38" textAnchor="middle" fill={STEEL} fontSize="10" fontFamily="ui-monospace, 'JetBrains Mono', monospace">
            N
          </text>
        </g>

        {/* HQ pointer — Beverly Glen is south-east, over the hill */}
        <g transform="translate(404 540)">
          <circle cx="0" cy="0" r="3" fill={CLEARANCE} />
          <line x1="6" y1="6" x2="26" y2="26" stroke={CLEARANCE} strokeWidth="1" strokeDasharray="3 3" />
          <text x="0" y="-10" textAnchor="middle" fill={CLEARANCE} fontSize="9" fontFamily="ui-monospace, 'JetBrains Mono', monospace" letterSpacing="1.5">
            JETNINE HQ · 10 MIN
          </text>
        </g>

        {/* Footer data line */}
        <text x="24" y="600" fill={STEEL} fontSize="10" fontFamily="ui-monospace, 'JetBrains Mono', monospace" letterSpacing="1.5">
          34.21°N 118.49°W · ELEV 802 FT · RWY 16R/34L 8,001′ · 16L/34R 4,011′
        </text>
      </svg>

      {/* Caption chip, same treatment as Placeholder blocks */}
      <span className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">
        KVNY · VAN NUYS · FIELD DIAGRAM
      </span>
      <span className="absolute right-4 top-4 font-mono text-[9px] uppercase tracking-[0.14em] text-steel">
        Not for navigation
      </span>
    </div>
  );
}

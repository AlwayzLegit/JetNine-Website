// JetNine design system — Tweaks
const { useEffect } = React;

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "mono"
}/*EDITMODE-END*/;

const ACCENT_MAP = {
  mono:  { hex: '#E8E2D2', hover: '#FFFFFF', label: 'CLEARANCE WHITE',  name: 'Monochrome' },
  gold:  { hex: '#C9A24B', hover: '#D4B265', label: 'CLEARANCE GOLD',   name: 'Brushed gold' },
  ice:   { hex: '#9FB8C4', hover: '#B7CAD3', label: 'CLEARANCE ICE',    name: 'Ice blue' },
};

function applyAccent(key) {
  const a = ACCENT_MAP[key] || ACCENT_MAP.mono;
  const root = document.documentElement;
  root.style.setProperty('--clearance', a.hex);
  root.style.setProperty('--clearance-hover', a.hover);
  // text on accent — for gold use ink, for mono/ice also ink (all light enough)
  // update accent chip + labels
  const chip = document.getElementById('accentChip');
  const hex = document.getElementById('accentHex');
  const name = document.getElementById('accentName');
  if (chip) chip.style.background = a.hex;
  if (hex) hex.textContent = a.hex;
  if (name) name.textContent = a.label;
}

function App() {
  const t = window.useTweaks(DEFAULTS);
  const tweak = t[0];
  const setTweak = t[1];

  useEffect(() => { applyAccent(tweak.accent); }, [tweak.accent]);

  return (
    <window.TweaksPanel title="Tweaks">
      <window.TweakSection title="Accent">
        <window.TweakRadio
          label="Color"
          value={tweak.accent}
          onChange={(v) => setTweak('accent', v)}
          options={[
            { value: 'mono', label: 'Mono' },
            { value: 'gold', label: 'Gold' },
            { value: 'ice',  label: 'Ice'  },
          ]}
        />
        <div style={{
          marginTop: 12,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.55)',
          textTransform: 'uppercase'
        }}>
          {ACCENT_MAP[tweak.accent].name} — {ACCENT_MAP[tweak.accent].hex}
        </div>
      </window.TweakSection>
    </window.TweaksPanel>
  );
}

// initial paint before React mounts (avoid flash)
applyAccent(DEFAULTS.accent);

ReactDOM.createRoot(document.getElementById('tweaks-root')).render(<App />);

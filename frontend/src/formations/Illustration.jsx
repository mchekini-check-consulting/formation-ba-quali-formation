// Illustration de chaque formation : une scène dessinée selon le thème de l'intitulé (reprise de la maquette).
import { ART_COL, themeDe } from './themes'

const police = { fontFamily: 'Inter,Arial' }

const SCENES = {
  ba: (a, b) => <>
    <rect x="0" y="0" width="132" height="76" rx="6" fill="#fff" stroke="#CBD5E1" strokeWidth="2" /><path d="M20 76v12M112 76v12" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
    <rect x="12" y="12" width="30" height="14" rx="3" fill={a} /><rect x="58" y="12" width="30" height="14" rx="3" fill={b} /><path d="M42 19h16M73 26v10M27 26v10" stroke="#64748B" strokeWidth="1.6" />
    <path d="M27 36h46" stroke="#64748B" strokeWidth="1.6" /><path d="M50 36v6" stroke="#64748B" strokeWidth="1.6" /><path d="M50 42l10 9-10 9-10-9z" fill="#F2C94C" /><rect x="12" y="54" width="22" height="12" rx="3" fill={b} opacity=".7" /><path d="M34 60h6" stroke="#64748B" strokeWidth="1.6" />
    <rect x="100" y="10" width="22" height="18" rx="2" fill="#FDE68A" transform="rotate(4 111 19)" /><rect x="100" y="33" width="22" height="18" rx="2" fill="#FBCFE8" transform="rotate(-3 111 42)" /><rect x="100" y="55" width="22" height="16" rx="2" fill="#BFDBFE" />
    <circle cx="164" cy="22" r="10" fill="#E0B48C" /><path d="M155 18a10 10 0 0 1 18-2c-4 0-8-1-11-4-2 3-4 5-7 6z" fill="#3F2D20" /><path d="M150 82V44a14 14 0 0 1 28 0v38z" fill={a} /><path d="M152 46L134 34" stroke={a} strokeWidth="7" strokeLinecap="round" /><circle cx="133" cy="33" r="4" fill="#E0B48C" />
  </>,
  mgmt: (a, b) => <>
    <path d="M80 18h60a10 10 0 0 1 10 10v12a10 10 0 0 1-10 10h-42l-10 8v-8h-8a10 10 0 0 1-10-10V28a10 10 0 0 1 10-10z" fill="#fff" stroke="#CBD5E1" strokeWidth="1.5" /><circle cx="96" cy="34" r="3" fill={a} /><circle cx="110" cy="34" r="3" fill={a} /><circle cx="124" cy="34" r="3" fill={a} />
    {[[30, '#E0B48C', b], [105, '#8D5A3B', a], [180, '#F1C9A5', '#F2C94C']].map(([x, sk, c]) => <g key={x}><circle cx={x} cy={x === 105 ? 64 : 58} r="9" fill={sk} /><path d={`M${x - 16} ${x === 105 ? 90 : 84}a16 16 0 0 1 32 0z`} fill={c} /></g>)}
    <rect x="0" y="80" width="210" height="10" rx="5" fill="#CBD5E1" /><rect x="88" y="72" width="26" height="8" rx="2" fill="#475569" />
  </>,
  excel: (a, b) => <>
    <rect x="20" y="0" width="158" height="80" rx="7" fill="#1F2937" /><rect x="26" y="6" width="146" height="68" rx="3" fill="#fff" /><rect x="26" y="6" width="146" height="10" fill={a} />
    {[26, 46, 66, 86].map((y) => <path key={y} d={`M26 ${y}h70`} stroke="#E2E8F0" />)}{[46, 66].map((x) => <path key={x} d={`M${x} 16v58`} stroke="#E2E8F0" />)}
    {[[30, 22], [50, 30], [70, 18]].map(([x, w]) => <g key={x}><rect x={x} y="20" width={w * 0.5} height="3" rx="1.5" fill="#94A3B8" /><rect x={x} y="40" width={w * 0.6} height="3" rx="1.5" fill="#CBD5E1" /><rect x={x} y="60" width={w * 0.4} height="3" rx="1.5" fill="#CBD5E1" /></g>)}
    <rect x="104" y="46" width="12" height="24" rx="2" fill={b} /><rect x="122" y="34" width="12" height="36" rx="2" fill={a} /><rect x="140" y="26" width="12" height="44" rx="2" fill={b} /><rect x="158" y="40" width="10" height="30" rx="2" fill="#F2C94C" />
    <path d="M6 82h186l8 8H-2z" fill="#CBD5E1" />
  </>,
  projet: (a, b) => <>
    <rect x="0" y="0" width="200" height="86" rx="8" fill="#fff" stroke="#CBD5E1" strokeWidth="1.5" />
    {[['À faire', '#94A3B8', 8], ['En cours', '#F2C94C', 72], ['Fait', a, 136]].map(([t, c, x]) => <g key={t}><rect x={x} y="8" width="56" height="8" rx="4" fill={c} /><text x={x + 28} y="14.5" fontSize="6.5" style={police} fontWeight="700" textAnchor="middle" fill="#fff">{t}</text></g>)}
    {[[8, 22, '#FDE68A'], [8, 48, '#BFDBFE'], [72, 22, '#FBCFE8'], [72, 48, '#FDE68A'], [136, 22, b]].map(([x, y, c]) => <g key={`${x}-${y}`}><rect x={x} y={y} width="56" height="22" rx="4" fill={c} /><rect x={x + 6} y={y + 6} width="34" height="3" rx="1.5" fill="#475569" opacity=".6" /><rect x={x + 6} y={y + 13} width="22" height="3" rx="1.5" fill="#475569" opacity=".35" /></g>)}
    <circle cx="180" cy="60" r="11" fill={a} /><path d="M175 60l3.5 3.5L185 56" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  sst: (a) => <>
    <path d="M44 26v-8a6 6 0 0 1 6-6h28a6 6 0 0 1 6 6v8" fill="none" stroke="#9B1C1C" strokeWidth="5" /><rect x="18" y="26" width="92" height="62" rx="10" fill="#E5484D" /><rect x="18" y="26" width="92" height="10" rx="5" fill="#fff" opacity=".18" />
    <path d="M56 42h16v12h12v16H72v12H56V70H44V54h12z" fill="#fff" />
    <path d="M150 34c-6-10-24-6-20 8 3 10 20 20 20 20s17-10 20-20c4-14-14-18-20-8z" fill="#F87171" />
    <path d="M118 74h20l6-14 8 26 7-18 5 6h36" fill="none" stroke={a} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  parole: (a, b) => <>
    <path d="M14 10h56a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H34l-10 8v-8h-10a8 8 0 0 1-8-8V18a8 8 0 0 1 8-8z" fill="#fff" stroke="#CBD5E1" strokeWidth="1.5" /><rect x="16" y="20" width="44" height="4" rx="2" fill={a} opacity=".7" /><rect x="16" y="29" width="30" height="4" rx="2" fill="#CBD5E1" />
    <rect x="96" y="6" width="26" height="40" rx="13" fill="#334155" />{[14, 22, 30, 38].map((y) => <path key={y} d={`M98 ${y}h22`} stroke="#64748B" strokeWidth="1.3" />)}
    <path d="M90 34a19 19 0 0 0 38 0" fill="none" stroke="#475569" strokeWidth="3" /><path d="M109 53v28" stroke="#475569" strokeWidth="3.5" /><ellipse cx="109" cy="84" rx="22" ry="5" fill="#475569" />
    <path d="M140 16a20 20 0 0 1 0 30M150 8a32 32 0 0 1 0 46" fill="none" stroke={b} strokeWidth="3" strokeLinecap="round" />
    <circle cx="180" cy="66" r="12" fill="#F2C94C" /><path d="M180 58l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.7 5.4-.6z" fill="#fff" />
  </>,
  langue: (a, b) => <>
    <path d="M10 6h78a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H34l-12 10V46H10A10 10 0 0 1 0 36V16A10 10 0 0 1 10 6z" fill={a} /><text x="49" y="31" fontSize="15" style={police} fontWeight="700" textAnchor="middle" fill="#fff">Hello!</text>
    <path d="M196 38h-84a10 10 0 0 0-10 10v20a10 10 0 0 0 10 10h50l12 10V78h22a10 10 0 0 0 10-10V48a10 10 0 0 0-10-10z" fill="#fff" stroke="#CBD5E1" strokeWidth="1.5" /><text x="154" y="63" fontSize="14" style={police} fontWeight="700" textAnchor="middle" fill={a}>Bonjour !</text>
    <circle cx="150" cy="16" r="13" fill="none" stroke={b} strokeWidth="2.4" /><path d="M137 16h26M150 3c5 4 7 8 7 13s-2 9-7 13c-5-4-7-8-7-13s2-9 7-13z" fill="none" stroke={b} strokeWidth="2" />
  </>,
  def: (a, b) => <>
    <path d="M100 30c-20-12-50-14-80-8v58c30-6 60-4 80 8z" fill="#fff" stroke="#CBD5E1" strokeWidth="1.5" /><path d="M100 30c20-12 50-14 80-8v58c-30-6-60-4-80 8z" fill="#fff" stroke="#CBD5E1" strokeWidth="1.5" /><path d="M100 30v58" stroke="#CBD5E1" strokeWidth="1.5" />
    {[40, 50, 60].map((y) => <path key={y} d={`M32 ${y - 4}c20-4 40-3 56 4M112 ${y}c16-7 36-8 56-4`} stroke="#CBD5E1" strokeWidth="2" fill="none" />)}
    <path d="M100 0l34 12-34 12-34-12z" fill={a} /><path d="M80 17v10c0 5 40 5 40 0V17l-20 7z" fill={b} /><path d="M134 12v14" stroke="#F2C94C" strokeWidth="2.5" /><circle cx="134" cy="27" r="3" fill="#F2C94C" />
  </>,
}

// large = bandeau de la fiche détaillée (900 de large au lieu de 400)
export function Illustration({ formation, large = false }) {
  const k = themeDe(formation.title), W = large ? 900 : 400, dx = W - 400
  const [, a, b] = ART_COL[k]
  const cx = large ? dx + 205 : 200
  return (
    <svg className="fc-art" viewBox={`0 0 ${W} 130`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={W} height="130" fill="#fff" /><rect width={W} height="130" fill={a} opacity=".09" />
      <circle cx="70" cy="132" r="62" fill={a} opacity=".07" /><circle cx={cx} cy="86" r="62" fill="#fff" opacity=".65" />
      <ellipse cx={cx} cy="122" rx="100" ry="6" fill={a} opacity=".10" />
      <g transform={`translate(${large ? dx + 120 : 116} 47) scale(.8)`}>{SCENES[k](a, b)}</g>
    </svg>
  )
}

export default Illustration

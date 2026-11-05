// Bandeau de chaque formation : une icône du métier et son libellé, aux couleurs du thème déduit de l'intitulé
import { useId } from 'react'
import { ART_COL, THEME_LIBELLE, themeDe } from './themes'

// Icônes des métiers (24 × 24, trait comme components/Icone)
const ICONES = {
  ba: 'M3 4h7v5H3zM14 15h7v5h-7zM6.5 9v3.5h11V15M14 6.5h3.5V12',
  po: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1M21 3l-8.3 8.3M16 3h5v5',
  test: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6zM9 12l2 2 4-4',
  devops: 'M8 8c-2.2 0-4 1.8-4 4s1.8 4 4 4c3 0 5-8 8-8 2.2 0 4 1.8 4 4s-1.8 4-4 4c-3 0-5-8-8-8z',
  archi: 'M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16.5l9 5 9-5',
  ia: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  mgmt: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.3 3.1-6 7-6s7 2.7 7 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c2.4.6 4 2.6 4 6',
  excel: 'M4 4h16v16H4zM4 9h16M9 4v16M13 17v-3M16.5 17v-5',
  projet: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z',
  sst: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  parole: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  langue: 'M3 5h11v8H8l-4 3v-3H3zM14 9h7v8h-1.5v3l-3-3H11v-2',
  def: 'M12 4L2 9l10 5 10-5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5',
}

const trait = { fill: 'none', stroke: '#fff', strokeLinecap: 'round', strokeLinejoin: 'round' }

// Bandeau en dégradé : grande icône en filigrane à droite, icône et métier mis en avant à gauche
// ; large = fiche détaillée (900 de large au lieu de 400)
export function Illustration({ formation, large = false }) {
  const id = useId()
  const k = themeDe(formation.title)
  // Carte : bandeau bas (76), icône et métier centrés à gauche ; fiche : bandeau large (900 × 130)
  const W = large ? 900 : 400, H = large ? 130 : 76
  const [debut, fin, lumiere] = ART_COL[k]
  const x = large ? 32 : 18, t = large ? 50 : 40, y = large ? H - t - 18 : (H - t) / 2
  return (
    <svg className="fc-art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`deg${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={debut} /><stop offset="1" stopColor={fin} /></linearGradient>
        <radialGradient id={`lum${id}`}><stop offset="0" stopColor={lumiere} stopOpacity=".75" /><stop offset="1" stopColor={lumiere} stopOpacity="0" /></radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#deg${id})`} />
      {/* Touches de lumière colorées */}
      <circle cx={W * 0.62} cy="-10" r={H * 0.85} fill={`url(#lum${id})`} />
      <circle cx="30" cy={H + 20} r={H * 0.7} fill={`url(#lum${id})`} opacity=".7" />
      <circle cx={W - 60} cy="10" r={H * 0.7} fill="#fff" opacity=".1" />
      {/* Filigrane */}
      <g transform={`translate(${W - H - 20} 0) rotate(-12 ${H / 2} ${H / 2}) scale(${H / 26})`} opacity=".16"><path d={ICONES[k]} {...trait} strokeWidth="1.4" /></g>
      {/* Icône et métier */}
      <rect x={x} y={y} width={t} height={t} rx={t * 0.28} fill="#fff" fillOpacity=".2" stroke="#fff" strokeOpacity=".45" />
      <g transform={`translate(${x + (t - 24 * (t / 40)) / 2} ${y + (t - 24 * (t / 40)) / 2}) scale(${t / 40})`}><path d={ICONES[k]} {...trait} strokeWidth="2" /></g>
      <text x={x + t + 12} y={y + t / 2 + 6} fontSize={large ? 19 : 16} fontWeight="800" fill="#fff" letterSpacing="-.2" style={{ fontFamily: 'Inter,Arial' }}>{THEME_LIBELLE[k]}</text>
    </svg>
  )
}

export default Illustration

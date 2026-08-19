import type {
  AuditEntry,
  DisasterEvent,
  Evidence,
  PriorityLocation,
} from '../types'

/* Simulated satellite/street imagery as styled inline SVG data-URIs so the
   demo stays fully offline. Each URI encodes a subtle terrain gradient. */

function satUri(seed: number, hue: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'>
  <defs>
    <radialGradient id='g' cx='50%' cy='45%' r='75%'>
      <stop offset='0%' stop-color='hsl(${hue} ${28 + (seed % 14)}% ${52 + (seed % 18)}%)'/>
      <stop offset='55%' stop-color='hsl(${hue} ${32}% ${42 + (seed % 12)}%)'/>
      <stop offset='100%' stop-color='hsl(${hue} ${38}% ${24 + (seed % 10)}%)'/>
    </radialGradient>
    <linearGradient id='w' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='rgba(255,255,255,0.18)'/>
      <stop offset='100%' stop-color='rgba(0,0,0,0.22)'/>
    </linearGradient>
  </defs>
  <rect width='640' height='400' fill='url(#g)'/>
  <ellipse cx='${120 + (seed % 90)}' cy='${90 + (seed % 60)}' rx='${40 + (seed % 30)}' ry='${26 + (seed % 20)}' fill='rgba(19,115,95,0.35)'/>
  <ellipse cx='${430 + (seed % 80)}' cy='${250 + (seed % 70)}' rx='${60 + (seed % 40)}' ry='${40 + (seed % 30)}' fill='rgba(19,115,95,0.28)'/>
  <path d='M0 ${330 - (seed % 20)} L${140} ${290 - (seed % 30)} L${300} ${340} L${460} ${300} L640 ${250}' stroke='rgba(255,255,255,0.35)' stroke-width='3' fill='none'/>
  <path d='M0 400 L180 ${350} L360 ${380} L640 ${330} V400 Z' fill='rgba(0,0,0,0.12)'/>
  <rect width='640' height='400' fill='url(#w)'/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function streetUri(seed: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'>
  <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'>
    <stop offset='0%' stop-color='hsl(${196 + (seed % 12)} ${40}% ${72}%)'/>
    <stop offset='100%' stop-color='hsl(${196 + (seed % 12)} ${34}% ${60}%)'/>
  </linearGradient></defs>
  <rect width='640' height='400' fill='url(#s)'/>
  <rect x='0' y='150' width='640' height='70' fill='#3b3f41' opacity='0.85'/>
  <rect x='0' y='183' width='640' height='6' fill='#f2d36b' opacity='0.7'/>
  <rect x='0' y='270' width='640' height='130' fill='#5d5a4e' opacity='0.9'/>
  <rect x='0' y='286' width='640' height='4' fill='#f2d36b' opacity='0.6'/>
  <rect x='100' y='120' width='70' height='40' fill='#a86f4e'/><rect x='100' y='120' width='70' height='10' fill='#6e4730'/>
  <rect x='230' y='90' width='80' height='48' fill='#b98a66'/><rect x='230' y='90' width='80' height='10' fill='#7a4f33'/>
  <rect x='420' y='110' width='70' height='46' fill='#9d6646'/><rect x='420' y='110' width='70' height='10' fill='#633c28'/>
  <rect x='540' y='200' width='90' height='50' fill='#7a6a50' opacity='0.8'/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const hue = (s: number) => 130 + (s * 27) % 40

export const DISASTER_EVENTS: DisasterEvent[] = [
  {
    id: 'evt-cyclone-nivar',
    name: 'Cyclone Nivar',
    type: 'cyclone',
    region: 'Coastal Odisha',
    status: 'review',
    startedAt: '2026-08-14 06:40 IST',
    imageryCount: 48,
    aiProgress: 100,
  },
  {
    id: 'evt-flood-mahanadi',
    name: 'Mahanadi Flood Surge',
    type: 'flood',
    region: 'Cuttack – Banki',
    status: 'processing',
    startedAt: '2026-07-28 22:10 IST',
    imageryCount: 21,
    aiProgress: 64,
  },
]

const E = (id: string, kind: Evidence['kind'], label: string, caption: string, extra: Partial<Evidence> = {}): Evidence => ({
  id,
  kind,
  label,
  caption,
  ...extra,
})

const CYCLONE_PRIORITIES: Array<Omit<PriorityLocation, 'scenarioId'>> = [
  {
    id: 'loc-paradeep',
    rank: 1,
    name: 'Paradeep Port Area',
    sub: 'Settlement · Jagatsinghpur',
    type: 'settlement',
    lat: 20.2856,
    lng: 86.612,
    score: 94,
    factors: { damage: 96, population: 88, vulnerability: 92, access: 70, service: 84, confidence: 97 },
    damageLevel: 'critical',
    roadStatus: 'blocked',
    affectedPopulation: 12800,
    buildingsAffected: 342,
    nearbyFacilities: ['Paradeep Port Hospital', 'OSDMA Shelter 04'],
    nearestFacility: 'Paradeep Port Hospital',
    serviceRisk: 'critical',
    detections: 118,
    status: 'confirmed',
    aiConfidence: 0.97,
    evidence: [
      E('ev-pd-1', 'imagery', 'Post-landfall · Drone', 'Roof collapse cluster along the jetty approach, 2.4 km grid.', { sourceType: 'drone', image: satUri(3, hue(3)) }),
      E('ev-pd-2', 'detection', 'Severe damage polygon', '116 of 118 detections classified severe or critical by YOLO-v9 damage model.', { image: satUri(7, hue(7)), confidence: 0.97, model: 'yolo-v9-damage · r2026.08' }),
      E('ev-pd-3', 'access', 'NH-53A blocked', 'Flood water over carriageway at 2 spots; OSRM alternate route +22 min.', { image: streetUri(4) }),
      E('ev-pd-4', 'context', 'Population exposure', 'WorldPop grid: ≈12,800 residents within 1 km of severe polygons.', {}),
      E('ev-pd-5', 'audit', 'Model audit', 'Detection run evt-cyclone-nivar/run-0412 · T+3h after landfall · 41 detections verified by operator 06', {}),
    ],
    note: 'Damaged buildings overlap the highest population grid in the block. The nearest shelter route is cut by flooding.',
  },
  {
    id: 'loc-ersama',
    rank: 2,
    name: 'Ersama Block Centre',
    sub: 'Settlement · Jagatsinghpur',
    type: 'settlement',
    lat: 20.0389,
    lng: 86.3517,
    score: 88,
    factors: { damage: 84, population: 90, vulnerability: 88, access: 62, service: 80, confidence: 95 },
    damageLevel: 'severe',
    roadStatus: 'uncertain',
    affectedPopulation: 9600,
    buildingsAffected: 217,
    nearbyFacilities: ['Ersama CHC', 'Govt High School Shelter'],
    nearestFacility: 'Ersama CHC',
    serviceRisk: 'severe',
    detections: 74,
    status: 'pending',
    aiConfidence: 0.95,
    evidence: [
      E('ev-er-1', 'imagery', 'Post-landfall · Satellite', 'Extensive inundation ringing the block centre, moderate structural damage visible.', { sourceType: 'satellite', image: satUri(12, hue(12)) }),
      E('ev-er-2', 'detection', 'Flood + damage signals', 'Segmented flood extent intersects 61 building footprints; 13 roofs breached.', { image: satUri(15, hue(15)), confidence: 0.95, model: 'yolo-v9-damage · r2026.08' }),
      E('ev-er-3', 'access', 'Approach road status uncertain', 'Waterlogged stretch flagged uncertain by CV; needs responder confirmation.', { image: streetUri(9) }),
      E('ev-er-4', 'context', 'Vulnerability index', 'High elderly share + 3 angawadi centres inside inundation footprint.', {}),
    ],
    note: 'Flood and structural damage overlap in the densest settlement of the block. Access is uncertain pending verification.',
  },
  {
    id: 'loc-kujanga',
    rank: 3,
    name: 'Kujanga',
    sub: 'Settlement · Jagatsinghpur',
    type: 'settlement',
    lat: 20.0683,
    lng: 86.6489,
    score: 82,
    factors: { damage: 78, population: 72, vulnerability: 84, access: 66, service: 76, confidence: 92 },
    damageLevel: 'severe',
    roadStatus: 'blocked',
    affectedPopulation: 5400,
    buildingsAffected: 163,
    nearbyFacilities: ['Kujanga PHC'],
    nearestFacility: 'Kujanga PHC',
    serviceRisk: 'severe',
    detections: 58,
    status: 'pending',
    aiConfidence: 0.92,
    evidence: [
      E('ev-kj-1', 'imagery', 'Post-landfall · Drone', 'Partial roof loss and debris across the coastal hamlet cluster.', { sourceType: 'drone', image: satUri(21, hue(21)) }),
      E('ev-kj-2', 'detection', 'Damage polygon set', '55 severe/critical building detections from pre/post pair.', { image: satUri(25, hue(25)), confidence: 0.92, model: 'yolo-v9-damage · r2026.08' }),
      E('ev-kj-3', 'access', 'Coastal link road flooded', 'CS road submerged; open route via Ersama remains passable.', { image: streetUri(14) }),
      E('ev-kj-4', 'context', 'Facility reachability', 'PHC reachable only by boat within 2.1 km; no road detour < 6 km.', {}),
    ],
    note: 'Isolated coastal settlement; only clinic in reachable range is likely disrupted.',
  },
  {
    id: 'loc-puri',
    rank: 4,
    name: 'Puri Sea Front',
    sub: 'Facility · Puri',
    type: 'facility',
    lat: 19.8135,
    lng: 85.8312,
    score: 76,
    factors: { damage: 70, population: 84, vulnerability: 76, access: 58, service: 72, confidence: 89 },
    damageLevel: 'moderate',
    roadStatus: 'uncertain',
    affectedPopulation: 17400,
    buildingsAffected: 96,
    nearbyFacilities: ['District HQ Hospital', 'Puri Bus Terminal'],
    nearestFacility: 'District HQ Hospital',
    serviceRisk: 'moderate',
    detections: 41,
    status: 'pending',
    aiConfidence: 0.89,
    evidence: [
      E('ev-pu-1', 'imagery', 'Post-landfall · Street', 'Debris and stalled vehicles on Marine Drive approach.', { sourceType: 'street', image: streetUri(18) }),
      E('ev-pu-2', 'detection', 'Road obstruction signals', '6 blocked/uncertain points on the sea-front loop; hospital approach open.', { image: satUri(31, hue(31)), confidence: 0.89, model: 'yolo-v9-damage · r2026.08' }),
      E('ev-pu-3', 'context', 'Tourist + resident exposure', 'High seasonal daytime population near temple + bus terminal.', {}),
    ],
    note: 'Large transient population; most critical access is the hospital corridor, which remains open.',
  },
  {
    id: 'loc-bhubaneswar',
    rank: 5,
    name: 'Bhubaneswar East',
    sub: 'Facility · Khordha',
    type: 'facility',
    lat: 20.2961,
    lng: 85.8245,
    score: 68,
    factors: { damage: 44, population: 92, vulnerability: 70, access: 78, service: 64, confidence: 90 },
    damageLevel: 'mild',
    roadStatus: 'open',
    affectedPopulation: 41200,
    buildingsAffected: 38,
    nearbyFacilities: ['AIIMS Bhubaneswar', 'Capital Hospital'],
    nearestFacility: 'AIIMS Bhubaneswar',
    serviceRisk: 'mild',
    detections: 22,
    status: 'confirmed',
    aiConfidence: 0.9,
    evidence: [
      E('ev-bh-1', 'imagery', 'Post-landfall · Satellite', 'Scattered tree fall and minor structural damage; no flood extent.', { sourceType: 'satellite', image: satUri(40, hue(40)) }),
      E('ev-bh-2', 'detection', 'Minor damage set', '22 mild detections, all verified by operators 03/05.', { image: satUri(44, hue(44)), confidence: 0.9, model: 'yolo-v9-damage · r2026.08' }),
      E('ev-bh-3', 'context', 'Critical facility reachability', 'All corridors to AIIMS and Capital Hospital verified open.', {}),
    ],
    note: 'Low physical damage but very high population; kept ranked by exposure, not damage.',
  },
  {
    id: 'loc-cuttack',
    rank: 6,
    name: 'Cuttack–Chandni',
    sub: 'Junction · Cuttack',
    type: 'junction',
    lat: 20.4625,
    lng: 85.8828,
    score: 61,
    factors: { damage: 38, population: 80, vulnerability: 62, access: 84, service: 52, confidence: 87 },
    damageLevel: 'mild',
    roadStatus: 'open',
    affectedPopulation: 26800,
    buildingsAffected: 21,
    nearbyFacilities: ['SCB Medical College'],
    nearestFacility: 'SCB Medical College',
    serviceRisk: 'mild',
    detections: 14,
    status: 'pending',
    aiConfidence: 0.87,
    evidence: [
      E('ev-ct-1', 'imagery', 'Post-landfall · Street', 'Downed signage and light debris; carriageway passable.', { sourceType: 'street', image: streetUri(24) }),
      E('ev-ct-2', 'detection', 'Obstruction signals', '3 uncertain road points cleared after human check.', { image: satUri(52, hue(52)), confidence: 0.87, model: 'yolo-v9-damage · r2026.08' }),
    ],
    note: 'Key east-west corridor; currently open with minor debris.',
  },
  {
    id: 'loc-astaranga',
    rank: 7,
    name: 'Astaranga',
    sub: 'Settlement · Puri',
    type: 'settlement',
    lat: 19.885,
    lng: 86.245,
    score: 54,
    factors: { damage: 52, population: 48, vulnerability: 60, access: 46, service: 44, confidence: 85 },
    damageLevel: 'moderate',
    roadStatus: 'uncertain',
    affectedPopulation: 2900,
    buildingsAffected: 47,
    nearbyFacilities: ['Astaranga CHC'],
    nearestFacility: 'Astaranga CHC',
    serviceRisk: 'moderate',
    detections: 19,
    status: 'pending',
    aiConfidence: 0.85,
    evidence: [
      E('ev-as-1', 'imagery', 'Post-landfall · Drone', 'Fishing village shoreline erosion with partial roof loss.', { sourceType: 'drone', image: satUri(57, hue(57)) }),
      E('ev-as-2', 'detection', 'Damage polygon set', '47 moderate detections along shoreline.', { image: satUri(61, hue(61)), confidence: 0.85, model: 'yolo-v9-damage · r2026.08' }),
    ],
    note: 'Small exposed village; single road approach flagged uncertain.',
  },
  {
    id: 'loc-jagatsinghpur',
    rank: 8,
    name: 'Jagatsinghpur Town',
    sub: 'Settlement · Jagatsinghpur',
    type: 'settlement',
    lat: 20.268,
    lng: 86.168,
    score: 47,
    factors: { damage: 34, population: 76, vulnerability: 50, access: 72, service: 40, confidence: 86 },
    damageLevel: 'mild',
    roadStatus: 'open',
    affectedPopulation: 14200,
    buildingsAffected: 12,
    nearbyFacilities: ['District Hospital'],
    nearestFacility: 'District Hospital',
    serviceRisk: 'mild',
    detections: 8,
    status: 'confirmed',
    aiConfidence: 0.86,
    evidence: [
      E('ev-js-1', 'imagery', 'Post-landfall · Satellite', 'Minor damage; district hospital approach verified open.', { sourceType: 'satellite', image: satUri(66, hue(66)) }),
      E('ev-js-2', 'detection', 'Minor set', '8 detections, all mild; operators 06 confirmed.', { image: satUri(70, hue(70)), confidence: 0.86, model: 'yolo-v9-damage · r2026.08' }),
    ],
    note: 'Moderate population but low exposure; no service impact detected.',
  },
]

/* Mahanadi Flood Surge (Cuttack – Banki) locations — tagged to the flood scenario. */
const FLOOD_PRIORITIES: Array<Omit<PriorityLocation, 'scenarioId'>> = [
  {
    id: 'loc-banki',
    rank: 1,
    name: 'Banki Town',
    sub: 'Settlement · Cuttack',
    type: 'settlement',
    lat: 20.3742,
    lng: 85.4758,
    score: 90,
    factors: { damage: 92, population: 84, vulnerability: 90, access: 74, service: 86, confidence: 96 },
    damageLevel: 'critical',
    roadStatus: 'blocked',
    affectedPopulation: 18200,
    buildingsAffected: 426,
    nearbyFacilities: ['Banki CHC'],
    nearestFacility: 'Banki CHC',
    serviceRisk: 'critical',
    detections: 97,
    status: 'confirmed',
    aiConfidence: 0.96,
    evidence: [
      E('ev-ba-1', 'imagery', 'Flood · Satellite', 'Mahanadi breach ring floods most of the town; roofs submerged in the core ward.', { sourceType: 'satellite', image: satUri(3, 204) }),
      E('ev-ba-2', 'detection', 'Flood extent polygon', 'Segmented flood water intersects 91% of building footprints; 14 roofs breached.', { image: satUri(7, 208), confidence: 0.96, model: 'yolo-v9-damage · r2026.08' }),
      E('ev-ba-3', 'access', 'Banki road cut', 'Main access road under 1.1 m of water; only boat access to CHC confirmed.', { image: streetUri(31) }),
      E('ev-ba-4', 'context', 'Population exposure', 'WorldPop grid: ≈18,200 residents inside the flood footprint.', {}),
    ],
    note: 'Breach-driven inundation has isolated the town centre; the CHC approach is only reachable by boat.',
  },
  {
    id: 'loc-naraj',
    rank: 2,
    name: 'Naraj (Mahanadi Anicut)',
    sub: 'Settlement · Cuttack',
    type: 'settlement',
    lat: 20.449,
    lng: 85.948,
    score: 84,
    factors: { damage: 82, population: 78, vulnerability: 88, access: 68, service: 82, confidence: 94 },
    damageLevel: 'severe',
    roadStatus: 'uncertain',
    affectedPopulation: 12600,
    buildingsAffected: 214,
    nearbyFacilities: ['Naraj Health Centre'],
    nearestFacility: 'Naraj Health Centre',
    serviceRisk: 'severe',
    detections: 71,
    status: 'pending',
    aiConfidence: 0.94,
    evidence: [
      E('ev-na-1', 'imagery', 'Flood · Drone', 'Anicut spillway overtopping; water backs up through the settlement.', { sourceType: 'drone', image: satUri(12, 210) }),
      E('ev-na-2', 'detection', 'Flood + damage signals', '58 flood/damage detections clustered along the channel banks.', { image: satUri(15, 205), confidence: 0.94, model: 'yolo-v9-damage · r2026.08' }),
      E('ev-na-3', 'access', 'Approach road uncertain', 'Single approach flagged waterlogged by CV; needs responder confirmation.', { image: streetUri(38) }),
      E('ev-na-4', 'context', 'Vulnerability index', 'High elderly share and 2 anganwadi centres inside the inundation footprint.', {}),
    ],
    note: 'Spillway overtopping keeps exposure rising; road access is uncertain pending field verification.',
  },
  {
    id: 'loc-athagarh',
    rank: 3,
    name: 'Athagarh',
    sub: 'Settlement · Cuttack',
    type: 'settlement',
    lat: 20.5228,
    lng: 85.6267,
    score: 76,
    factors: { damage: 74, population: 70, vulnerability: 80, access: 64, service: 78, confidence: 90 },
    damageLevel: 'severe',
    roadStatus: 'uncertain',
    affectedPopulation: 8800,
    buildingsAffected: 158,
    nearbyFacilities: ['Athagarh PHC'],
    nearestFacility: 'Athagarh PHC',
    serviceRisk: 'severe',
    detections: 43,
    status: 'pending',
    aiConfidence: 0.9,
    evidence: [
      E('ev-at-1', 'imagery', 'Flood · Satellite', 'Compound inundation from seasonal creek overflow.', { sourceType: 'satellite', image: satUri(21, 212) }),
      E('ev-at-2', 'detection', 'Damage polygon set', '43 severe/critical detections from pre/post pair.', { image: satUri(25, 206), confidence: 0.9, model: 'yolo-v9-damage · r2026.08' }),
      E('ev-at-3', 'access', 'Bypass waterlogged', 'Bypass stretch submerged; interior roads passable in small vehicles.', { image: streetUri(41) }),
    ],
    note: 'Creek overflow isolates the PHC corridor; heavy vehicles cannot pass the bypass.',
  },
  {
    id: 'loc-choudwar',
    rank: 4,
    name: 'Choudwar',
    sub: 'Junction · Cuttack',
    type: 'junction',
    lat: 20.508,
    lng: 85.914,
    score: 70,
    factors: { damage: 58, population: 86, vulnerability: 74, access: 80, service: 60, confidence: 89 },
    damageLevel: 'moderate',
    roadStatus: 'blocked',
    affectedPopulation: 21400,
    buildingsAffected: 96,
    nearbyFacilities: ['SCB Medical College'],
    nearestFacility: 'SCB Medical College',
    serviceRisk: 'moderate',
    detections: 31,
    status: 'pending',
    aiConfidence: 0.89,
    evidence: [
      E('ev-ch-1', 'imagery', 'Flood · Street', 'Carriageway flooding under the railway overpass; traffic diverting.', { sourceType: 'street', image: streetUri(44) }),
      E('ev-ch-2', 'detection', 'Obstruction signals', '3 blocked points on the Cuttack–Athagarh corridor.', { image: satUri(31, 209), confidence: 0.89, model: 'yolo-v9-damage · r2026.08' }),
    ],
    note: 'Key corridor into Cuttack city is cut at the overpass; SCB corridor remains the alternative.',
  },
  {
    id: 'loc-phulnakhara',
    rank: 5,
    name: 'Phulnakhara',
    sub: 'Settlement · Cuttack',
    type: 'settlement',
    lat: 20.372,
    lng: 85.933,
    score: 62,
    factors: { damage: 56, population: 64, vulnerability: 66, access: 58, service: 56, confidence: 88 },
    damageLevel: 'moderate',
    roadStatus: 'uncertain',
    affectedPopulation: 6400,
    buildingsAffected: 74,
    nearbyFacilities: ['Naraj Health Centre'],
    nearestFacility: 'Naraj Health Centre',
    serviceRisk: 'moderate',
    detections: 22,
    status: 'confirmed',
    aiConfidence: 0.88,
    evidence: [
      E('ev-ph-1', 'imagery', 'Flood · Drone', 'Waterlogged farm belt surrounding the settlement core.', { sourceType: 'drone', image: satUri(40, 214) }),
      E('ev-ph-2', 'detection', 'Flood extent set', '22 moderate detections along the drainage line; operator 03 confirmed.', { image: satUri(44, 207), confidence: 0.88, model: 'yolo-v9-damage · r2026.08' }),
    ],
    note: 'Drainage-line flooding; confirmed by operators, road access still uncertain.',
  },
  {
    id: 'loc-cuttack-bijipatna',
    rank: 6,
    name: 'Cuttack Bijipatna',
    sub: 'Junction · Cuttack',
    type: 'junction',
    lat: 20.4567,
    lng: 85.9,
    score: 54,
    factors: { damage: 44, population: 82, vulnerability: 58, access: 76, service: 46, confidence: 86 },
    damageLevel: 'mild',
    roadStatus: 'open',
    affectedPopulation: 15200,
    buildingsAffected: 41,
    nearbyFacilities: ['SCB Medical College'],
    nearestFacility: 'SCB Medical College',
    serviceRisk: 'mild',
    detections: 12,
    status: 'confirmed',
    aiConfidence: 0.86,
    evidence: [
      E('ev-cb-1', 'imagery', 'Flood · Street', 'Light standing water; carriageway passable for all vehicles.', { sourceType: 'street', image: streetUri(47) }),
      E('ev-cb-2', 'detection', 'Minor set', '12 mild detections, all verified by operators 03/05.', { image: satUri(52, 211), confidence: 0.86, model: 'yolo-v9-damage · r2026.08' }),
    ],
    note: 'Low physical impact but high population; corridor to SCB Medical College stays open.',
  },
]

export const PRIORITIES: PriorityLocation[] = [
  ...CYCLONE_PRIORITIES.map((p) => ({ ...p, scenarioId: 'evt-cyclone-nivar' })),
  ...FLOOD_PRIORITIES.map((p) => ({ ...p, scenarioId: 'evt-flood-mahanadi' })),
]

/* Facility coordinates ([lng, lat]) used for OSRM routing to the nearest mapped facility. */
export const FACILITIES: Record<string, [number, number]> = {
  'Paradeep Port Hospital': [86.6139, 20.2823],
  'OSDMA Shelter 04': [86.6061, 20.2892],
  'Ersama CHC': [86.3548, 20.0402],
  'Govt High School Shelter': [86.3579, 20.0431],
  'Kujanga PHC': [86.6482, 20.0686],
  'District HQ Hospital': [85.8312, 19.8135],
  'Puri Bus Terminal': [85.8359, 19.8042],
  'AIIMS Bhubaneswar': [85.8402, 20.3081],
  'Capital Hospital': [85.8304, 20.2979],
  'SCB Medical College': [85.8829, 20.4619],
  'Astaranga CHC': [86.2451, 19.8852],
  'District Hospital': [86.1696, 20.2671],
  'Banki CHC': [85.478, 20.375],
  'Naraj Health Centre': [85.949, 20.449],
  'Athagarh PHC': [85.628, 20.523],
}

export const AUDIT_LOG: AuditEntry[] = [
  { id: 'a1', time: '09:42', actor: 'Operator 06', action: 'Confirmed damage · severe', target: 'Paradeep Port Area' },
  { id: 'a2', time: '09:31', actor: 'Operator 05', action: 'Confirmed damage · mild', target: 'Bhubaneswar East' },
  { id: 'a3', time: '09:18', actor: 'Operator 04', action: 'Corrected road → open', target: 'Cuttack–Chandni' },
  { id: 'a4', time: '08:57', actor: 'Operator 03', action: 'Confirmed damage · mild', target: 'Jagatsinghpur Town' },
  { id: 'a5', time: '08:41', actor: 'System', action: 'Priority recalculated', target: 'Cyclone Nivar' },
  { id: 'a6', time: '08:12', actor: 'Operator 06', action: 'Marked road uncertain', target: 'Ersama Block Centre' },
]

export const FACTOR_META: Record<
  string,
  { label: string; weight: number; color: string; short: string }
> = {
  damage: { label: 'Damage severity', weight: 30, color: 'var(--color-sev-critical)', short: 'Damage' },
  population: { label: 'Population exposure', weight: 20, color: '#2e7d9e', short: 'Population' },
  vulnerability: { label: 'Vulnerability', weight: 20, color: '#7a5aa8', short: 'Vulnerability' },
  access: { label: 'Accessibility risk', weight: 15, color: '#d9822b', short: 'Access' },
  service: { label: 'Critical service impact', weight: 10, color: '#b0543c', short: 'Service' },
  confidence: { label: 'AI confidence', weight: 5, color: '#4d7c6f', short: 'Confidence' },
}

export const FACTOR_ORDER = ['damage', 'population', 'vulnerability', 'access', 'service', 'confidence'] as const

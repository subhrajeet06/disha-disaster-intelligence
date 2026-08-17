import { jsPDF } from 'jspdf'
import type { AuditEntry, KpiSummary, PriorityLocation } from '../types'

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportPrioritiesCsv(locations: PriorityLocation[], eventName: string) {
  const headers = [
    'rank',
    'name',
    'region',
    'score',
    'status',
    'damage_level',
    'road_status',
    'affected_population',
    'buildings_affected',
    'service_risk',
    'ai_confidence',
  ]
  const rows = locations.map((l) =>
    [
      l.rank,
      l.name,
      l.sub,
      l.score,
      l.status,
      l.damageLevel,
      l.roadStatus,
      l.affectedPopulation,
      l.buildingsAffected,
      l.serviceRisk,
      l.aiConfidence,
    ]
      .map(csvCell)
      .join(','),
  )
  download(`${slug(eventName)}-priorities.csv`, [headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8')
}

export function exportPrioritiesGeoJson(locations: PriorityLocation[], eventName: string) {
  const fc = {
    type: 'FeatureCollection',
    features: locations.map((l) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
      properties: {
        id: l.id,
        rank: l.rank,
        name: l.name,
        score: l.score,
        status: l.status,
        damageLevel: l.damageLevel,
        roadStatus: l.roadStatus,
        affectedPopulation: l.affectedPopulation,
        serviceRisk: l.serviceRisk,
      },
    })),
  }
  download(`${slug(eventName)}-priorities.geojson`, JSON.stringify(fc, null, 2), 'application/geo+json')
}

export function exportSituationReport(
  eventName: string,
  region: string,
  eventIdOrKpi: string | KpiSummary,
  kpiOrLocations?: KpiSummary | PriorityLocation[],
  locationsOrAudit?: PriorityLocation[] | AuditEntry[],
  auditLogParam?: AuditEntry[],
) {
  // Support flexible signature in case eventId is optional
  let eventId = ''
  let kpi: KpiSummary
  let locations: PriorityLocation[]
  let auditLog: AuditEntry[]

  if (typeof eventIdOrKpi === 'string') {
    eventId = eventIdOrKpi
    kpi = kpiOrLocations as KpiSummary
    locations = locationsOrAudit as PriorityLocation[]
    auditLog = auditLogParam as AuditEntry[]
  } else {
    kpi = eventIdOrKpi as KpiSummary
    locations = kpiOrLocations as PriorityLocation[]
    auditLog = locationsOrAudit as AuditEntry[]
    eventId = 'N/A'
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  // Page dimensions: 595.28 x 841.89 pt
  const pageWidth = 595.28
  const margin = 36
  const contentWidth = pageWidth - margin * 2 // 523.28 pt

  // Colors
  const primaryColor = [19, 115, 95] // #13735f deep teal
  const darkColor = [27, 38, 59] // #1b263b slate dark
  const mutedColor = [100, 116, 139] // #64748b slate muted
  const lightBg = [248, 250, 252] // #f8fafc card bg
  const borderCol = [226, 232, 240] // #e2e8f0 border line

  let y = 32

  // 1. Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.roundedRect(margin, y, contentWidth, 54, 6, 6, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('DISHA SITUATION REPORT', margin + 14, y + 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(204, 235, 228)
  const metaText = `Scenario: ${eventName}${region ? ` (${region})` : ''}   |   Event ID: ${eventId || 'N/A'}`
  doc.text(metaText, margin + 14, y + 36)

  const timestamp = new Date().toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  doc.text(`Generated: ${timestamp}`, margin + 14, y + 47)

  y += 62

  // 2. Advisory Disclaimer Callout
  doc.setFillColor(254, 242, 242) // soft red/amber background
  doc.setDrawColor(254, 202, 202)
  doc.setLineWidth(0.8)
  doc.roundedRect(margin, y, contentWidth, 20, 4, 4, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(185, 28, 28) // #b91c1c
  doc.text('ADVISORY NOTICE:', margin + 10, y + 13)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(153, 27, 27)
  doc.text('This is an operational advisory summary. It does not replace official field assessment.', margin + 98, y + 13)

  y += 28

  // 3. Key Performance Indicators (KPIs)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
  doc.text('KEY IMPACT & RESPONSE INDICATORS', margin, y + 2)
  y += 8

  const kpis = [
    { label: 'Buildings Affected', val: `${kpi.buildingsAffected}`, sub: `Verified: ${kpi.buildingsVerified}` },
    { label: 'Roads Blocked', val: `${kpi.roadsBlocked}`, sub: `Checked: ${kpi.roadsChecked}` },
    { label: 'Services at Risk', val: `${kpi.servicesAtRisk}`, sub: 'Critical units' },
    { label: 'Population Exposed', val: `${kpi.populationAffected.toLocaleString('en-IN')}`, sub: 'Estimated count' },
    { label: 'Avg AI Confidence', val: `${Math.round(kpi.avgConfidence * 100)}%`, sub: 'Model certainty' },
    { label: 'Verified by Responders', val: `${Math.round(kpi.verifiedShare * 100)}%`, sub: 'Human verified' },
  ]

  const cardGap = 7
  const numCards = 6
  const cardWidth = (contentWidth - (numCards - 1) * cardGap) / numCards
  const cardHeight = 44

  kpis.forEach((item, idx) => {
    const cx = margin + idx * (cardWidth + cardGap)
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2])
    doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2])
    doc.setLineWidth(0.6)
    doc.roundedRect(cx, y, cardWidth, cardHeight, 4, 4, 'FD')

    // Top accent bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.rect(cx, y, cardWidth, 2, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
    doc.text(item.val, cx + cardWidth / 2, y + 17, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.text(item.label, cx + cardWidth / 2, y + 28, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2])
    doc.text(item.sub, cx + cardWidth / 2, y + 37, { align: 'center' })
  })

  y += cardHeight + 14

  // 4. Verification Summary
  const verificationCounts = { confirmed: 0, corrected: 0, rejected: 0, uncertain: 0, pending: 0 }
  for (const l of locations) {
    if (verificationCounts[l.status] !== undefined) {
      verificationCounts[l.status] += 1
    }
  }
  const totalLoc = locations.length || 1

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
  doc.text('VERIFICATION SUMMARY', margin, y + 2)
  y += 8

  const verifItems = [
    { label: 'Confirmed', count: verificationCounts.confirmed, color: [19, 115, 95] },
    { label: 'Corrected', count: verificationCounts.corrected, color: [0, 0, 238] },
    { label: 'Rejected', count: verificationCounts.rejected, color: [192, 57, 43] },
    { label: 'Uncertain', count: verificationCounts.uncertain, color: [233, 185, 73] },
    { label: 'Pending Review', count: verificationCounts.pending, color: [138, 160, 153] },
  ]

  const vCardWidth = (contentWidth - 4 * 7) / 5
  verifItems.forEach((v, idx) => {
    const vx = margin + idx * (vCardWidth + 7)
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2])
    doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2])
    doc.setLineWidth(0.6)
    doc.roundedRect(vx, y, vCardWidth, 26, 4, 4, 'FD')

    // Left indicator dot
    doc.setFillColor(v.color[0], v.color[1], v.color[2])
    doc.circle(vx + 9, y + 13, 3, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
    doc.text(v.label, vx + 16, y + 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2])
    const pctVal = Math.round((v.count / totalLoc) * 100)
    doc.text(`${v.count} loc (${pctVal}%)`, vx + 16, y + 21)
  })

  y += 34

  // 5. Top Response Priorities
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
  doc.text('TOP RESPONSE PRIORITIES (RANKED BY RISK & CRITICALITY)', margin, y + 2)
  y += 8

  // Table header
  const thHeight = 15
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(margin, y, contentWidth, thHeight, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)
  doc.text('#', margin + 6, y + 10)
  doc.text('LOCATION / SETTLEMENT', margin + 22, y + 10)
  doc.text('SCORE', margin + 175, y + 10)
  doc.text('DAMAGE', margin + 215, y + 10)
  doc.text('ROAD ACCESS', margin + 275, y + 10)
  doc.text('POPULATION', margin + 345, y + 10)
  doc.text('SERVICES', margin + 410, y + 10)
  doc.text('STATUS', margin + 465, y + 10)

  y += thHeight

  const topPriorities = locations.slice(0, 8)
  const rowHeight = 16
  topPriorities.forEach((l, idx) => {
    const isEven = idx % 2 === 0
    if (isEven) {
      doc.setFillColor(255, 255, 255)
    } else {
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2])
    }
    doc.rect(margin, y, contentWidth, rowHeight, 'F')

    // Bottom row border
    doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2])
    doc.setLineWidth(0.4)
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
    doc.text(`${l.rank}`, margin + 6, y + 11)

    // Name + sub
    doc.setFont('helvetica', 'bold')
    const locName = l.name.length > 26 ? `${l.name.slice(0, 24)}…` : l.name
    doc.text(locName, margin + 22, y + 11)

    // Score badge
    doc.setFillColor(
      l.score >= 85 ? 254 : l.score >= 70 ? 254 : 240,
      l.score >= 85 ? 242 : l.score >= 70 ? 249 : 253,
      l.score >= 85 ? 242 : l.score >= 70 ? 235 : 244,
    )
    doc.roundedRect(margin + 172, y + 3, 28, 10, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(
      l.score >= 85 ? 185 : l.score >= 70 ? 180 : 30,
      l.score >= 85 ? 28 : l.score >= 70 ? 83 : 64,
      l.score >= 85 ? 28 : l.score >= 70 ? 9 : 175,
    )
    doc.text(`${l.score}/100`, margin + 176, y + 10.5)

    // Damage severity
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
    const dmg = l.damageLevel.toUpperCase()
    doc.text(dmg, margin + 215, y + 11)

    // Road status
    const road = l.roadStatus ? l.roadStatus.toUpperCase() : 'UNKNOWN'
    doc.text(road, margin + 275, y + 11)

    // Population
    doc.text(l.affectedPopulation ? l.affectedPopulation.toLocaleString('en-IN') : '-', margin + 345, y + 11)

    // Service Risk
    doc.text(l.serviceRisk ? l.serviceRisk.toUpperCase() : 'NONE', margin + 410, y + 11)

    // Verification status
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    if (l.status === 'confirmed') {
      doc.setTextColor(19, 115, 95)
    } else if (l.status === 'corrected') {
      doc.setTextColor(0, 0, 238)
    } else if (l.status === 'rejected') {
      doc.setTextColor(192, 57, 43)
    } else if (l.status === 'uncertain') {
      doc.setTextColor(180, 83, 9)
    } else {
      doc.setTextColor(100, 116, 139)
    }
    doc.text(l.status.toUpperCase(), margin + 465, y + 11)

    y += rowHeight
  })

  y += 12

  // 6. Recent Audit Information
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
  doc.text('RECENT AUDIT & DECISION TRAIL', margin, y + 2)
  y += 8

  const recentAudit = auditLog.slice(0, 5)
  const auditRowHeight = 14
  recentAudit.forEach((a, idx) => {
    const isEven = idx % 2 === 0
    if (isEven) {
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2])
      doc.rect(margin, y, contentWidth, auditRowHeight, 'F')
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.text(a.time || '--', margin + 6, y + 10)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
    doc.text(a.actor || 'User', margin + 70, y + 10)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2])
    const actionText = `${a.action}  —  Target: ${a.target}`
    const truncatedAction = actionText.length > 85 ? `${actionText.slice(0, 83)}…` : actionText
    doc.text(truncatedAction, margin + 130, y + 10)

    y += auditRowHeight
  })

  // 7. Footer
  const footerY = 806
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2])
  doc.setLineWidth(0.6)
  doc.line(margin, footerY - 14, margin + contentWidth, footerY - 14)

  // Golden Rule Line
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('AI recommends. Evidence explains. Humans verify. The system records.', pageWidth / 2, footerY - 3, {
    align: 'center',
  })

  // Sub-footer
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2])
  doc.text(
    `DISHA Automated Situation Assessment  ·  Confidential & Operational  ·  Page 1 of 1`,
    pageWidth / 2,
    footerY + 9,
    { align: 'center' },
  )

  doc.save(`${slug(eventName)}-situation-report.pdf`)
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'disha-report'
}

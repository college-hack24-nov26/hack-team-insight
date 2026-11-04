const date = (value) => value ? new Date(value).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not recorded';
const time = (value) => value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not recorded';
const display = (value) => value === null || value === undefined || value === '' ? 'Not recorded' : String(value);
const weight = (value) => value == null || value === '' ? 'Not recorded' : `${Number(value).toLocaleString([], { maximumFractionDigits: 2 })} kg`;

async function loadBrandMark() {
  try {
    const response = await fetch(new URL('/assets/wellcare-logo.png', window.location.origin));
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function createPrescriptionPdf(prescription, { brandMarkDataUrl } = {}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const margin = 15;
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const pageBottom = height - 18;
  const teal = [8, 52, 61];
  const ink = [43, 66, 61];
  const muted = [105, 127, 119];
  const border = [222, 234, 229];
  const contentWidth = width - margin * 2;
  const logo = brandMarkDataUrl || await loadBrandMark();
  let y = 16;

  if (logo) doc.addImage(logo, 'PNG', margin, y, 11, 11);
  const titleX = logo ? margin + 16 : margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...ink);
  doc.text(display(prescription.clinicName || 'WELLCARE'), titleX, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(`Prescription #${display(prescription.id)}`, titleX, y + 10);
  doc.text(`Issued ${date(prescription.createdAt)}`, width - margin, y + 5, { align: 'right' });
  doc.setDrawColor(...border);
  doc.line(margin, 33, width - margin, 33);
  y = 40;

  function sectionHeading(label, atY) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...teal);
    doc.text(label.toUpperCase(), margin, atY);
  }

  function ensureRoom(required, atY) {
    if (atY + required <= pageBottom) return atY;
    doc.addPage();
    return 20;
  }

  sectionHeading('Patient information', y);
  y += 5;
  const patientFields = [
    ['Patient name', display(prescription.patientName)],
    ['Patient ID', display(prescription.patientPublicId)],
    ['Age', prescription.patientAge == null ? 'Not recorded' : `${prescription.patientAge} years`],
    ['Weight', weight(prescription.patientWeightKg)],
    ['Appointment date', date(prescription.appointmentStartsAt)],
    ['Appointment time', time(prescription.appointmentStartsAt)],
  ];
  const columnGap = 10;
  const columnWidth = (contentWidth - columnGap) / 2;
  const valueWidth = columnWidth - 4;
  const rows = [];
  for (let index = 0; index < patientFields.length; index += 2) {
    const left = patientFields[index];
    const right = patientFields[index + 1];
    const leftLines = doc.splitTextToSize(left[1], valueWidth);
    const rightLines = doc.splitTextToSize(right[1], valueWidth);
    rows.push({ left, right, leftLines, rightLines, height: Math.max(12, Math.max(leftLines.length, rightLines.length) * 4 + 8) });
  }
  const patientCardHeight = 9 + rows.reduce((total, row) => total + row.height, 0);
  y = ensureRoom(patientCardHeight + 8, y);
  doc.setDrawColor(...border);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, contentWidth, patientCardHeight, 3, 3, 'FD');
  let rowY = y + 5;
  for (const row of rows) {
    for (const [field, lines, x] of [[row.left, row.leftLines, margin + 5], [row.right, row.rightLines, margin + 5 + columnWidth + columnGap]]) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...muted);
      doc.text(field[0].toUpperCase(), x, rowY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(lines, x, rowY + 4.5, { lineHeightFactor: 1.05 });
    }
    rowY += row.height;
  }
  y += patientCardHeight + 8;

  function addTextCard(heading, body, startY) {
    let currentY = startY;
    let remaining = doc.splitTextToSize(display(body), contentWidth - 10);
    let continued = false;
    while (remaining.length) {
      currentY = ensureRoom(22, currentY);
      sectionHeading(continued ? `${heading} (continued)` : heading, currentY);
      currentY += 5;
      const lineHeight = 4.3;
      const capacity = Math.max(1, Math.floor((pageBottom - currentY - 12) / lineHeight));
      const lines = remaining.slice(0, capacity);
      remaining = remaining.slice(lines.length);
      const cardHeight = lines.length * lineHeight + 8;
      doc.setDrawColor(...border);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, currentY, contentWidth, cardHeight, 3, 3, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(lines, margin + 5, currentY + 5.5, { lineHeightFactor: 1.1 });
      currentY += cardHeight + 8;
      if (remaining.length) {
        doc.addPage();
        currentY = 20;
        continued = true;
      }
    }
    return currentY;
  }

  y = addTextCard('Clinical assessment', prescription.assessment || 'Not recorded', y);
  y = ensureRoom(22, y);
  sectionHeading('Prescribed medications', y);
  autoTable(doc, {
    startY: y + 4,
    head: [['Medicine', 'Dosage', 'Duration', 'Instructions']],
    body: (prescription.items || []).map((item) => [display(item.medicineName), display(item.dosage), display(item.duration), display(item.instructions)]),
    theme: 'grid',
    margin: { left: margin, right: margin, top: 19, bottom: 20 },
    headStyles: { fillColor: teal, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3, textColor: ink, lineColor: border, lineWidth: 0.25, overflow: 'linebreak', valign: 'middle' },
    columnStyles: { 0: { cellWidth: 46, fontStyle: 'bold' }, 1: { cellWidth: 46 }, 2: { cellWidth: 35 }, 3: { cellWidth: 'auto' } },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
  });
  y = doc.lastAutoTable.finalY + 8;
  y = addTextCard("Doctor's advice", prescription.instructions || 'No additional advice recorded.', y);

  y = ensureRoom(14, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...ink);
  doc.text('Follow-up:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(prescription.followUpDate ? date(prescription.followUpDate) : 'Not specified', margin + 22, y);
  y += 10;

  y = ensureRoom(38, y);
  doc.setDrawColor(...border);
  doc.line(margin, y, width - margin, y);
  y += 8;
  doc.setDrawColor(136, 177, 160);
  doc.line(margin, y, margin + 58, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text('Issued under authenticated doctor account', margin, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...teal);
  doc.text(`Dr. ${display(prescription.doctorName)}`, margin, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...ink);
  doc.text(`${display(prescription.specialization)} | ${display(prescription.doctorPublicId)}`, margin, y + 18);
  doc.text(`Medical registration ${display(prescription.registrationNumber)}`, margin, y + 23);
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text('Account attribution only; not a digitally certified signature.', margin, y + 28);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    if (page > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...teal);
      doc.text(`WELLCARE | Prescription #${display(prescription.id)}`, margin, 12);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text('WELLCARE - PRIVATE PATIENT RECORD', margin, height - 8);
    doc.text(`Page ${page} of ${pageCount}`, width - margin, height - 8, { align: 'right' });
  }
  return doc;
}

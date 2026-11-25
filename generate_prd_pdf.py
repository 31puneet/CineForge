import re
import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable, Preformatted
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, page_count):
        if self._pageNumber > 1:
            self.saveState()
            self.setFont('Helvetica-Bold', 7)
            self.setFillColor(colors.HexColor('#64748B'))
            # Header
            self.drawString(40, letter[1] - 28, 'CINEFORGE')
            self.setFont('Helvetica', 7)
            self.drawString(95, letter[1] - 28, '|   Product Requirements Document (PRD) — Agentic Film Studio')
            self.drawRightString(letter[0] - 40, letter[1] - 28, 'Confidential')
            self.setStrokeColor(colors.HexColor('#CBD5E1'))
            self.setLineWidth(0.5)
            self.line(40, letter[1] - 32, letter[0] - 40, letter[1] - 32)
            
            # Footer
            self.line(40, 32, letter[0] - 40, 32)
            self.drawString(40, 22, 'CineForge OJT / Production Specification')
            page_text = f'Page {self._pageNumber} of {page_count}'
            self.drawRightString(letter[0] - 40, 22, page_text)
            self.restoreState()

def clean_inline_md(text):
    if not text:
        return ""
    # Strip markdown escape slashes e.g. 1\. -> 1.
    text = re.sub(r'\\([\.\[\]\(\)\-\#\*\_])', r'\1', text)
    # Escape XML special chars
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    
    # Inline code
    text = re.sub(r'`([^`]+)`', r'<font name="Courier" color="#1E293B"><b>\1</b></font>', text)
    # Bold
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    # Italic
    text = re.sub(r'\*([^*]+)\*', r'<i>\1</i>', text)
    text = re.sub(r'_([^_]+)_', r'<i>\1</i>', text)
    
    return text.strip()

def build_pdf(md_path, output_pdf_path):
    print(f"Reading {md_path}...")
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=42,
        bottomMargin=42
    )

    avail_width = letter[0] - 80  # 532 pt

    styles = getSampleStyleSheet()

    # Custom styles
    cover_title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=28,
        leading=34,
        textColor=colors.HexColor('#0F172A'),
        alignment=TA_CENTER
    )

    cover_subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=15,
        leading=20,
        textColor=colors.HexColor('#475569'),
        alignment=TA_CENTER
    )

    h1_style = ParagraphStyle(
        'CustomH1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'CustomH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'CustomH3',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        spaceBefore=7,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'CustomBullet',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )

    code_block_style = ParagraphStyle(
        'CustomCode',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#0F172A')
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
        alignment=TA_LEFT
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#1E293B'),
        alignment=TA_LEFT
    )

    story = []

    # --- COVER PAGE ---
    story.append(Spacer(1, 40))
    story.append(Paragraph("<b>CINEFORGE</b>", ParagraphStyle('LogoStyle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=colors.HexColor('#4F46E5'), alignment=TA_CENTER)))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Autonomous Multi-Agent AI Film Studio", ParagraphStyle('LogoSub', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=12, leading=16, textColor=colors.HexColor('#0F172A'), alignment=TA_CENTER)))
    story.append(Spacer(1, 30))
    
    story.append(HRFlowable(width="60%", thickness=2, color=colors.HexColor('#4F46E5'), spaceBefore=10, spaceAfter=25, hAlign='CENTER'))
    
    story.append(Paragraph("PRODUCT REQUIREMENTS DOCUMENT", cover_title_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Comprehensive Product Specification, Agent Architecture &amp; System Behavior", cover_subtitle_style))
    story.append(Spacer(1, 35))

    # Meta card table
    meta_data = [
        [Paragraph("<b>Project Name:</b>", body_style), Paragraph("CineForge (Agentic Film Studio)", body_style)],
        [Paragraph("<b>Document Version:</b>", body_style), Paragraph("1.0 (Comprehensive Release)", body_style)],
        [Paragraph("<b>Track:</b>", body_style), Paragraph("GenAI (Media &amp; Creator Economy / Content Creation)", body_style)],
        [Paragraph("<b>Tech Stack:</b>", body_style), Paragraph("React 18, Node.js/Express, FastAPI, LangGraph, MongoDB, Redis, MinIO, Gemini 2.5/3.8 Flash, Wan 2.2 I2V", body_style)],
        [Paragraph("<b>Core Workflow:</b>", body_style), Paragraph("5-Agent HITL Pipeline (Script &rarr; Character &rarr; Voiceover &rarr; Video &rarr; Editor)", body_style)],
        [Paragraph("<b>Author / Team:</b>", body_style), Paragraph("Puneet Seervi / Ayush Raj &amp; CineForge Team", body_style)],
        [Paragraph("<b>Date:</b>", body_style), Paragraph("November 2026", body_style)],
        [Paragraph("<b>Classification:</b>", body_style), Paragraph("CONFIDENTIAL — Internal Product &amp; Engineering Specification", body_style)]
    ]
    meta_table = Table(meta_data, colWidths=[130, avail_width - 130])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(meta_table)

    story.append(Spacer(1, 40))
    story.append(Paragraph("<b>Executive Summary:</b> CineForge is a human-in-the-loop, multi-agent AI film studio where users direct short films and cinematic trailers. By coordinating five domain-specific AI agents, the platform standardizes script generation, visual keyframing, character consistency, voiceover narration, AI video rendering, and multi-track audio-video assembly into a seamless studio workspace.", ParagraphStyle('ExecSummary', parent=body_style, fontSize=9, leading=13, textColor=colors.HexColor('#334155'), alignment=TA_JUSTIFY)))

    story.append(PageBreak())

    # --- PARSE MARKDOWN CONTENT ---
    i = 0
    in_code_block = False
    code_lines = []
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Handle Code Blocks
        if stripped.startswith('```'):
            if in_code_block:
                in_code_block = False
                code_text = "\n".join(code_lines)
                code_lines = []
                p_code = Preformatted(code_text, code_block_style)
                code_table = Table([[p_code]], colWidths=[avail_width])
                code_table.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F1F5F9')),
                    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
                    ('LEFTPADDING', (0,0), (-1,-1), 8),
                    ('RIGHTPADDING', (0,0), (-1,-1), 8),
                    ('TOPPADDING', (0,0), (-1,-1), 6),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ]))
                story.append(Spacer(1, 4))
                story.append(code_table)
                story.append(Spacer(1, 5))
            else:
                in_code_block = True
                code_lines = []
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        # Skip empty lines
        if not stripped:
            i += 1
            continue

        # Headings
        if stripped.startswith('# '):
            h_text = clean_inline_md(stripped[2:])
            # Don't duplicate initial doc title
            if "TABLE OF CONTENTS" in h_text:
                story.append(Paragraph("TABLE OF CONTENTS", h1_style))
                story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceBefore=2, spaceAfter=6))
            else:
                story.append(Spacer(1, 6))
                story.append(Paragraph(h_text, h1_style))
                story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor('#E2E8F0'), spaceBefore=2, spaceAfter=5))
            i += 1
            continue
        elif stripped.startswith('## '):
            h_text = clean_inline_md(stripped[3:])
            story.append(Paragraph(h_text, h2_style))
            i += 1
            continue
        elif stripped.startswith('### '):
            h_text = clean_inline_md(stripped[4:])
            story.append(Paragraph(h_text, h3_style))
            i += 1
            continue
        elif stripped.startswith('#### '):
            h_text = clean_inline_md(stripped[5:])
            story.append(Paragraph(h_text, h3_style))
            i += 1
            continue

        # Tables (starts with |)
        if stripped.startswith('|'):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                table_lines.append(lines[i].strip())
                i += 1
            
            if len(table_lines) >= 2:
                # Parse markdown table
                parsed_rows = []
                for idx, tline in enumerate(table_lines):
                    # Check if separator row
                    if re.match(r'^\|[\s\-:|]+\|$', tline):
                        continue
                    cells = [c.strip() for c in tline.split('|')[1:-1]]
                    if not cells or all(c == '' for c in cells):
                        continue
                    parsed_rows.append((idx == 0, cells))
                
                if parsed_rows:
                    num_cols = max(len(r[1]) for r in parsed_rows)
                    # Normalize cell counts
                    norm_rows = []
                    for is_head, cells in parsed_rows:
                        while len(cells) < num_cols:
                            cells.append('')
                        cell_paras = []
                        for c in cells:
                            clean_c = clean_inline_md(c)
                            if is_head:
                                cell_paras.append(Paragraph(f"<b>{clean_c}</b>", table_header_style))
                            else:
                                cell_paras.append(Paragraph(clean_c, table_cell_style))
                        norm_rows.append(cell_paras)
                    
                    # Compute column widths
                    if num_cols == 2:
                        col_w = [140, avail_width - 140]
                    elif num_cols == 3:
                        col_w = [90, 150, avail_width - 240]
                    elif num_cols == 4:
                        col_w = [75, 110, 110, avail_width - 295]
                    elif num_cols == 5:
                        col_w = [55, 90, 115, 115, avail_width - 375]
                    else:
                        col_w = [avail_width / num_cols] * num_cols

                    t = Table(norm_rows, colWidths=col_w, repeatRows=1)
                    t_style = [
                        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E293B')),
                        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
                        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
                        ('TOPPADDING', (0,0), (-1,-1), 4),
                        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                        ('LEFTPADDING', (0,0), (-1,-1), 5),
                        ('RIGHTPADDING', (0,0), (-1,-1), 5),
                        ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ]
                    # Alternating colors
                    for r_idx in range(1, len(norm_rows)):
                        bg = colors.HexColor('#F8FAFC') if r_idx % 2 == 1 else colors.white
                        t_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), bg))

                    t.setStyle(TableStyle(t_style))
                    story.append(Spacer(1, 4))
                    story.append(t)
                    story.append(Spacer(1, 6))
            continue

        # Bullet point
        if stripped.startswith(('- ', '* ')):
            bullet_text = clean_inline_md(stripped[2:])
            story.append(Paragraph(f"&bull;  {bullet_text}", bullet_style))
            i += 1
            continue

        # Numbered list
        m_num = re.match(r'^(\d+[\.\)])\s+(.*)', stripped)
        if m_num:
            prefix, text_val = m_num.groups()
            cleaned_val = clean_inline_md(text_val)
            story.append(Paragraph(f"<b>{prefix}</b>  {cleaned_val}", bullet_style))
            i += 1
            continue

        # Normal paragraph
        p_text = clean_inline_md(stripped)
        if p_text:
            story.append(Paragraph(p_text, body_style))
        i += 1

    print(f"Building PDF document into {output_pdf_path}...")
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully built! Size: {os.path.getsize(output_pdf_path)} bytes.")

if __name__ == '__main__':
    md_file = 'docs/PRD -- FilmStudio.md'
    out_pdf = 'CineForge_PRD.pdf'
    build_pdf(md_file, out_pdf)

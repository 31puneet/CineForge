import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
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
        self.saveState()
        self.setFont('Helvetica-Bold', 8)
        self.setFillColor(colors.HexColor('#4F46E5'))
        self.drawString(40, letter[1] - 28, 'CINEFORGE')
        self.setFont('Helvetica', 8)
        self.setFillColor(colors.HexColor('#64748B'))
        self.drawString(100, letter[1] - 28, '|   Product Requirements Document (PRD)')
        self.drawRightString(letter[0] - 40, letter[1] - 28, 'Confidential')
        
        self.setStrokeColor(colors.HexColor('#E2E8F0'))
        self.setLineWidth(0.75)
        self.line(40, letter[1] - 32, letter[0] - 40, letter[1] - 32)
        
        # Footer
        self.line(40, 32, letter[0] - 40, 32)
        self.drawString(40, 22, 'CineForge — Autonomous Multi-Agent AI Film Studio')
        page_text = f'Page {self._pageNumber} of {page_count}'
        self.drawRightString(letter[0] - 40, 22, page_text)
        self.restoreState()

def generate_concise_prd_pdf(output_pdf_path):
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=46,
        bottomMargin=44
    )

    avail_width = letter[0] - 80  # 532 pt
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=14
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'StoryH3',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=7,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=4
    )

    goal_box_style = ParagraphStyle(
        'GoalBox',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor('#0F172A')
    )

    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor('#334155'),
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=2
    )

    state_style = ParagraphStyle(
        'StateFlow',
        parent=styles['Normal'],
        fontName='Courier-Bold',
        fontSize=8,
        leading=12,
        textColor=colors.HexColor('#4F46E5')
    )

    table_head = ParagraphStyle(
        'THead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    table_cell = ParagraphStyle(
        'TCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#1E293B')
    )

    table_cell_must = ParagraphStyle(
        'TCellMust',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#DC2626')
    )

    table_cell_should = ParagraphStyle(
        'TCellShould',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#D97706')
    )

    table_cell_could = ParagraphStyle(
        'TCellCould',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#2563EB')
    )

    story = []

    # Title Banner
    story.append(Paragraph("Product Requirements Document (PRD)", title_style))
    story.append(Paragraph("<b>Project:</b> CineForge &nbsp;|&nbsp; <b>Track:</b> GenAI (Content Creation) &nbsp;|&nbsp; <b>Architecture:</b> 5-Agent HITL Film Studio", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceBefore=0, spaceAfter=10))

    # Product Goal
    story.append(Paragraph("Product Goal", h2_style))
    goal_card = Table([[
        Paragraph("Create an autonomous, multi-agent AI film studio workspace that converts creative ideas, reference media, and story prompts into structured production assets and a fully rendered cinematic video with human-in-the-loop approval.", goal_box_style)
    ]], colWidths=[avail_width])
    goal_card.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
        ('LINELEFT', (0,0), (0,-1), 3, colors.HexColor('#4F46E5')),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(goal_card)
    story.append(Spacer(1, 10))

    # Feature Priorities
    story.append(Paragraph("Feature Priorities", h2_style))
    features = [
        ("Project creation & configuration", "Must", table_cell_must),
        ("User authentication (OAuth 2.0 & JWT)", "Must", table_cell_must),
        ("Structured script generation (Script Agent)", "Must", table_cell_must),
        ("Character sheet & visual consistency (Character Agent)", "Must", table_cell_must),
        ("Voiceover audio generation (Voiceover Agent)", "Must", table_cell_must),
        ("AI video clip rendering (Video Agent)", "Must", table_cell_must),
        ("Master timeline assembly & stitching (Editor Agent)", "Must", table_cell_must),
        ("Human-in-the-loop approval & rejection gates", "Must", table_cell_must),
        ("Object storage & asset tracking (MinIO / S3)", "Must", table_cell_must),
        ("Checkpoint caching & resume capability", "Must", table_cell_must),
        ("Studio workspace & interactive dashboard", "Should", table_cell_should),
        ("Multi-tab artifact viewers (Script, Character, Audio, Video)", "Should", table_cell_should),
        ("Real-time SSE generation progress streaming", "Should", table_cell_should),
        ("Final MP4 export & metadata summary download", "Should", table_cell_should),
        ("Custom model provider switching (Gemini / Pollinations / Wan 2.2)", "Could", table_cell_could),
    ]

    table_data = [[
        Paragraph("<b>Feature</b>", table_head),
        Paragraph("<b>Priority</b>", table_head)
    ]]
    for feat, prio, prio_style in features:
        table_data.append([
            Paragraph(feat, table_cell),
            Paragraph(prio, prio_style)
        ])

    feat_table = Table(table_data, colWidths=[avail_width - 80, 80])
    feat_table_style = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E293B')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]
    for r_idx in range(1, len(table_data)):
        bg = colors.HexColor('#F8FAFC') if r_idx % 2 == 1 else colors.white
        feat_table_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), bg))

    feat_table.setStyle(TableStyle(feat_table_style))
    story.append(feat_table)
    story.append(Spacer(1, 10))

    # User Stories
    story.append(Paragraph("User Stories", h2_style))

    user_stories = [
        ("US-001", "As a film director, I want to create a film project with target settings so that I can manage and track an autonomous production lifecycle.", [
            "Unique project ID is generated.",
            "Configuration metadata (title, aspect ratio 16:9 / 9:16, target duration) is captured.",
            "Project status initializes as DRAFT."
        ]),
        ("US-002", "As a screenwriter, I want the AI to generate a structured multi-shot script from my prompt so that I have scenes, visual descriptions, and dialogue planned.", [
            "Validates input prompt and optional reference attachments.",
            "Produces valid, structured JSON containing scene breakdowns, shot IDs, voiceover lines, and visual camera prompts.",
            "Script is rendered in an interactive viewer for inspection."
        ]),
        ("US-003", "As an art director, I want character reference sheets generated for named characters so that visual identity remains consistent across shots.", [
            "Extracts characters from the approved script.",
            "Generates high-fidelity character portraits with consistent stylistic prompts and seed attributes.",
            "Allows upload of custom user reference images per character."
        ]),
        ("US-004", "As a sound engineer, I want synchronized voiceover audio for each shot so that character dialogue and narration match the script timing.", [
            "Generates isolated audio tracks per shot using text-to-speech.",
            "Measures audio duration accurately to set minimum video shot lengths.",
            "Enables in-browser waveform playback and individual shot audio preview."
        ]),
        ("US-005", "As a cinematographer, I want fluid AI video clips rendered for each shot so that keyframe visuals and script actions come to life.", [
            "Dispatches keyframes and motion prompts to video generation models (Wan 2.2 / Gradio ZeroGPU pool).",
            "Enforces minimum duration (&ge; 3.0s) and framerate (&ge; 16 FPS) via automated FFprobe checks.",
            "Generates thumbnail previews and caches completed shot clips to disk."
        ]),
        ("US-006", "As a director, I want to approve or request changes on any stage or shot so that creative control and human judgment are preserved.", [
            "Explicit Approve and Request Changes review actions are required before advancing downstream stages.",
            "Rejection captures specific user feedback notes.",
            "Only rejected shots/assets are regenerated without discarding previously approved work."
        ]),
        ("US-007", "As an editor, I want all approved video clips and audio tracks stitched into a single master video so that the complete film can be reviewed and exported.", [
            "Synchronizes and concats all shot clips with corresponding audio tracks using FFmpeg.",
            "Handles audio normalization and aspect ratio conformity.",
            "Produces a downloadable final_film.mp4 and persists asset records in the database."
        ]),
    ]

    for us_id, role_want, criteria in user_stories:
        story_elements = [
            Paragraph(f"<b>{us_id}</b>", h3_style),
            Paragraph(role_want, body_style),
            Paragraph("<b>Acceptance criteria:</b>", ParagraphStyle('SubCrit', parent=body_style, fontName='Helvetica-Bold', fontSize=8, spaceBefore=2, spaceAfter=2))
        ]
        for crit in criteria:
            story_elements.append(Paragraph(f"&bull;&nbsp;&nbsp;{crit}", bullet_style))
        story_elements.append(Spacer(1, 4))
        story.append(KeepTogether(story_elements))

    story.append(Spacer(1, 6))

    # Product States
    story.append(Paragraph("Product States", h2_style))
    state_box = Table([[
        Paragraph(
            "<b>Workflow:</b> DRAFT &rarr; SCRIPT_GENERATED &rarr; SCRIPT_APPROVED &rarr; CHARACTERS_READY &rarr; VOICEOVER_READY &rarr; VIDEO_GENERATION &rarr; EDITING_ASSEMBLY &rarr; COMPLETED<br/>"
            "<font color='#DC2626'><b>Failure States:</b> GENERATION_FAILED, QUOTA_EXCEEDED</font>",
            state_style
        )
    ]], colWidths=[avail_width])
    state_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(state_box)
    story.append(Spacer(1, 10))

    # Product Principles
    story.append(Paragraph("Product Principles", h2_style))
    principles = [
        "<b>Human-in-the-loop:</b> No downstream stage executes without explicit human approval of upstream assets.",
        "<b>Targeted iteration over full regeneration:</b> Rejecting a shot only re-renders that shot, preserving all other approved assets.",
        "<b>Visual &amp; auditory consistency:</b> Character seeds, style references, and voice assignments persist across all scenes.",
        "<b>Resilient state caching:</b> Every completed shot is disk-cached immediately to survive API rate limits or network drops.",
        "<b>Traceability:</b> Every audio track, keyframe, and video clip is strictly mapped to its originating script shot ID."
    ]
    for princ in principles:
        story.append(Paragraph(f"&bull;&nbsp;&nbsp;{princ}", bullet_style))

    print(f"Generating Concise PRD PDF into {output_pdf_path}...")
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Concise PRD PDF successfully built! Size: {os.path.getsize(output_pdf_path)} bytes.")

if __name__ == '__main__':
    generate_concise_prd_pdf('CineForge_PRD_Formatted.pdf')

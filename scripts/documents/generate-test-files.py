from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

BLUE = "#2458C6"
INK = "#171A21"
MUTED = "#5E6470"
PALE = "#E9EFFF"
GREEN = "#2B8A5A"


def chart_png(path: Path) -> None:
    fig, ax = plt.subplots(figsize=(8.4, 3.2), dpi=160)
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    planned = [42, 51, 57, 66, 73, 82]
    actual = [39, 48, 61, 63, 78, 88]
    ax.plot(months, planned, color=BLUE, linewidth=2.6, marker="o", label="Plan")
    ax.plot(months, actual, color=GREEN, linewidth=2.6, marker="o", label="Actual")
    ax.fill_between(months, planned, actual, color="#DCE6FF", alpha=.65)
    ax.set_title("Throughput index", loc="left", fontsize=14, fontweight="bold")
    ax.set_ylabel("Indexed output")
    ax.grid(axis="y", color="#D9DCE3", linewidth=.8)
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.legend(frameon=False, ncol=2, loc="upper left")
    fig.tight_layout()
    fig.savefig(path, transparent=False, facecolor="white")
    plt.close(fig)


def workflow_png(path: Path) -> None:
    fig, ax = plt.subplots(figsize=(8.4, 3.0), dpi=160)
    ax.axis("off")
    labels = ["Intent", "Review", "Source", "Validate", "Deliver"]
    for index, label in enumerate(labels):
        x = .04 + index * .195
        color = BLUE if index in (0, 4) else "#FFFFFF"
        text_color = "white" if index in (0, 4) else INK
        ax.add_patch(
            plt.Rectangle((x, .38), .15, .24, transform=ax.transAxes,
                          facecolor=color, edgecolor=BLUE, linewidth=1.6)
        )
        ax.text(x + .075, .5, label, transform=ax.transAxes,
                ha="center", va="center", fontsize=10, fontweight="bold",
                color=text_color)
        if index < len(labels) - 1:
            ax.annotate("", xy=(x + .19, .5), xytext=(x + .153, .5),
                        xycoords=ax.transAxes,
                        arrowprops=dict(arrowstyle="->", color=MUTED, lw=1.5))
    ax.text(.04, .77, "Operating workflow", transform=ax.transAxes,
            fontsize=15, fontweight="bold", color=INK)
    ax.text(.04, .18, "Each handoff is explicit, reviewable, and reversible.",
            transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(path, facecolor="white")
    plt.close(fig)


def pdf_header(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor(INK))
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(.7 * inch, 10.45 * inch, "BOARDY DOCUMENT TEST PACK")
    canvas.setFillColor(colors.HexColor(MUTED))
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(7.8 * inch, .45 * inch, f"Page {doc.page}")
    canvas.restoreState()


def create_pdf(output: Path, chart: Path, workflow: Path) -> None:
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TestTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=30, leading=34, textColor=colors.HexColor(INK), spaceAfter=14))
    styles.add(ParagraphStyle(name="TestH1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=colors.HexColor(INK), spaceAfter=10))
    styles.add(ParagraphStyle(name="TestBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.5, leading=15, textColor=colors.HexColor(INK), spaceAfter=9))
    styles.add(ParagraphStyle(name="TestCallout", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=colors.HexColor(BLUE)))
    doc = BaseDocTemplate(str(output), pagesize=letter, leftMargin=.7*inch, rightMargin=.7*inch, topMargin=.75*inch, bottomMargin=.65*inch)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates(PageTemplate(id="test", frames=[frame], onPage=pdf_header))
    story = []
    story += [Spacer(1, .45*inch), Paragraph("Boardy Document Interaction Test", styles["TestTitle"]), Paragraph("A four page fixture for validating upload, multipage navigation, editing, annotation, revision history, and download behavior.", styles["TestBody"])]
    metrics = [["4", "3", "2", "1"], ["Pages", "File formats", "Visual systems", "Revision trail"]]
    table = Table(metrics, colWidths=[1.72*inch]*4, rowHeights=[.55*inch, .38*inch])
    table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor(PALE)), ("TEXTCOLOR", (0,0), (-1,0), colors.HexColor(BLUE)), ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"), ("FONTSIZE", (0,0), (-1,0), 22), ("ALIGN", (0,0), (-1,-1), "CENTER"), ("FONTNAME", (0,1), (-1,1), "Helvetica"), ("TEXTCOLOR", (0,1), (-1,1), colors.HexColor(MUTED)), ("GRID", (0,0), (-1,-1), .5, colors.HexColor("#CCD2DD")), ("VALIGN", (0,0), (-1,-1), "MIDDLE")]))
    story += [Spacer(1, .25*inch), table, Spacer(1, .35*inch), Paragraph("Testing objective", styles["TestH1"]), Paragraph("Insert this file on the canvas, double click it, add a comment and a visible edit, wait for autosave, then download the newest revision. The downloaded copy should preserve the change while the original revision remains available in history.", styles["TestBody"]), PageBreak()]
    story += [Paragraph("Workflow diagram", styles["TestH1"]), Paragraph("This page checks vector and raster rendering, wide visual scaling, and annotations placed over mixed content.", styles["TestBody"]), Image(str(workflow), width=7.05*inch, height=2.52*inch), Spacer(1, .2*inch)]
    risks = [["Checkpoint", "Expected interaction", "Pass condition"], ["Upload", "Select PDF DOCX or DOC", "Canvas element appears"], ["Activate", "Double click document", "Editor receives pointer input"], ["Annotate", "Draw or comment", "Mark is visible and saveable"], ["Download", "Export latest revision", "Correct filename and bytes"]]
    rt = Table(risks, colWidths=[1.25*inch, 2.65*inch, 3.15*inch], repeatRows=1)
    rt.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor(BLUE)), ("TEXTCOLOR", (0,0), (-1,0), colors.white), ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"), ("FONTNAME", (0,1), (-1,-1), "Helvetica"), ("FONTSIZE", (0,0), (-1,-1), 9), ("LEADING", (0,0), (-1,-1), 12), ("GRID", (0,0), (-1,-1), .5, colors.HexColor("#C8CDD7")), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#F7F8FA")]), ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8)]))
    story += [rt, PageBreak()]
    story += [Paragraph("Performance graph", styles["TestH1"]), Paragraph("A line chart with legend, labels, gridlines, and filled variance makes clipping and image degradation easy to spot.", styles["TestBody"]), Image(str(chart), width=7.05*inch, height=2.69*inch), Spacer(1, .18*inch), Paragraph("Interpretation", styles["TestH1"]), Paragraph("The illustrative series crosses twice and ends six points above plan. Values are synthetic and exist only to exercise chart rendering, not to make a business claim.", styles["TestBody"]), Paragraph("Annotation target: circle the final green point and write approved in the margin.", styles["TestCallout"]), PageBreak()]
    story += [Paragraph("Multipage acceptance checklist", styles["TestH1"]), Paragraph("Complete these checks in both Chrome and Safari. Repeat at desktop width and below 720 pixels.", styles["TestBody"])]
    checks = [["Check", "Chrome", "Safari"], ["All four pages render", "□", "□"], ["Text selection and zoom work", "□", "□"], ["Annotation persists after save", "□", "□"], ["New revision downloads", "□", "□"], ["Filename and format are correct", "□", "□"]]
    ct = Table(checks, colWidths=[4.6*inch, 1.2*inch, 1.2*inch], repeatRows=1)
    ct.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor(INK)), ("TEXTCOLOR", (0,0), (-1,0), colors.white), ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"), ("FONTNAME", (0,1), (-1,-1), "Helvetica"), ("ALIGN", (1,1), (-1,-1), "CENTER"), ("GRID", (0,0), (-1,-1), .6, colors.HexColor("#C8CDD7")), ("TOPPADDING", (0,0), (-1,-1), 11), ("BOTTOMPADDING", (0,0), (-1,-1), 11)]))
    story += [ct, Spacer(1, .35*inch), Paragraph("Expected save result", styles["TestH1"]), Paragraph("The newest revision should be downloadable without replacing the original. For legacy DOC, the edited result may be upgraded to DOCX and must be labeled accordingly.", styles["TestBody"])]
    doc.build(story)


def shade(cell, fill: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill.replace("#", ""))
    tc_pr.append(shd)


def create_docx(output: Path, chart: Path, workflow: Path) -> None:
    doc = Document()
    section = doc.sections[0]
    section.page_width, section.page_height = Inches(8.5), Inches(11)
    section.left_margin = section.right_margin = Inches(.7)
    section.top_margin, section.bottom_margin = Inches(.75), Inches(.65)
    styles = doc.styles
    styles["Normal"].font.name = "Arial"
    styles["Normal"].font.size = Pt(10.5)
    styles["Title"].font.name = "Arial"
    styles["Title"].font.size = Pt(30)
    styles["Title"].font.bold = True
    styles["Title"].font.color.rgb = RGBColor(0, 0, 0)
    title_ppr = styles["Title"]._element.get_or_add_pPr()
    title_border = title_ppr.find(qn("w:pBdr"))
    if title_border is not None:
        title_ppr.remove(title_border)
    for name, size in (("Heading 1", 20), ("Heading 2", 14)):
        styles[name].font.name = "Arial"
        styles[name].font.size = Pt(size)
        styles[name].font.bold = True
        styles[name].font.color.rgb = RGBColor(0, 0, 0)
    header = section.header.paragraphs[0]
    header.text = "BOARDY DOCUMENT TEST PACK"
    header.runs[0].font.size = Pt(8)
    header.runs[0].font.bold = True
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = footer.add_run("Boardy local fixture")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor(94, 100, 112)

    doc.add_paragraph("")
    doc.add_heading("Boardy Document Interaction Test", 0)
    doc.add_paragraph("A four page Word fixture for validating upload, multipage navigation, editing, comments, revision history, and format-preserving download behavior.")
    table = doc.add_table(rows=2, cols=4)
    table.style = "Table Grid"
    for i, value in enumerate(("4", "3", "2", "1")):
        table.cell(0, i).text = value
        shade(table.cell(0, i), PALE)
        table.cell(0, i).paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        table.cell(0, i).paragraphs[0].runs[0].font.size = Pt(22)
        table.cell(0, i).paragraphs[0].runs[0].font.bold = True
        table.cell(0, i).paragraphs[0].runs[0].font.color.rgb = RGBColor(36, 88, 198)
    for i, value in enumerate(("Pages", "File formats", "Visual systems", "Revision trail")):
        table.cell(1, i).text = value
        table.cell(1, i).paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_heading("Testing objective", level=1)
    doc.add_paragraph("Insert this file on the canvas, double click it, add a comment and a visible edit, wait for autosave, then download the newest revision. The downloaded copy should preserve the change while the original revision remains available in history.")

    doc.add_page_break()
    doc.add_heading("Workflow diagram", level=1)
    doc.add_paragraph("This page checks image rendering, wide visual scaling, text flow, and comments placed beside mixed content.")
    doc.add_picture(str(workflow), width=Inches(7.0))
    doc.add_heading("Interaction matrix", level=2)
    matrix = doc.add_table(rows=1, cols=3)
    matrix.style = "Table Grid"
    for cell, value in zip(matrix.rows[0].cells, ("Checkpoint", "Expected interaction", "Pass condition")):
        cell.text = value
        shade(cell, BLUE)
        cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(255,255,255)
        cell.paragraphs[0].runs[0].font.bold = True
    for row in (("Upload", "Select PDF DOCX or DOC", "Canvas element appears"), ("Activate", "Double click document", "Editor receives pointer input"), ("Annotate", "Draw or comment", "Mark is visible and saveable"), ("Download", "Export latest revision", "Correct filename and bytes")):
        cells = matrix.add_row().cells
        for cell, value in zip(cells, row):
            cell.text = value
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

    doc.add_page_break()
    doc.add_heading("Performance graph", level=1)
    doc.add_paragraph("A line chart with legend, labels, gridlines, and filled variance makes clipping and image degradation easy to spot.")
    doc.add_picture(str(chart), width=Inches(7.0))
    doc.add_heading("Interpretation", level=1)
    doc.add_paragraph("The illustrative series crosses twice and ends six points above plan. Values are synthetic and exist only to exercise chart rendering, not to make a business claim.")
    target = doc.add_paragraph("Annotation target: highlight the final green point and add the comment approved for test.")
    target.runs[0].font.bold = True
    target.runs[0].font.color.rgb = RGBColor(36, 88, 198)

    doc.add_page_break()
    doc.add_heading("Multipage acceptance checklist", level=1)
    doc.add_paragraph("Complete these checks in both Chrome and Safari. Repeat at desktop width and below 720 pixels.")
    checks = doc.add_table(rows=1, cols=3)
    checks.style = "Table Grid"
    for cell, value in zip(checks.rows[0].cells, ("Check", "Chrome", "Safari")):
        cell.text = value
        shade(cell, INK)
        cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(255,255,255)
        cell.paragraphs[0].runs[0].font.bold = True
    for row in ("All four pages render", "Text selection and zoom work", "Comment persists after save", "New revision downloads", "Filename and format are correct"):
        cells = checks.add_row().cells
        cells[0].text, cells[1].text, cells[2].text = row, "☐", "☐"
        cells[1].paragraphs[0].alignment = cells[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_heading("Expected save result", level=1)
    doc.add_paragraph("The newest revision should be downloadable without replacing the original. For legacy DOC, the edited result may be upgraded to DOCX and must be labeled accordingly.")
    doc.save(output)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", choices=["assets", "pdf", "docx"])
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    chart = args.output_dir / "throughput-chart.png"
    workflow = args.output_dir / "workflow-diagram.png"
    if args.kind == "assets":
        chart_png(chart)
        workflow_png(workflow)
    elif args.kind == "pdf":
        create_pdf(args.output_dir / "boardy-rich-multipage-test.pdf", chart, workflow)
    else:
        create_docx(args.output_dir / "boardy-rich-multipage-test.docx", chart, workflow)


if __name__ == "__main__":
    main()

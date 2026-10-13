#!/usr/bin/env python3
"""
GeekNook - Executive Competitor Analysis Word Document (.docx) Generator
Builds a beautifully styled, comprehensive OpenXML DOCX audit report for KUB (kubcase.ru).
Zero-dependency, pure Python standard library.
"""

import os
import sys
import shutil
import zipfile
import html
import subprocess

def escape_xml(text):
    if text is None:
        return ""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )

class DocxBuilder:
    def __init__(self):
        self.body_xml = []
        self.media_files = {} # rel_id -> (filename, binary_data)
        self.rel_counter = 10

    def add_p(self, text="", style=None, align=None, space_before=None, space_after=None, runs=None):
        """Add a paragraph with custom formatting and runs."""
        p_pr = []
        if style:
            p_pr.append(f'<w:pStyle w:val="{style}"/>')
        if align:
            p_pr.append(f'<w:jc w:val="{align}"/>')
        
        spacing = []
        if space_before is not None:
            spacing.append(f'w:before="{space_before}"')
        if space_after is not None:
            spacing.append(f'w:after="{space_after}"')
        if spacing:
            p_pr.append(f'<w:spacing {" ".join(spacing)}/>')

        p_pr_xml = f"<w:pPr>{''.join(p_pr)}</w:pPr>" if p_pr else ""

        if runs is None:
            if text:
                runs = [(text, {})]
            else:
                runs = []

        runs_xml = []
        for r_text, r_props in runs:
            r_pr = []
            if r_props.get("bold"):
                r_pr.append("<w:b/>")
            if r_props.get("italic"):
                r_pr.append("<w:i/>")
            if r_props.get("color"):
                r_pr.append(f'<w:color w:val="{r_props["color"]}"/>')
            if r_props.get("size"):
                r_pr.append(f'<w:sz w:val="{r_props["size"]}"/>')
            if r_props.get("font"):
                r_pr.append(f'<w:rFonts w:ascii="{r_props["font"]}" w:hAnsi="{r_props["font"]}"/>')
            
            r_pr_xml = f"<w:rPr>{''.join(r_pr)}</w:rPr>" if r_pr else ""
            escaped_text = escape_xml(r_text)
            runs_xml.append(f'<w:r>{r_pr_xml}<w:t xml:space="preserve">{escaped_text}</w:t></w:r>')

        self.body_xml.append(f"<w:p>{p_pr_xml}{''.join(runs_xml)}</w:p>")

    def add_heading_1(self, text):
        self.add_p(
            runs=[(text, {"bold": True, "size": 32, "color": "0F172A", "font": "Calibri"})],
            space_before=360,
            space_after=140
        )

    def add_heading_2(self, text):
        self.add_p(
            runs=[(text, {"bold": True, "size": 26, "color": "1E3A8A", "font": "Calibri"})],
            space_before=240,
            space_after=100
        )

    def add_heading_3(self, text):
        self.add_p(
            runs=[(text, {"bold": True, "size": 22, "color": "334155", "font": "Calibri"})],
            space_before=180,
            space_after=60
        )

    def add_paragraph(self, text, bold_prefix=None, space_after=120):
        runs = []
        if bold_prefix:
            runs.append((bold_prefix, {"bold": True, "color": "0F172A"}))
        runs.append((text, {"color": "1E293B"}))
        self.add_p(runs=runs, space_after=space_after)

    def add_bullet(self, text, bold_prefix=None):
        runs = []
        runs.append(("•  ", {"bold": True, "color": "2563EB"}))
        if bold_prefix:
            runs.append((bold_prefix, {"bold": True, "color": "0F172A"}))
        runs.append((text, {"color": "1E293B"}))
        
        # custom left indent for bullet
        p_pr = '<w:pPr><w:ind w:left="400" w:hanging="240"/><w:spacing w:after="80"/></w:pPr>'
        runs_xml = []
        for r_text, r_props in runs:
            r_pr = []
            if r_props.get("bold"):
                r_pr.append("<w:b/>")
            if r_props.get("color"):
                r_pr.append(f'<w:color w:val="{r_props["color"]}"/>')
            r_pr_xml = f"<w:rPr>{''.join(r_pr)}</w:rPr>" if r_pr else ""
            runs_xml.append(f'<w:r>{r_pr_xml}<w:t xml:space="preserve">{escape_xml(r_text)}</w:t></w:r>')
        self.body_xml.append(f"<w:p>{p_pr}{''.join(runs_xml)}</w:p>")

    def add_callout(self, text, title=None, border_color="2563EB", bg_color="F8FAFC"):
        """Callout box using a single-cell table with styled left border."""
        cell_xml = []
        if title:
            cell_xml.append(f'<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="{border_color}"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{escape_xml(title)}</w:t></w:r></w:p>')
        
        # Split lines if needed
        for line in text.strip().split("\n"):
            cell_xml.append(f'<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="334155"/><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">{escape_xml(line)}</w:t></w:r></w:p>')

        table_xml = f"""
        <w:tbl>
          <w:tblPr>
            <w:tblW w:w="9200" w:type="dxa"/>
            <w:jc w:val="center"/>
            <w:tblBorders>
              <w:top w:val="none"/>
              <w:left w:val="single" w:sz="36" w:space="0" w:color="{border_color}"/>
              <w:bottom w:val="none"/>
              <w:right w:val="none"/>
            </w:tblBorders>
            <w:tblCellMar>
              <w:top w:w="160" w:type="dxa"/>
              <w:left w:w="240" w:type="dxa"/>
              <w:bottom w:w="160" w:type="dxa"/>
              <w:right w:w="240" w:type="dxa"/>
            </w:tblCellMar>
          </w:tblPr>
          <w:tblGrid><w:gridCol w:w="9200"/></w:tblGrid>
          <w:tr>
            <w:tc>
              <w:tcPr>
                <w:tcW w:w="9200" w:type="dxa"/>
                <w:shd w:val="clear" w:color="auto" w:fill="{bg_color}"/>
              </w:tcPr>
              {''.join(cell_xml)}
            </w:tc>
          </w:tr>
        </w:tbl>
        <w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>
        """
        self.body_xml.append(table_xml)

    def add_table(self, headers, rows, col_widths=None, header_bg="0F172A", alt_bg="F8FAFC"):
        """Multi-column styled table with dark header, zebra rows and borders."""
        num_cols = len(headers)
        total_w = 9200
        if not col_widths:
            col_widths = [total_w // num_cols] * num_cols
            col_widths[-1] = total_w - sum(col_widths[:-1])

        grid_cols = "".join([f'<w:gridCol w:w="{w}"/>' for w in col_widths])

        header_cells = []
        for i, h in enumerate(headers):
            w = col_widths[i]
            cell = f"""
            <w:tc>
              <w:tcPr>
                <w:tcW w:w="{w}" w:type="dxa"/>
                <w:shd w:val="clear" w:color="auto" w:fill="{header_bg}"/>
                <w:tcMar><w:top w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar>
              </w:tcPr>
              <w:p>
                <w:pPr><w:spacing w:after="0"/></w:pPr>
                <w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{escape_xml(h)}</w:t></w:r>
              </w:p>
            </w:tc>
            """
            header_cells.append(cell)

        header_tr = f'<w:tr><w:trPr><w:tblHeader/></w:trPr>{"".join(header_cells)}</w:tr>'

        row_trs = []
        for r_idx, row in enumerate(rows):
            fill = alt_bg if (r_idx % 2 == 1) else "FFFFFF"
            cells = []
            for c_idx, val in enumerate(row):
                w = col_widths[c_idx]
                is_bold = (c_idx == 0 and len(headers) > 2) # subtle highlight for first col
                cell = f"""
                <w:tc>
                  <w:tcPr>
                    <w:tcW w:w="{w}" w:type="dxa"/>
                    <w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>
                    <w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar>
                  </w:tcPr>
                  <w:p>
                    <w:pPr><w:spacing w:after="0"/></w:pPr>
                    <w:r><w:rPr>{'<w:b/>' if is_bold else ''}<w:color w:val="1E293B"/><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">{escape_xml(val)}</w:t></w:r>
                  </w:p>
                </w:tc>
                """
                cells.append(cell)
            row_trs.append(f'<w:tr>{"".join(cells)}</w:tr>')

        table_xml = f"""
        <w:tbl>
          <w:tblPr>
            <w:tblW w:w="{total_w}" w:type="dxa"/>
            <w:jc w:val="center"/>
            <w:tblBorders>
              <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
              <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
              <w:bottom w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>
              <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
              <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
              <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
            </w:tblBorders>
          </w:tblPr>
          <w:tblGrid>{grid_cols}</w:tblGrid>
          {header_tr}
          {''.join(row_trs)}
        </w:tbl>
        <w:p><w:pPr><w:spacing w:after="140"/></w:pPr></w:p>
        """
        self.body_xml.append(table_xml)

    def add_kpi_cards(self, cards):
        """Add 4 KPI summary highlight boxes side-by-side."""
        # cards: list of (value, label, subtext, color)
        num = len(cards)
        total_w = 9200
        col_w = total_w // num
        
        cells = []
        for val, label, subtext, col_accent in cards:
            cell = f"""
            <w:tc>
              <w:tcPr>
                <w:tcW w:w="{col_w}" w:type="dxa"/>
                <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
                <w:tcBorders>
                  <w:top w:val="single" w:sz="24" w:space="0" w:color="{col_accent}"/>
                  <w:left w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                  <w:bottom w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                  <w:right w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                </w:tcBorders>
                <w:tcMar><w:top w:w="140" w:type="dxa"/><w:bottom w:w="140" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar>
              </w:tcPr>
              <w:p>
                <w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
                <w:r><w:rPr><w:b/><w:color w:val="{col_accent}"/><w:sz w:val="32"/></w:rPr><w:t xml:space="preserve">{escape_xml(val)}</w:t></w:r>
              </w:p>
              <w:p>
                <w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr>
                <w:r><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">{escape_xml(label)}</w:t></w:r>
              </w:p>
              <w:p>
                <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
                <w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="15"/></w:rPr><w:t xml:space="preserve">{escape_xml(subtext)}</w:t></w:r>
              </w:p>
            </w:tc>
            """
            cells.append(cell)

        tbl = f"""
        <w:tbl>
          <w:tblPr>
            <w:tblW w:w="{total_w}" w:type="dxa"/>
            <w:jc w:val="center"/>
            <w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tblBorders>
          </w:tblPr>
          <w:tblGrid>{''.join([f'<w:gridCol w:w="{col_w}"/>' for _ in range(num)])}</w:tblGrid>
          <w:tr>{''.join(cells)}</w:tr>
        </w:tbl>
        <w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>
        """
        self.body_xml.append(tbl)

    def add_image(self, img_path, caption=None, width_inch=3.5, height_inch=7.0):
        if not os.path.exists(img_path):
            return
        
        with open(img_path, "rb") as f:
            data = f.read()

        rel_id = f"rIdImg{self.rel_counter}"
        filename = f"image_{self.rel_counter}.png"
        self.rel_counter += 1
        self.media_files[rel_id] = (filename, data)

        cx = int(width_inch * 914400)
        cy = int(height_inch * 914400)

        drawing_xml = f"""
        <w:p>
          <w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="60"/></w:pPr>
          <w:r>
            <w:drawing>
              <wp:inline distT="0" distB="0" distL="0" distR="0">
                <wp:extent cx="{cx}" cy="{cy}"/>
                <wp:effectExtent l="0" t="0" r="0" b="0"/>
                <wp:docPr id="{self.rel_counter}" name="{escape_xml(filename)}"/>
                <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
                <a:graphic>
                  <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:pic>
                      <pic:nvPicPr>
                        <pic:cNvPr id="{self.rel_counter}" name="{escape_xml(filename)}"/>
                        <pic:cNvPicPr/>
                      </pic:nvPicPr>
                      <pic:blipFill>
                        <a:blip r:embed="{rel_id}"/>
                        <a:stretch><a:fillRect/></a:stretch>
                      </pic:blipFill>
                      <pic:spPr>
                        <a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>
                        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                      </pic:spPr>
                    </pic:pic>
                  </a:graphicData>
                </a:graphic>
              </wp:inline>
            </w:drawing>
          </w:r>
        </w:p>
        """
        self.body_xml.append(drawing_xml)

        if caption:
            self.add_p(
                runs=[(caption, {"italic": True, "size": 18, "color": "64748B"})],
                align="center",
                space_after=140
            )

    def add_page_break(self):
        self.body_xml.append('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')

    def build_docx(self, output_path):
        content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>"""

        rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

        doc_rels_items = [
            '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
            '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>',
            '<Relationship Id="rIdHeader1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>',
            '<Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
        ]
        for rel_id, (fname, _) in self.media_files.items():
            doc_rels_items.append(f'<Relationship Id="{rel_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/{fname}"/>')

        doc_rels = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  {''.join(doc_rels_items)}
</Relationships>"""

        settings = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
  <w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
</w:settings>"""

        header1 = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="94A3B8"/><w:sz w:val="17"/></w:rPr>
      <w:t>GeekNook Strategic Intelligence | Аудит конкурента: KUB (kubcase.ru)</w:t>
    </w:r>
  </w:p>
</w:hdr>"""

        footer1 = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="94A3B8"/><w:sz w:val="17"/></w:rPr>
      <w:t>Страница </w:t>
    </w:r>
    <w:fldSimple w:instr="PAGE"/>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="94A3B8"/><w:sz w:val="17"/></w:rPr>
      <w:t> из </w:t>
    </w:r>
    <w:fldSimple w:instr="NUMPAGES"/>
  </w:p>
</w:ftr>"""

        styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="21"/>
        <w:color w:val="1E293B"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="276" w:lineRule="auto" w:after="120"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>"""

        sect_pr = """
        <w:sectPr>
          <w:headerReference w:type="default" r:id="rIdHeader1"/>
          <w:footerReference w:type="default" r:id="rIdFooter1"/>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200"/>
        </w:sectPr>
        """

        document = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    {''.join(self.body_xml)}
    {sect_pr}
  </w:body>
</w:document>"""

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("[Content_Types].xml", content_types)
            z.writestr("_rels/.rels", rels)
            z.writestr("word/_rels/document.xml.rels", doc_rels)
            z.writestr("word/settings.xml", settings)
            z.writestr("word/header1.xml", header1)
            z.writestr("word/footer1.xml", footer1)
            z.writestr("word/styles.xml", styles)
            z.writestr("word/document.xml", document)
            for _, (fname, data) in self.media_files.items():
                z.writestr(f"word/media/{fname}", data)

        print(f"✅ Generated Word document: {output_path} ({os.path.getsize(output_path):,} bytes)")


def generate_full_report(output_file):
    b = DocxBuilder()

    # --- COVER / TITLE BANNER ---
    b.add_p(
        runs=[("GEEKNOOK STRATEGIC INTELLIGENCE", {"bold": True, "size": 20, "color": "2563EB"})],
        space_before=100,
        space_after=80
    )
    b.add_p(
        runs=[("КОМПЛЕКСНЫЙ АНАЛИТИЧЕСКИЙ АУДИТ И КОНКУРЕНТНЫЙ АНАЛИЗ", {"bold": True, "size": 36, "color": "0F172A"})],
        space_after=80
    )
    b.add_p(
        runs=[("Исследование бренда KUB (kubcase.ru): экономика Ozon, поисковое SEO, веб-UX/UI и точки роста GeekNook", {"size": 24, "color": "475569"})],
        space_after=200
    )

    # Metadata Table
    meta_headers = ["Параметр", "Значение"]
    meta_rows = [
        ["Целевая аудитория", "Руководство и продуктовая команда GeekNook"],
        ["Объект анализа", "Бренд KUB (KUB Cases | Accessories, сайт kubcase.ru, магазин Ozon)"],
        ["Дата среза данных", "13 октября 2026 г. (выгрузка Ozon Seller Analytics от 07.10.2026 за 28 дней)"],
        ["Источники данных", "Ozon Analytics (analytics_report_2026-10-07_13_11.xlsx), аудит kubcase.ru, ЕГРИП, рецензия фаундера"],
        ["Статус документа", "Утвержденный аналитический отчет"]
    ]
    b.add_table(meta_headers, meta_rows, col_widths=[2800, 6400], header_bg="1E293B")

    # --- KPI CARDS ---
    b.add_heading_2("Ключевые показатели конкурента (28-дневный срез)")
    b.add_kpi_cards([
        ("286 448 ₽", "ФАКТИЧЕСКАЯ ВЫРУЧКА", "66 заказов за 28 дней на Ozon", "2563EB"),
        ("489 105 ₽", "УПУЩЕННАЯ ВЫРУЧКА", "170.7% потерь из-за дефицита!", "DC2626"),
        ("100% FBS", "СХЕМА ОТГРУЗОК", "Склад Самара, 0 поставок FBO", "D97706"),
        ("96.5%", "ПОДСТАВКИ ДЛЯ МОНИТОРА", "Доля полок во всех потерях продаж", "059669")
    ])

    # --- SECTION 1 ---
    b.add_heading_1("1. Оцифровка аудио-аудита фаундера: UX/UI, типографика и продукт")
    
    founder_quote = (
        "«Потому что опять же, честно говоря, сайт мне не нравится... У них блядски ужасный шрифт, "
        "отвратительно сделаны блоки, все как-то слишком простенько. Посередине сайта сделан коллаж: "
        "подставки, лотки, столы... и там все висит в углу, на белом фоне белый текст. В блоке «Новые поступления» "
        "текст начинается прямо с края экрана, как будто обрезан. В карточке товара 5 параметров и описание иишное. "
        "Но фотографии у них сделаны хорошо, вот это многое решает... Бесплатная доставка от 5000 руб. "
        "В остальном максимально просто...»"
    )
    b.add_callout(founder_quote, title="Стенограмма аудио-рецензии фаундера GeekNook", border_color="D97706", bg_color="FFFBEB")

    b.add_heading_2("1.1. Типографика и визуальный стиль")
    b.add_paragraph("На сайте kubcase.ru подключены стандартные Google Fonts: Poppins (веса 400 и 600 для заголовков и текстов) и Roboto (веса 300 и 500 для кнопок и меню). В кириллической адаптации Poppins выглядит неестественно и дешево, создавая ощущение шаблонного лендинга низкого ценового сегмента, а не авторской мастерской премиального дерева и стали.")
    b.add_bullet("Отсутствие брендовой шрифтовой пары: нет выразительного гротеска или моноширинных акцентов, подчеркивающих точность фрезеровки и металлообработки.", "Шрифтовой дисбаланс: ")
    b.add_bullet("Использование стокового шаблона Astra Theme с раздутым визуальным билдером Elementor Pro.", "Шаблонность: ")

    b.add_heading_2("1.2. Грубые дефекты верстки и композиции")
    b.add_bullet("Шесть категорий (подставки для монитора, лотки для хранения, столы, стойки для наушников, модули, подставки для телефона) скомпонованы в плиточный коллаж. Текстовые плашки прижаты к углам изображений, а белый шрифт наложен на светлый фон фотоматериалов без затемняющего градиента (overlay). В результате надписи сливаются с фоном и становятся нечитаемыми.", "Коллаж категорий в центре страницы: ")
    b.add_bullet("На мобильных и планшетных разрешениях заголовок и левый товар начинаются с нулевым отступом (padding-left: 0), создавая эффект технического бага или обрезанного экрана.", "Блок «Новые поступления»: ")

    b.add_heading_2("1.3. Карточка товара (PDP) и контентная бедность")
    b.add_paragraph("Карточка товара KUB страдает от информационного вакуума. В ней отсутствуют инженерные чертежи, видеоролики сборки, схемы скрытого кабель-менеджмента, сертификаты древесины и подтвержденные отзывы покупателей.")
    b.add_paragraph("Блок характеристик урезан всего до 5 шаблонных параметров:")
    b.add_bullet("4 000 – 4 500 г", "1. Вес: ")
    b.add_bullet("110 × 22 × 12 см (Large), 80 × 22 × 12 см (Medium)", "2. Габариты: ")
    b.add_bullet("Черный дуб, Темный дуб, Светлый орех, Натуральный", "3. Цвета дерева: ")
    b.add_bullet("Сталь, массив дерева (дуб/ясень)", "4. Материалы: ")
    b.add_bullet("до 70 кг", "5. Максимальная нагрузка: ")
    b.add_paragraph("Описания товаров очевидно сгенерированы нейросетью с набором шаблонных фраз («природная эстетика сочетается с премиальной функциональностью», «масло Osmo»), но не дают ответов на практические вопросы: устойчивость к прогибу столешницы, совместимость с тяжелыми струбцинами кронштейнов Ergotron/North Bayou и глубина пазов.")

    b.add_heading_2("1.4. Сильная сторона KUB — Предметная фотосъемка")
    b.add_paragraph("Единственное и главное преимущество KUB, обеспечивающее им продажи — это качественные предметные интерьерные фотосессии. Студийный мягкий свет, глубокая фактура натурального дуба, гармоничная интеграция в реальные сетапы с техникой Apple (Studio Display, MacBook, клавиатуры Keychron).")
    b.add_callout(
        "Вывод для GeekNook: Именно визуальный ряд фотографий KUB продает товар при слабом сайте и скупом описании. Для GeekNook первоочередной задачей становится инвестиция в интерьерную предметную фотосъемку готовых рабочих мест либо создание фотореалистичных 3D-рендеров высочайшего разрешения.",
        title="КРИТИЧЕСКИЙ ВЫВОД ПО КОНТЕНТУ",
        border_color="059669",
        bg_color="F0FDF4"
    )

    # --- SECTION 2 ---
    b.add_page_break()
    b.add_heading_1("2. Профиль компании, контакты и юридическая структура KUB")
    b.add_paragraph("На основе анализа публичной оферты, сайта kubcase.ru и верификации по базам ФНС/ЕГРИП восстановлен полный юридический и физический профиль конкурента:")

    profile_headers = ["Параметр", "Данные конкурента KUB"]
    profile_rows = [
        ["Торговая марка", "KUB / KUB Cases | Accessories (kubcase.ru)"],
        ["Юридическое лицо", "Индивидуальный предприниматель Кубасов Роман Евгеньевич"],
        ["ИНН", "631704429097"],
        ["ОГРНИП", "321631200041442 (зарегистрирован 26.08.2021 МИФНС №24 по Самарской области)"],
        ["Основной ОКВЭД", "25.99 («Производство прочих готовых металлических изделий») — собственное металлопроизводство"],
        ["Адрес производства и склада", "443069, Россия, Самарская область, г. Самара, ул. Авроры, д. 110, корп. 6"],
        ["Телефон поддержки (СПб)", "8 (812) 800-48-05 (указан в футере, договоре оферты и блоке доставки)"],
        ["Телефон прямой (Самара)", "8 (919) 808-48-05 (выводится в шапке сайта)"],
        ["Клиентский Email", "info@kubcase.ru"],
        ["График работы поддержки", "Пн–Пт: 09:00 – 18:00 МСК, Сб–Вс: 10:00 – 14:00 МСК (в шапке указано с 08:00)"],
        ["Присутствие в медиа", "VK: vk.com/kubcase | Pinterest: kubcase | Instagram: @kubcase.ru | TikTok: @kubcase"],
        ["Магазин на Ozon", "KUB (ID продавца: KUB, 27 активных SKU, схема FBS Самара)"]
    ]
    b.add_table(profile_headers, profile_rows, col_widths=[2800, 6400], header_bg="0F172A")

    # --- SECTION 3 ---
    b.add_heading_1("3. Условия оплаты и логистика доставки")
    b.add_paragraph("Исследование раздела «Оплата и Доставка», шлюза корзины и прикрепленного скриншота позволило зафиксировать правила клиентского сервиса KUB:")

    b.add_heading_2("3.1. Платежные методы и финансовые шлюзы")
    b.add_bullet("Подключен шлюз Robokassa с поддержкой банковских карт МИР, Visa, Mastercard, Maestro.", "Эквайринг: ")
    b.add_bullet("Подключен модуль BNPL «Подели» (оплата четырьмя равными долями без переплат).", "Оплата долями: ")
    b.add_bullet("В футере выведен логотип карты рассрочки «Халва» и кнопка Yandex Pay.", "Рассрочка и кошельки: ")
    b.add_bullet("В списке способов оплаты и футере до сих пор отображаются Apple Pay и Google Pay, которые не работают с картами РФ, что снижает доверие пользователей.", "Устаревшие элементы: ")
    b.add_bullet("Строгая 100% предоплата на сайте. Отправка наложенным платежом категорически исключена.", "Ключевое правило: ")

    b.add_heading_2("3.2. География и тарифы доставки")
    b.add_bullet("СДЭК, Почта России, Boxberry.", "Логистические партнеры: ")
    b.add_bullet("Бесплатно при заказе от 4 900 ₽ (СДЭК до пункта выдачи ПВЗ). До 4 900 ₽ — платно по тарифам СДЭК.", "Доставка по всей России: ")
    b.add_bullet("Бесплатно при заказе от 8 900 ₽ (СДЭК до ПВЗ).", "Казахстан, Кыргызстан, Беларусь: ")
    b.add_bullet("Только платная доставка курьером или до ПВЗ СДЭК.", "Узбекистан: ")
    b.add_bullet("Бесплатный самовывоз со склада (Самара, ул. Авроры, 110к6) или доставка собственным курьером KUB.", "Доставка по г. Самара: ")
    b.add_bullet("Клиенту выдается трек-номер отправления, на сайте есть внутренняя страница проверки /otsledit-zakaz/.", "Трекинг: ")

    b.add_heading_2("3.3. Визуальное подтверждение: Скриншот страницы KUB")
    img_path = "/Users/sergejzatovka/.gemini/antigravity/brain/7292da22-d4dd-43a6-b710-07c4cf4f5933/.user_uploaded/media_1791879849821_6b32b038.png"
    b.add_image(
        img_path,
        caption="Рис. 1. Страница «Оплата и Доставка» и футер с контактами на сайте kubcase.ru (исходный скриншот аудита)",
        width_inch=3.2,
        height_inch=6.5
    )

    # --- SECTION 4 ---
    b.add_page_break()
    b.add_heading_1("4. Поисковое SEO и технический аудит сайта kubcase.ru")
    b.add_paragraph("Глубокий технический парсинг сайта, анализ sitemap_index.xml, robots.txt и метатегов выявил фундаментальные ошибки продвижения конкурента:")

    b.add_heading_2("4.1. Архитектура и вес страницы")
    b.add_paragraph("Сайт функционирует на связке WordPress 6.x + WooCommerce + Astra Theme + Elementor Pro + WooLentor. Главная страница весит более 1 014 КБ чистого HTML с тысячами строк инлайн-стилей Elementor, что приводит к критическому ухудшению Core Web Vitals (FCP, LCP, CLS) и потере позиций в мобильной выдаче Google.")

    b.add_heading_2("4.2. Грубейшие ошибки SEO (Зоны легкой победы для GeekNook)")
    b.add_bullet("Тег <title> главной страницы: «KUB Cases | Accessories – интернет-магазин компьютерных корпусов и аксессуаров». Метатег <meta name=\"description\">: «Купить компьютерные корпуса по выгодным ценам от производителя KUB...». Конкурент полностью переключился на настольные органайзеры и полки из дуба, но забыл обновить базовые метатеги! Сайт абсолютно не ранжируется по высокочастотным коммерческим запросам («подставка для монитора дуб», «настольная полка для сетапа», «desk shelf массив дуба»).", "1. Катастрофический семантический рассинхрон (Intent Mismatch): ")
    b.add_bullet("Вместо единой вариативной карточки товара с выбором цвета и размера в WooCommerce созданы десятки дублей со сгенерированными слагами: lotok-dlya-hraneniya-large-2, -3, -4; derzhatel-dlya-magsafe-2, -3, -4; kovrik-nastolnyj-2. Это распыляет ссылочный вес и ведет к взаимной каннибализации в Яндексе.", "2. Каннибализация URL и мусорные карточки: ")
    b.add_bullet("В открытой карте сайта sitemap_index.xml проиндексированы технические шаблоны elementskit_content-sitemap.xml, а в product-sitemap.xml отдаются закрытые страницы индивидуальных заказов клиентов: /shop/individualnyj-zakaz-№489/, №490, №491.", "3. Засорение поискового индекса (Sitemap): ")
    b.add_bullet("Ссылка на страницу политики конфиденциальности в футере отдает ошибку HTTP 404 Not Found, что является нарушением 152-ФЗ и понижающим фактором ранжирования Яндекса.", "4. Битая ссылка на юридические документы: ")

    # --- SECTION 5 ---
    b.add_page_break()
    b.add_heading_1("5. Анализ воронки продаж и спроса Ozon (analytics_report_2026-10-07_13_11.xlsx)")
    
    b.add_paragraph("Проведен аудит выгрузки Ozon Seller Analytics за 28 дней (09.09.2026 – 07.10.2026). Установлено, что в строке 33 отчета находится сторонний товар («Горшок-унитаз детский Miyoumi», селлер «Инь УО», схема FBO), ошибочно попавший в бренд KUB. После очистки данных получены точные цифры бизнеса KUB:")

    # Ozon Funnel Table
    ozon_headers = ["Метрика воронки Ozon", "Значение KUB", "Аналитический контекст"]
    ozon_rows = [
        ["Активный ассортимент", "27 SKU", "100% продаются исключительно по схеме FBS из Самары"],
        ["Фактическая выручка", "286 448,00 ₽", "66 завершенных заказов за 28 дней"],
        ["Упущенная выручка (Lost Sales)", "489 105,00 ₽", "170.7% от реального объема продаж! Катастрофа дефицита"],
        ["Средний чек позиции", "3 854,00 ₽", "От 1 215 ₽ (держатели) до 11 576 ₽ (подставки под 2 монитора)"],
        ["Показы в выдаче Ozon", "109 704", "Органический и рекламный охват поисковой выдачи"],
        ["Просмотры в каталоге", "22 707", "CTR Показ → Каталог: 20.70% (высокая кликабельность)"],
        ["Переходы в карточку (PDP)", "7 150", "CTR Каталог → Карточка: 31.49% (конверсия за счет фото)"],
        ["Конверсия в корзину из поиска", "0.91%", "Покупка без глубокого изучения карточки"],
        ["Конверсия в корзину из карточки", "3.29%", "В 3.6 раза выше, чем из поиска (влияние качественных фото)"],
        ["Конверсия из карточки в заказ", "0.92%", "66 заказов на 7 150 визитов"],
        ["Сквозная конверсия (CR)", "0.0602%", "66 заказов на 109.7 тыс. показов"],
        ["Процент выкупа (Buyout Rate)", "80 – 100%", "На деревянные подставки выкуп составляет 100%"]
    ]
    b.add_table(ozon_headers, ozon_rows, col_widths=[2800, 2200, 4200], header_bg="1E293B")

    b.add_heading_2("5.1. Главная уязвимость KUB: Хронический дефицит (Out-of-Stock)")
    b.add_paragraph("Все 27 товаров KUB имели статус 28 из 28 дней без остатка на складах Ozon FBO. Продажи идут только по FBS. На конец периода 14 из 27 SKU имели нулевой физический остаток на складе Самары. Конкурент теряет почти 0.5 млн рублей в месяц на неспособности обеспечить спрос:")

    lost_headers = ["Артикул / Наименование", "Факт продаж", "Упущенная выручка", "Дней без остатка"]
    lost_rows = [
        ["KUB Подставка Large, натуральный (стр. 13)", "11 473 ₽ (1 шт)", "309 771 ₽", "28 из 28 дней"],
        ["KUB Подставка 2 монитора, темный дуб (стр. 7)", "69 841 ₽ (7 шт)", "93 121 ₽", "28 из 28 дней"],
        ["KUB Подставка Medium, темный дуб (стр. 14)", "7 887 ₽ (1 шт)", "23 659 ₽", "28 из 28 дней"],
        ["KUB Подставка монитор/ноутбук, орех (стр. 9)", "32 310 ₽ (5 шт)", "15 304 ₽", "28 из 28 дней"],
        ["KUB Подставка 2 монитора, орех (стр. 10)", "26 329 ₽ (3 шт)", "14 627 ₽", "28 из 28 дней"]
    ]
    b.add_table(lost_headers, lost_rows, col_widths=[4000, 1800, 2000, 1400], header_bg="B91C1C")

    b.add_heading_2("5.2. Структура выручки и потерь по категориям")
    cat_headers = ["Категория товара", "Выручка факт", "Доля %", "Упущенная выручка"]
    cat_rows = [
        ["1. Подставки под монитор", "186 355 ₽", "65.1%", "471 880 ₽ (96.5% всех потерь!)"],
        ["2. Дополнительные полки", "39 149 ₽", "13.7%", "3 659 ₽"],
        ["3. Органайзеры и лотки", "16 298 ₽", "5.7%", "3 930 ₽"],
        ["4. Держатели телефонов", "13 406 ₽", "4.7%", "5 053 ₽"],
        ["5. Подставки для наушников", "9 674 ₽", "3.4%", "510 ₽"],
        ["6. Держатели Apple Watch", "7 268 ₽", "2.5%", "0 ₽"],
        ["7. Канцелярские органайзеры", "6 570 ₽", "2.3%", "4 073 ₽"],
        ["8. Держатели ноутбука", "3 217 ₽", "1.1%", "0 ₽"],
        ["9. Держатели планшета", "2 719 ₽", "0.9%", "0 ₽"],
        ["10. Кронштейны и упоры", "1 792 ₽", "0.6%", "0 ₽"]
    ]
    b.add_table(cat_headers, cat_rows, col_widths=[3400, 1800, 1400, 2600], header_bg="0F172A")

    b.add_heading_2("5.3. Анализ рекламного продвижения и акций")
    b.add_bullet("KUB использует инструмент «Трафареты Ozon» всего для 3 товаров. При этом на флагманскую подставку для двух мониторов (темный дуб) ДРР составляет всего 1.9%, а на светлый орех — 13.5%. Это доказывает сверхвысокую рентабельность ниши и готовность покупателей платить за премиальные подставки.", "Рекламные каналы (Трафареты): ")
    b.add_bullet("18 из 27 товаров продаются с акционными скидками маркетплейса (от 13 до 28 дней из 28). По сопутствующим модулям 100% продаж совершены со скидкой.", "Зависимость от промо-акций: ")

    # --- SECTION 6 ---
    b.add_page_break()
    b.add_heading_1("6. Стратегическая матрица «KUB vs GeekNook» и план действий")
    b.add_paragraph("На основе выявленных уязвимостей KUB сформирована дорожная карта опережения конкурента:")

    strat_headers = ["Направление", "Слабые стороны KUB", "Преимущество и план GeekNook"]
    strat_rows = [
        [
            "Логистика и склады",
            "100% FBS из Самары (срок 3–6 дней). Потери 489 тыс. ₽/мес на хроническом дефиците остатков.",
            "Экспансия FBO в Москве: отгрузить партии подставок на склады Ozon/WB в Коледино/Хоругвино со сроком «завтра». Забрать упущенный спрос KUB в 0.5 млн ₽."
        ],
        [
            "Визуальный контент",
            "Высококлассные предметные интерьерные фото, продающие товар за счет эстетики.",
            "Зона первоочередных инвестиций: организовать профессиональную предметную съемку готовых сетапов с мониторами, кастомными клавиатурами и подсветкой."
        ],
        [
            "Глубина карточки",
            "5 строк параметров, AI-текст, нет чертежей, нет тестов на прочность и кабель-менеджмента.",
            "Инженерный авторитет: внедрить 3D-конфигуратор, расчет FEA-нагрузок до 80+ кг, калькулятор эргономики ISO 9241-5 и систему скрытой проводки."
        ],
        [
            "Поисковое SEO",
            "Забытые метатеги «компьютерные корпуса», каннибализация URL, битые ссылки 404.",
            "Захват органики: собрать целевое семантическое ядро («подставка для монитора дуб/орех»), сделать чистые вариативные URL без дублей."
        ],
        [
            "Платежи и мобильный UX",
            "Неработающие Apple/Google Pay, перегруз Elementor (>1 МБ CSS), баги отступов верстки.",
            "Чистая архитектура: СБП, Яндекс Сплит, Долями, сверхбыстрый отклик интерфейса, нулевой горизонтальный скролл на мобильных от 320px."
        ]
    ]
    b.add_table(strat_headers, strat_rows, col_widths=[1800, 3600, 3800], header_bg="0F172A")

    b.add_heading_2("Рекомендуемые первоочередные шаги GeekNook:")
    b.add_bullet("Подготовить партии флагманских подставок GeekNook (дуб/орех) и отгрузить на склады Ozon FBO в Москве для перехвата самого платежеспособного спроса со сроком доставки 1 день.", "Шаг 1. Ликвидация дефицита на маркетплейсах: ")
    b.add_bullet("Провести предметную интерьерную съемку премиум-класса, сопоставимую или превосходящую уровень KUB.", "Шаг 2. Визуальное усиление: ")
    b.add_bullet("Развернуть на сайте GeekNook посадочные SEO-страницы под органические запросы «деревянная подставка под монитор», забирая бесплатный поисковый трафик, упущенный конкурентом.", "Шаг 3. SEO-перехват: ")
    b.add_bullet("Оформить заказ флагманской двухмониторной подставки KUB (темный дуб) для оценки точности фрезеровки, жесткости металлоконструкций, качества покрытия Osmo и заводской упаковки.", "Шаг 4. Контрольная закупка: ")

    b.add_p(
        runs=[("Отчет подготовлен аналитической системой GeekNook. Документ содержит конфиденциальную коммерческую информацию.", {"italic": True, "size": 16, "color": "94A3B8"})],
        align="center",
        space_before=300
    )

    b.build_docx(output_file)

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "/Users/sergejzatovka/Desktop/programming shit/geeknook/geeknook/Анализ_конкурента_KUB_GeekNook.docx"
    generate_full_report(target)

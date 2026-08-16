#!/usr/bin/env python3
"""Generate a downloadable Hand and Foot score sheet PDF.

Traditional four-deal pad: named sides across, deal sections with
Whitnack/Pagat line items. No browser "Save as PDF" step required.

Output: public/hand-and-foot-score-sheet.pdf
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "hand-and-foot-score-sheet.pdf"

PAGE_W = 612  # US Letter
PAGE_H = 792
MARGIN = 36


def esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


class Page:
    def __init__(self) -> None:
        self.ops: list[str] = []

    def y(self, top: float) -> float:
        return PAGE_H - top

    def text(self, x: float, top: float, s: str, size: float = 10, font: str = "F1") -> None:
        self.ops.append(
            f"BT /{font} {size:.1f} Tf {x:.2f} {self.y(top):.2f} Td ({esc(s)}) Tj ET"
        )

    def line(self, x1: float, t1: float, x2: float, t2: float, width: float = 0.6) -> None:
        self.ops.append(
            f"{width:.2f} w {x1:.2f} {self.y(t1):.2f} m {x2:.2f} {self.y(t2):.2f} l S"
        )

    def rect(self, x: float, top: float, w: float, h: float, width: float = 0.8) -> None:
        self.ops.append(
            f"{width:.2f} w {x:.2f} {self.y(top + h):.2f} {w:.2f} {h:.2f} re S"
        )

    def fill_rect(self, x: float, top: float, w: float, h: float, gray: float = 0.92) -> None:
        self.ops.append(
            f"q {gray:.2f} g {x:.2f} {self.y(top + h):.2f} {w:.2f} {h:.2f} re f Q"
        )

    def stream(self) -> str:
        return "\n".join(self.ops) + "\n"


def draw_header(p: Page) -> float:
    p.text(MARGIN, 50, "HAND AND FOOT", size=18, font="F2")
    p.text(MARGIN, 68, "Score sheet  -  four deals", size=11, font="F2")
    p.text(
        MARGIN,
        84,
        "TableScore  -  Pagat / Whitnack bonuses (retrieved 16 August 2026)",
        size=9,
    )
    p.text(MARGIN, 102, "Date ________________", size=10)
    p.text(220, 102, "Location ________________", size=10)
    p.text(MARGIN, 118, "Variant (circle one):  Whitnack partnership   Steve Simpson   Saskatchewan", size=10)
    p.text(
        MARGIN,
        134,
        "Card values: joker 50  -  two or ace 20  -  8-K 10  -  4-7 5  -  black 3 5.  Red threes are a separate line.",
        size=8,
    )
    return 148


def draw_deal_block(p: Page, top: float, deal_no: int, meld_min: int, inner_w: float) -> float:
    sides = ["Side A", "Side B", "Side C", "Side D"]
    lines = [
        "Natural / clean piles (Whitnack 500)",
        "Mixed / dirty piles (Whitnack 300)",
        "Wild piles (Whitnack 1,500)",
        "Red threes on the table",
        "Red threes still in hand or foot",
        "Melded card points",
        "Leftover card points (subtract)",
        "Going out (100, one side only)",
        "Deal total",
    ]
    label_w = 210
    col_w = (inner_w - label_w) / 4
    row_h = 18
    header_h = 28

    p.fill_rect(MARGIN, top, inner_w, header_h, 0.88)
    p.rect(MARGIN, top, inner_w, header_h)
    p.text(
        MARGIN + 6,
        top + 18,
        f"Deal {deal_no}  -  first meld minimum {meld_min} (card points only)",
        size=11,
        font="F2",
    )

    y = top + header_h
    # name row
    p.rect(MARGIN, y, label_w, row_h)
    p.text(MARGIN + 4, y + 13, "Name", size=9, font="F2")
    for i, side in enumerate(sides):
        x = MARGIN + label_w + i * col_w
        p.rect(x, y, col_w, row_h)
        p.text(x + 4, y + 13, side, size=8)
    y += row_h

    for line in lines:
        heavy = line == "Deal total"
        if heavy:
            p.fill_rect(MARGIN, y, inner_w, row_h, 0.94)
        p.rect(MARGIN, y, label_w, row_h, 1.1 if heavy else 0.6)
        p.text(MARGIN + 4, y + 13, line, size=8, font="F2" if heavy else "F1")
        for i in range(4):
            x = MARGIN + label_w + i * col_w
            p.rect(x, y, col_w, row_h, 1.1 if heavy else 0.6)
        y += row_h
    return y + 10


def draw_totals(p: Page, top: float, inner_w: float) -> None:
    label_w = 210
    col_w = (inner_w - label_w) / 4
    row_h = 22
    p.fill_rect(MARGIN, top, inner_w, row_h, 0.82)
    p.rect(MARGIN, top, label_w, row_h, 1.2)
    p.text(MARGIN + 4, top + 15, "Game total", size=11, font="F2")
    for i in range(4):
        x = MARGIN + label_w + i * col_w
        p.rect(x, top, col_w, row_h, 1.2)
    p.text(
        MARGIN,
        top + 40,
        "Need more than four sides? Print a second copy. Interactive keeper: /hand-and-foot-score-keeper/",
        size=8,
    )
    p.text(
        MARGIN,
        top + 54,
        "Saskatchewan pile bonuses are not restated on Pagat; this pad shows the Whitnack 500 / 300 / 1,500 table.",
        size=8,
    )
    p.text(
        MARGIN,
        top + 68,
        "This is a social score pad. It is not a place to play for money.",
        size=8,
    )


def build_pages() -> list[Page]:
    inner_w = PAGE_W - 2 * MARGIN
    page1 = Page()
    y = draw_header(page1)
    y = draw_deal_block(page1, y, 1, 50, inner_w)
    y = draw_deal_block(page1, y, 2, 90, inner_w)

    page2 = Page()
    page2.text(MARGIN, 48, "HAND AND FOOT  -  score sheet (continued)", size=12, font="F2")
    y2 = 64
    y2 = draw_deal_block(page2, y2, 3, 120, inner_w)
    y2 = draw_deal_block(page2, y2, 4, 150, inner_w)
    draw_totals(page2, y2 + 4, inner_w)
    return [page1, page2]


def write_pdf(pages: list[Page], dest: Path) -> None:
    objects: list[bytes] = []

    def add(obj: str) -> int:
        objects.append(obj.encode("latin-1", "replace"))
        return len(objects)

    add("<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{3 + i} 0 R" for i in range(len(pages)))
    add(f"<< /Type /Pages /Count {len(pages)} /Kids [{kids}] >>")

    content_ids = []
    page_obj_slots = []
    for _ in pages:
        page_obj_slots.append(None)

    # page objects first (3 .. 3+n-1), contents after, fonts last
    # We will assemble in a second pass with reserved numbers.
    # Layout:
    # 1 catalog
    # 2 pages
    # 3..2+n page dicts
    # 3+n .. 2+2n contents
    # last-1 Helvetica
    # last Helvetica-Bold

    n = len(pages)
    font1_id = 3 + 2 * n
    font2_id = 4 + 2 * n

    # We already added 1 and 2. Add page dicts.
    for i in range(n):
        content_id = 3 + n + i
        add(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] "
            f"/Contents {content_id} 0 R /Resources << /Font << "
            f"/F1 {font1_id} 0 R /F2 {font2_id} 0 R >> >> >>"
        )
    for page in pages:
        stream = page.stream()
        add(f"<< /Length {len(stream.encode('latin-1', 'replace'))} >>\nstream\n{stream}endstream")

    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    # Build xref
    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    body = b""
    offsets = [0]
    pos = len(header)
    for i, obj in enumerate(objects, start=1):
        offsets.append(pos)
        chunk = f"{i} 0 obj\n".encode("ascii") + obj + b"\nendobj\n"
        body += chunk
        pos += len(chunk)
    xref_pos = pos
    xref = [f"xref\n0 {len(objects) + 1}\n", "0000000000 65535 f \n"]
    for off in offsets[1:]:
        xref.append(f"{off:010d} 00000 n \n")
    trailer = (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n"
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(header + body + "".join(xref).encode("ascii") + trailer.encode("ascii"))


def main() -> None:
    write_pdf(build_pages(), OUT)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

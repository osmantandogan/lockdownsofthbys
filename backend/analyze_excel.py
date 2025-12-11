#!/usr/bin/env python3
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

wb = load_workbook('templates/VAKA_FORMU_TEMPLATE.xlsx')
ws = wb.active

print("=== VAKA FORMU - DEĞER HÜCRELERİ ANALİZİ ===\n")

# Birleşik hücre haritası
merged_map = {}
for mr in ws.merged_cells.ranges:
    top_left = f"{get_column_letter(mr.min_col)}{mr.min_row}"
    merged_map[top_left] = str(mr)

# İlk 10 satırı tam göster (A-Z arası)
for row in range(1, 10):
    print(f"\n=== ROW {row} ===")
    line = ""
    for col in range(1, 27):
        coord = f"{get_column_letter(col)}{row}"
        cell = ws.cell(row=row, column=col)
        val = str(cell.value)[:12] if cell.value else "___"
        merged = " [M]" if coord in merged_map else ""
        line += f"{coord}:{val}{merged} | "
    print(line)

print("\n\n=== ÖNEMLİ BİRLEŞİK HÜCRELER (Row 1-10) ===")
for mr in ws.merged_cells.ranges:
    if mr.min_row <= 10:
        top_left = f"{get_column_letter(mr.min_col)}{mr.min_row}"
        print(f"  {mr} (yazılacak yer: {top_left})")


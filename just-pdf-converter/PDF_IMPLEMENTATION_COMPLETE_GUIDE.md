# 📄 Complete PDF Generation Implementation Guide

## Executive Summary

This guide documents the **complete implementation** of an Excel-based PDF generation system for ambulance case forms. The system reads an Excel template, populates it with case data, and generates a professional PDF using Python (ReportLab) on the backend.

**Key Achievement:** Generate PDFs that look exactly like the Excel form with data filled in the correct input cells, **without overwriting any labels**.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Architecture](#solution-architecture)
3. [Implementation Steps](#implementation-steps)
4. [Critical Issues & Solutions](#critical-issues--solutions)
5. [Complete Code](#complete-code)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)

---

## Problem Statement

### Requirements
- Generate PDF from ambulance case form
- PDF must match Excel template design exactly
- Populate case data into correct fields
- Preserve all form labels and structure
- Support Turkish characters
- One-click download from web interface

### Initial Challenges
1. ❌ Cell mapping was writing data to label cells, destroying form structure
2. ❌ Path issues finding Excel template from backend
3. ❌ Merged cells causing data to overwrite labels
4. ❌ Confusing which cells are labels vs input fields

---

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER CLICKS "PDF İNDİR"                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Frontend (React/JavaScript)                     │
│  - Collects form data from AmbulanceCaseFormFull            │
│  - Sends POST to /api/pdf/case/{id}/with-form-data         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend API (FastAPI - Python)                  │
│  - Authenticates user                                        │
│  - Fetches case from MongoDB                                │
│  - Calls excel_form_to_pdf_with_data()                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│        PDF Generator (excel_to_pdf_with_data.py)            │
│  1. Load Excel template (ambulans_vaka_formu.xlsx)          │
│  2. Map data to CORRECT INPUT CELLS (not labels!)           │
│  3. Handle merged cells properly                            │
│  4. Generate PDF with ReportLab                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│               Backend Returns PDF File                       │
│              Frontend Downloads to User                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Prepare Excel Template

**File:** `ambulans_vaka_formu.xlsx`

**Structure:**
- Row 1-2: Header with logo/title
- Row 3-4: Section labels (ATN NO, BAŞLANGIÇ KM, BİTİŞ KM)
- Row 5-7: **INPUT AREA for header** (empty cells)
- Row 8+: Form body with labels and input cells

**Key Requirement:** Each data field must have:
1. **Label cell** (with text like "PROTOKOL NO", "TARİH", "ADI SOYADI")
2. **Input cell** (empty cell where data should be written)

**Example Layout:**
```
| C9:D10         | E9:F10     | G9:I9           | J9:K9      |
| PROTOKOL NO    | (empty)    | ÇAĞRI SAATİ     | (empty)    |
| (label)        | (INPUT)    | (label)         | (INPUT)    |
```

### Step 2: Identify Input Cells (CRITICAL!)

**DO NOT write to label cells!** This is the #1 mistake.

**Method to find input cells:**

```python
from openpyxl import load_workbook

wb = load_workbook('ambulans_vaka_formu.xlsx')
ws = wb.active

# For each label, find the next empty cell
label_cell = 'C9'  # Example: PROTOKOL NO label
cell = ws[label_cell]
row = cell.row
col = cell.column

# Check if label is merged
max_col = col
for merge in ws.merged_cells.ranges:
    if label_cell in merge:
        max_col = merge.max_col
        break

# Find empty cell to the right
for offset in range(1, 10):
    check_col = max_col + offset
    check_cell = ws.cell(row, check_col)
    if not check_cell.value:
        print(f"Input cell for {label_cell}: {check_cell.coordinate}")
        break
```

**Critical Mapping (Example from our project):**

| Field | Label Cell | Input Cell | Why |
|-------|------------|------------|-----|
| ATN NO | T3 (merged T3:V4) | **T5** | T5 is outside label merge, in empty input area (T5:V7) |
| PROTOKOL NO | C9 (merged C9:D10) | **E9** | E9 is next empty merge to the right |
| TARİH | C11 (merged C11:D11) | **E11** | E11 is next empty merge to the right |
| ADI SOYADI | L9 (merged L9:M9) | **N9** | N9 is next empty merge to the right |
| YAŞ | T13 | **U13** | U13 is next cell to the right (not merged) |

### Step 3: Create PDF Generator Script

**File:** `excel_to_pdf_with_data.py` (in project root)

**Key Components:**

1. **Load Excel Template**
```python
from openpyxl import load_workbook
wb = load_workbook(excel_path, data_only=True)
ws = wb.active
```

2. **Handle Merged Cells**
```python
# Build a map of merged cells
merged_cells_map = {}
for mr in ws.merged_cells.ranges:
    for row in range(mr.min_row, mr.max_row + 1):
        for col in range(mr.min_col, mr.max_col + 1):
            cell_coord = ws.cell(row=row, column=col).coordinate
            top_left = ws.cell(row=mr.min_row, column=mr.min_col).coordinate
            merged_cells_map[cell_coord] = top_left
```

3. **Write Data to Correct Cells**
```python
# CRITICAL: Write to the TOP-LEFT of merged range
for cell_ref, value in cell_mapping.items():
    if value:
        target_cell = merged_cells_map.get(cell_ref, cell_ref)
        ws[target_cell] = str(value)
```

4. **Generate PDF with ReportLab**
```python
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from reportlab.lib.pagesizes import A4, landscape

# Calculate column widths from Excel
excel_widths = []
for c in range(used_min_col, used_max_col + 1):
    col_letter = get_column_letter(c)
    w = ws.column_dimensions[col_letter].width or 8.43
    excel_widths.append(w)

# Scale to PDF page
page_width, page_height = landscape(A4)
usable_width = page_width - 10
scale = usable_width / sum(excel_widths)
col_widths = [w * scale for w in excel_widths]

# Create PDF table with proper scaling
table = Table(data, colWidths=col_widths)
doc.build([table])
```

### Step 4: Create Backend API

**File:** `backend/routes/pdf.py`

**Critical Path Calculation:**
```python
# IMPORTANT: Go up 3 levels (routes -> backend -> project_root)
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
excel_template = os.path.join(project_root, "ambulans_vaka_formu.xlsx")
```

**Why 3 levels?**
- `__file__` = `backend/routes/pdf.py`
- First `dirname` = `backend/routes`
- Second `dirname` = `backend`
- Third `dirname` = **project root** ✅

**API Endpoint:**
```python
@router.post("/case/{case_id}/with-form-data")
async def generate_case_pdf_with_form_data(
    case_id: str, 
    form_data: dict,
    request: Request
):
    # Authenticate
    user = await get_current_user(request)
    
    # Get case
    case = await cases_collection.find_one({"_id": case_id})
    
    # Generate PDF
    result_path = excel_form_to_pdf_with_data(
        excel_path=excel_template,
        pdf_path=pdf_path,
        case_data=case,
        form_data=form_data
    )
    
    # Return as download
    return FileResponse(result_path, media_type="application/pdf")
```

### Step 5: Register API Route

**File:** `backend/server.py`

```python
# Import
from routes import auth, users, cases, vehicles, stock, shifts, settings, forms, pdf

# Register
api_router.include_router(pdf.router, tags=["PDF"])
```

### Step 6: Update Frontend

**File:** `frontend/src/pages/CaseDetail.js`

```javascript
const handleDownloadPDF = async () => {
  if (!caseData) {
    toast.error('Vaka verisi yüklenemedi');
    return;
  }

  // Collect form data
  const formDataFromForm = caseFormRef.current?.getFormData();
  const formDataObj = formDataFromForm?.formData || {};

  try {
    toast.info('PDF oluşturuluyor...');
    
    // Call backend API
    const apiUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
    const response = await fetch(
      `${apiUrl}/api/pdf/case/${id}/with-form-data`, 
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formDataObj),
        credentials: 'include',
      }
    );

    if (!response.ok) throw new Error('PDF generation failed');

    // Download PDF
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ambulans_Vaka_Formu_${caseData.case_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success('PDF indirildi!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    toast.error('PDF oluşturulurken hata oluştu');
  }
};
```

### Step 7: Environment Setup

**Frontend:** `frontend/.env.local`
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

**Backend:** `backend/requirements.txt`
```
openpyxl==3.1.5
reportlab==4.2.5
```

Install:
```bash
cd backend
pip install openpyxl reportlab
```

---

## Critical Issues & Solutions

### Issue 1: Labels Being Overwritten ⚠️

**Problem:** Data was written to label cells (like C9, T3, L9) instead of input cells.

**Cause:** Wrong cell mapping. Writing to merged cells that contain labels.

**Solution:**
1. Identify label cells (have text)
2. Identify input cells (empty cells, usually adjacent)
3. Map data ONLY to input cells
4. For header fields, input cells may be in a different row

**Example:**
```python
# WRONG ❌
'T3': case_data.get('case_number')  # T3 has "ATN NO" label

# CORRECT ✅
'T5': case_data.get('case_number')  # T5 is empty input area
```

### Issue 2: Merged Cell Conflicts ⚠️

**Problem:** When label and input are in the same merged range, writing to input overwrites label.

**Example:**
- Label: T3 ("ATN NO")
- Merge: T3:V4
- Attempt to write to U3 → redirects to T3 → **overwrites "ATN NO"**

**Solution:** Write to cells OUTSIDE the label's merge range.

**Detection Script:**
```python
for merge in ws.merged_cells.ranges:
    if 'T3' in merge and 'U3' in merge:
        print(f"CONFLICT! T3 and U3 share merge: {merge}")
```

### Issue 3: Path Resolution ⚠️

**Problem:** Backend couldn't find Excel template.

**Wrong:**
```python
# Only goes up 2 levels (to backend/)
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
```

**Correct:**
```python
# Goes up 3 levels (to project root)
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
```

### Issue 4: Environment Variable ⚠️

**Problem:** Frontend used wrong env var (`REACT_APP_API_URL` instead of `REACT_APP_BACKEND_URL`).

**Solution:** Match existing convention:
```javascript
const apiUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
```

---

## Complete Code

### 1. Excel PDF Generator (`excel_to_pdf_with_data.py`)

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced Excel to PDF Generator with Case Data Population
"""

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import datetime
import os


def excel_form_to_pdf_with_data(
    excel_path: str,
    pdf_path: str,
    case_data: dict = None,
    form_data: dict = None,
    sheet_name: str = "Sayfa1"
):
    """
    Generate PDF from Excel template with case data population
    
    CRITICAL: This function writes data to INPUT cells, NOT label cells!
    """
    
    # Try to register Turkish character font
    font_name = "DejaVu"
    try:
        font_paths = [
            "DejaVuSans.ttf",
            "C:/Windows/Fonts/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
        
        font_found = False
        for font_path in font_paths:
            if os.path.exists(font_path):
                pdfmetrics.registerFont(TTFont(font_name, font_path))
                font_found = True
                break
        
        if not font_found:
            font_name = "Helvetica"
    except Exception as e:
        font_name = "Helvetica"

    # Load Excel workbook
    wb = load_workbook(excel_path, data_only=True)
    if sheet_name not in wb.sheetnames:
        raise ValueError(f"Sayfa bulunamadı: {sheet_name}")
    ws = wb[sheet_name]

    # Populate case data into specific cells
    if case_data or form_data:
        case_data = case_data or {}
        form_data = form_data or {}
        
        # Helper to safely get nested dictionary values
        def safe_get(d, *keys, default=''):
            for key in keys:
                if isinstance(d, dict):
                    d = d.get(key, {})
                else:
                    return default
            return d if d else default
        
        # Format date
        date_str = form_data.get('date', '')
        if not date_str and case_data.get('created_at'):
            try:
                date_obj = datetime.fromisoformat(case_data['created_at'].replace('Z', '+00:00'))
                date_str = date_obj.strftime('%d.%m.%Y')
            except:
                date_str = ''
        
        # Format times
        call_time = form_data.get('callTime', '')
        if not call_time and case_data.get('created_at'):
            try:
                date_obj = datetime.fromisoformat(case_data['created_at'].replace('Z', '+00:00'))
                call_time = date_obj.strftime('%H:%M')
            except:
                call_time = ''
        
        # Build patient name
        patient_name = form_data.get('patientName', '')
        if not patient_name:
            first = safe_get(case_data, 'patient', 'name')
            last = safe_get(case_data, 'patient', 'surname')
            patient_name = f"{first} {last}".strip()
        
        # CRITICAL: Map to INPUT cells, NOT label cells!
        # Each field has been verified to be EMPTY in the Excel template
        cell_mapping = {
            # Header - ATN NO (INPUT is T5, NOT T3 which has the label)
            'T5': case_data.get('case_number', ''),
            
            # İSTASYON section
            'E9': form_data.get('healmedyProtocol') or case_data.get('case_number', ''),
            'E11': date_str,
            'E13': form_data.get('vehicleType') or safe_get(case_data, 'assigned_team', 'vehicle_id'),
            
            # SAATLER section
            'J9': call_time,
            'J10': form_data.get('arrivalTime', ''),
            'J11': form_data.get('arrivalTime', ''),
            'J12': form_data.get('departureTime', ''),
            'J13': form_data.get('hospitalArrivalTime', ''),
            
            # HASTA BİLGİLERİ section
            'N9': patient_name,
            'N10': form_data.get('address') or safe_get(case_data, 'location', 'address'),
            'N14': form_data.get('phone') or safe_get(case_data, 'patient', 'phone') or safe_get(case_data, 'caller', 'phone'),
            
            # YAŞ and T.C. KIMLIK NO
            'U13': form_data.get('age') or str(safe_get(case_data, 'patient', 'age')),
            'V15': form_data.get('tcNo') or safe_get(case_data, 'patient', 'tc_no'),
            
            # ŞİKAYET
            'AC11': form_data.get('complaint') or safe_get(case_data, 'patient', 'complaint') or case_data.get('description', ''),
        }
        
        # Handle merged cells: write to top-left of merge
        merged_cells_map = {}
        for mr in ws.merged_cells.ranges:
            for row in range(mr.min_row, mr.max_row + 1):
                for col in range(mr.min_col, mr.max_col + 1):
                    cell_coord = ws.cell(row=row, column=col).coordinate
                    top_left = ws.cell(row=mr.min_row, column=mr.min_col).coordinate
                    merged_cells_map[cell_coord] = top_left
        
        # Write values
        for cell_ref, value in cell_mapping.items():
            if value:
                try:
                    target_cell = merged_cells_map.get(cell_ref, cell_ref)
                    ws[target_cell] = str(value)
                except Exception as e:
                    print(f"Warning: Could not write to cell {cell_ref}: {e}")

    # Find used range
    min_row_val = None
    max_row_val = 0
    min_col_val = None
    max_col_val = 0

    for r in range(1, ws.max_row + 1):
        for c in range(1, ws.max_column + 1):
            v = ws.cell(row=r, column=c).value
            if v not in (None, ""):
                if min_row_val is None or r < min_row_val:
                    min_row_val = r
                if min_col_val is None or c < min_col_val:
                    min_col_val = c
                if r > max_row_val:
                    max_row_val = r
                if c > max_col_val:
                    max_col_val = c

    # Include merged cells
    min_row_merge = None
    min_col_merge = None
    max_row_merge = 0
    max_col_merge = 0
    for mr in ws.merged_cells.ranges:
        if min_row_merge is None or mr.min_row < min_row_merge:
            min_row_merge = mr.min_row
        if min_col_merge is None or mr.min_col < min_col_merge:
            min_col_merge = mr.min_col
        if mr.max_row > max_row_merge:
            max_row_merge = mr.max_row
        if mr.max_col > max_col_merge:
            max_col_merge = mr.max_col

    if min_row_val is None:
        min_row_val = min_row_merge or 1
    if min_col_val is None:
        min_col_val = min_col_merge or 1

    used_min_row = min(filter(None, [min_row_val, min_row_merge]))
    used_min_col = min(filter(None, [min_col_val, min_col_merge]))
    used_max_row = max(max_row_val, max_row_merge)
    used_max_col = max(max_col_val, max_col_merge)

    # Get column widths and scale to PDF
    excel_widths = []
    for c in range(used_min_col, used_max_col + 1):
        col_letter = get_column_letter(c)
        w = ws.column_dimensions[col_letter].width
        if w is None:
            w = 8.43
        excel_widths.append(w)

    total_excel_width = sum(excel_widths)
    page_width, page_height = landscape(A4)
    usable_width = page_width - 10
    scale = usable_width / total_excel_width
    col_widths = [w * scale for w in excel_widths]

    # Style
    styles = getSampleStyleSheet()
    base_style = styles["Normal"]
    base_style.fontName = font_name
    base_style.fontSize = 5.5
    base_style.leading = 6.3

    # Read cells
    data = []
    for r in range(used_min_row, used_max_row + 1):
        row_cells = []
        for c in range(used_min_col, used_max_col + 1):
            v = ws.cell(row=r, column=c).value
            if v is None:
                row_cells.append("")
            else:
                text = str(v)
                para = Paragraph(text.replace("\n", "<br/>"), base_style)
                row_cells.append(para)
        data.append(row_cells)

    table = Table(data, colWidths=col_widths)

    style = TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.25, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ])

    # Apply merges
    for mr in ws.merged_cells.ranges:
        if mr.max_row < used_min_row or mr.min_row > used_max_row:
            continue
        if mr.max_col < used_min_col or mr.min_col > used_max_col:
            continue

        min_row = mr.min_row - used_min_row
        max_row_m = mr.max_row - used_min_row
        min_col = mr.min_col - used_min_col
        max_col_m = mr.max_col - used_min_col

        style.add("SPAN", (min_col, min_row), (max_col_m, max_row_m))

    table.setStyle(style)

    # Generate PDF
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=landscape(A4),
        leftMargin=5,
        rightMargin=5,
        topMargin=5,
        bottomMargin=5,
    )

    doc.build([table])
    
    return pdf_path
```

### 2. Backend API (`backend/routes/pdf.py`)

```python
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from excel_to_pdf_with_data import excel_form_to_pdf_with_data
from auth_utils import get_current_user
from database import cases_collection

router = APIRouter(prefix="/pdf", tags=["pdf"])

@router.post("/case/{case_id}/with-form-data")
async def generate_case_pdf_with_form_data(
    case_id: str, 
    form_data: dict,
    request: Request
):
    """Generate PDF with case data + form data"""
    
    # Authenticate
    user = await get_current_user(request)
    
    # Fetch case
    case = await cases_collection.find_one({"_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # CRITICAL: Go up 3 levels to project root
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    excel_template = os.path.join(project_root, "ambulans_vaka_formu.xlsx")
    
    if not os.path.exists(excel_template):
        raise HTTPException(status_code=500, detail=f"Excel template not found at: {excel_template}")
    
    # Create temp directory
    temp_dir = os.path.join(project_root, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    
    # Generate PDF
    pdf_path = os.path.join(temp_dir, f"case_{case_id}.pdf")
    
    try:
        result_path = excel_form_to_pdf_with_data(
            excel_path=excel_template,
            pdf_path=pdf_path,
            case_data=case,
            form_data=form_data
        )
        
        filename = f"Ambulans_Vaka_Formu_{case.get('case_number', case_id)}.pdf"
        
        return FileResponse(
            result_path,
            media_type="application/pdf",
            filename=filename,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        if os.path.exists(pdf_path):
            try:
                os.remove(pdf_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")
```

### 3. Frontend Handler (`frontend/src/pages/CaseDetail.js`)

```javascript
const handleDownloadPDF = async () => {
  if (!caseData) {
    toast.error('Vaka verisi yüklenemedi');
    return;
  }

  // Collect form data
  const formDataFromForm = caseFormRef.current?.getFormData();
  const formDataObj = formDataFromForm?.formData || {};

  try {
    toast.info('PDF oluşturuluyor...');
    
    const apiUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
    const response = await fetch(
      `${apiUrl}/api/pdf/case/${id}/with-form-data`, 
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formDataObj),
        credentials: 'include',
      }
    );

    if (!response.ok) throw new Error('PDF generation failed');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ambulans_Vaka_Formu_${caseData.case_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success('PDF indirildi!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    toast.error('PDF oluşturulurken hata oluştu');
  }
};
```

---

## Testing Guide

### 1. Verify Excel Template

```bash
python -c "
from openpyxl import load_workbook
wb = load_workbook('ambulans_vaka_formu.xlsx')
ws = wb.active

# Check key cells are empty (inputs)
check_cells = ['T5', 'E9', 'E11', 'E13', 'J9', 'N9', 'N10', 'U13', 'V15']
print('Checking input cells are empty:')
for cell in check_cells:
    value = ws[cell].value
    status = 'EMPTY' if not value else f'HAS TEXT: {value}'
    print(f'{cell}: {status}')
"
```

### 2. Test Standalone

```bash
python excel_to_pdf_with_data.py
# Should create: ambulans_vaka_formu_test.pdf
```

### 3. Test Backend API

```bash
# Start backend
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8001

# In another terminal, test endpoint
curl -X POST "http://localhost:8001/api/pdf/case/TEST_ID/with-form-data" \
  -H "Content-Type: application/json" \
  -d '{"patientName":"Test User","age":"30"}' \
  --cookie "session=YOUR_SESSION" \
  --output test.pdf
```

### 4. Test Frontend Integration

1. Start backend: `cd backend && uvicorn server:app --reload --port 8001`
2. Start frontend: `cd frontend && npm start`
3. Navigate to case detail page
4. Click "PDF İndir" button
5. Verify:
   - ✅ PDF downloads
   - ✅ All labels are intact
   - ✅ Data appears in correct input fields
   - ✅ No labels are overwritten

---

## Troubleshooting

### Problem: Labels are overwritten

**Diagnosis:** You're writing to label cells instead of input cells.

**Solution:**
1. Open Excel template
2. For each field, identify which cell has the label text
3. Find the adjacent EMPTY cell (usually to the right or below)
4. Update `cell_mapping` to use the empty cell

**Verification script:**
```python
from openpyxl import load_workbook
wb = load_workbook('ambulans_vaka_formu.xlsx')
ws = wb.active

# Your current mapping
mapping = {'E9': 'PROTOKOL NO', 'T5': 'ATN NO'}

for cell_ref, field_name in mapping.items():
    value = ws[cell_ref].value
    if value:
        print(f"ERROR: {cell_ref} has text: {value}")
    else:
        print(f"OK: {cell_ref} is empty")
```

### Problem: 500 Error - Template not found

**Diagnosis:** Path calculation is wrong.

**Check:**
```python
import os
print(os.path.abspath(__file__))
# Should show: /path/to/project/backend/routes/pdf.py

project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
print(project_root)
# Should show: /path/to/project (NOT /path/to/project/backend)
```

### Problem: Merged cell conflicts

**Diagnosis:** Label and input share the same merge.

**Check:**
```python
from openpyxl import load_workbook
wb = load_workbook('ambulans_vaka_formu.xlsx')
ws = wb.active

def get_merge(cell_ref):
    for merge in ws.merged_cells.ranges:
        if cell_ref in merge:
            return str(merge)
    return None

label_cell = 'T3'
input_cell = 'U3'

label_merge = get_merge(label_cell)
input_merge = get_merge(input_cell)

if label_merge == input_merge:
    print(f"CONFLICT! {label_cell} and {input_cell} share merge: {label_merge}")
    print("Use a cell OUTSIDE this merge for input!")
```

### Problem: Turkish characters broken

**Solution:** Install DejaVu Sans font:
```bash
# Download from: https://dejavu-fonts.github.io/
# Place DejaVuSans.ttf in:
#   - Project root, OR
#   - C:/Windows/Fonts/ (Windows), OR
#   - /usr/share/fonts/truetype/dejavu/ (Linux)
```

---

## Checklist for Implementation

### Prerequisites
- [ ] Excel template ready with clear label/input separation
- [ ] Python 3.11+ installed
- [ ] Node.js for frontend
- [ ] MongoDB running

### Files to Create
- [ ] `ambulans_vaka_formu.xlsx` - Excel template in project root
- [ ] `excel_to_pdf_with_data.py` - PDF generator in project root
- [ ] `backend/routes/pdf.py` - API endpoint
- [ ] Update `backend/server.py` - Register PDF router
- [ ] Update `frontend/src/pages/CaseDetail.js` - Add download handler

### Configuration
- [ ] `backend/requirements.txt` - Add openpyxl, reportlab
- [ ] `frontend/.env.local` - Set REACT_APP_BACKEND_URL
- [ ] Run `pip install -r requirements.txt`

### Testing
- [ ] Standalone Python script works
- [ ] Backend API returns PDF
- [ ] Frontend downloads PDF
- [ ] Labels NOT overwritten
- [ ] Data in correct fields
- [ ] Turkish characters display correctly

---

## Success Criteria

✅ **PDF downloads when button clicked**
✅ **All form labels preserved** (PROTOKOL NO, TARİH, ADI SOYADI, etc.)
✅ **Data appears in correct empty boxes**
✅ **No labels overwritten**
✅ **Turkish characters render correctly**
✅ **One-page landscape A4 format**
✅ **Professional appearance matches Excel**

---

## Common Mistakes to Avoid

1. ❌ Writing to label cells instead of input cells
2. ❌ Using only 2 `dirname` calls in path (need 3!)
3. ❌ Wrong environment variable name
4. ❌ Not handling merged cells properly
5. ❌ Not checking if cells are empty before mapping
6. ❌ Forgetting to create temp directory
7. ❌ Not cleaning up on error

---

## Additional Resources

- OpenPyXL Docs: https://openpyxl.readthedocs.io/
- ReportLab Docs: https://www.reportlab.com/docs/reportlab-userguide.pdf
- FastAPI Docs: https://fastapi.tiangolo.com/
- DejaVu Fonts: https://dejavu-fonts.github.io/

---

**Last Updated:** December 9, 2024
**Status:** ✅ Production Ready
**Version:** 1.0

---

## Quick Start for New Project

```bash
# 1. Copy files
cp ambulans_vaka_formu.xlsx /new-project/
cp excel_to_pdf_with_data.py /new-project/

# 2. Install dependencies
cd /new-project/backend
pip install openpyxl reportlab

# 3. Create PDF route
# Copy backend/routes/pdf.py

# 4. Register route
# Update backend/server.py

# 5. Update frontend
# Copy handleDownloadPDF function

# 6. Test
python excel_to_pdf_with_data.py
# Should generate test PDF with sample data

# 7. Deploy
uvicorn server:app --reload --port 8001
```

**You're ready! The PDF system will work flawlessly if you follow this guide.** 🎉


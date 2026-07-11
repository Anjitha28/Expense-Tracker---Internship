import io
import pandas as pd
from datetime import date
from typing import List, Dict, Any

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def export_to_excel(transactions_data: List[Dict[str, Any]]) -> io.BytesIO:
    # Convert list of dicts to DataFrame
    df = pd.DataFrame(transactions_data)
    
    # Reorder/rename columns for output
    if not df.empty:
        df = df[["date", "type", "category", "subcategory", "payment_mode", "amount", "notes"]]
        df.columns = ["Date", "Type", "Category", "Subcategory", "Payment Mode", "Amount", "Notes"]
    else:
        df = pd.DataFrame(columns=["Date", "Type", "Category", "Subcategory", "Payment Mode", "Amount", "Notes"])
        
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Transactions Ledger")
    
    output.seek(0)
    return output

def export_to_pdf(transactions_data: List[Dict[str, Any]], user_email: str) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        textColor=colors.HexColor('#1E3A8A'), # Blue-900 fintech theme
        spaceAfter=6
    )
    
    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor('#4B5563'), # Gray-600
        spaceAfter=15
    )
    
    normal_style = styles['Normal']
    header_style = ParagraphStyle(
        'TableHeader',
        parent=normal_style,
        fontName='Helvetica-Bold',
        textColor=colors.white
    )

    story = []
    
    # Title & Metadata
    story.append(Paragraph("Smart Expense Tracker Ledger", title_style))
    story.append(Paragraph(f"Exported for: {user_email} | Date: {date.today().strftime('%B %d, %Y')}", meta_style))
    story.append(Spacer(1, 10))
    
    # Table headers
    headers = [
        Paragraph("Date", header_style),
        Paragraph("Type", header_style),
        Paragraph("Category", header_style),
        Paragraph("Subcategory", header_style),
        Paragraph("Payment Mode", header_style),
        Paragraph("Amount", header_style),
        Paragraph("Notes", header_style)
    ]
    
    table_data = [headers]
    
    total_income = 0
    total_expense = 0
    
    # Process transactions
    for tx in transactions_data:
        amount = tx.get("amount", 0)
        txt_type = tx.get("type", "expense").lower()
        
        if txt_type == "income":
            total_income += amount
            amount_str = f"+${amount:,.2f}"
            amount_color = colors.HexColor('#10B981') # Emerald-500
        else:
            total_expense += amount
            amount_str = f"-${amount:,.2f}"
            amount_color = colors.HexColor('#EF4444') # Red-500
            
        amount_style = ParagraphStyle(
            'TxAmount',
            parent=normal_style,
            fontName='Helvetica-Bold',
            textColor=amount_color
        )
        
        row = [
            Paragraph(str(tx.get("date", "")), normal_style),
            Paragraph(txt_type.capitalize(), normal_style),
            Paragraph(str(tx.get("category", "")), normal_style),
            Paragraph(str(tx.get("subcategory", "") or "-"), normal_style),
            Paragraph(str(tx.get("payment_mode", "")), normal_style),
            Paragraph(amount_str, amount_style),
            Paragraph(str(tx.get("notes", "") or ""), normal_style)
        ]
        table_data.append(row)
        
    # Table layout & styles
    col_widths = [65, 55, 75, 75, 75, 70, 115] # Total width = 530 (matches letter size margined)
    tx_table = Table(table_data, colWidths=col_widths)
    tx_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F2937')), # Dark background for header
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]), # Alternating background
    ]))
    
    story.append(tx_table)
    story.append(Spacer(1, 20))
    
    # Financial Summary Box at end
    net_savings = total_income - total_expense
    summary_data = [
        [Paragraph("<b>Total Income</b>", normal_style), f"${total_income:,.2f}"],
        [Paragraph("<b>Total Expense</b>", normal_style), f"${total_expense:,.2f}"],
        [Paragraph("<b>Net Balance</b>", normal_style), f"${net_savings:,.2f}"]
    ]
    summary_table = Table(summary_data, colWidths=[120, 100])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F3F4F6')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    
    story.append(Paragraph("<b>Financial Summary</b>", styles['Heading3']))
    story.append(Spacer(1, 5))
    story.append(summary_table)

    # Build the document
    doc.build(story)
    buffer.seek(0)
    return buffer

"""Read authorized Office documents through installed Office; never save originals."""
import importlib
import sys
from pathlib import Path

MAX_TEXT = 2_000_000
SUPPORTED = {'.doc', '.docx', '.ppt', '.pptx'}


def normalize(text):
    return str(text).replace('\r\n', '\n').replace('\r', '\n').replace('\x0b', '\n').replace('\x0c', '\n').replace('\x07', ' ')


def read_office(path):
    if sys.platform != 'win32':
        raise RuntimeError('此功能需要 Windows、Microsoft Office 和 pywin32。')
    path = Path(path)
    if path.suffix.lower() not in SUPPORTED:
        raise ValueError('仅支持 Word 和 PowerPoint。')
    pythoncom = importlib.import_module('pythoncom')
    client = importlib.import_module('win32com.client')
    app = doc = collection = None
    initial = None
    chunks, chars, truncated = [], 0, False

    def add(text, location):
        nonlocal chars, truncated
        text = normalize(text).strip()
        if not text:
            return
        remaining = MAX_TEXT - chars
        if len(text) > remaining:
            text, truncated = text[:remaining], True
        chars += len(text)
        for start in range(0, len(text), 1100):
            chunks.append({'text': text[start:start + 1200], 'location': location})

    pythoncom.CoInitialize()
    try:
        word = path.suffix.lower() in {'.doc', '.docx'}
        app = client.DispatchEx('Word.Application' if word else 'PowerPoint.Application')
        collection = app.Documents if word else app.Presentations
        initial = collection.Count
        # Fail closed: do not open the document if macro protection cannot be set.
        app.AutomationSecurity = 3
        app.Visible = True
        if word:
            doc = collection.Open(FileName=str(path), ReadOnly=True, AddToRecentFiles=False)
            # Word paragraph marks are CR. Soft line breaks (VT) remain within
            # the same numbered paragraph even though normalization displays LF.
            text = str(doc.Content.Text).replace('\r\n', '\r')
            for number, paragraph in enumerate(text.split('\r'), 1):
                add(paragraph, f'Word 正文第 {number} 段')
                if chars >= MAX_TEXT:
                    truncated = True
                    break
        else:
            doc = collection.Open(str(path), -1, 0, -1)

            def walk(shapes, page):
                nonlocal truncated
                for number in range(1, shapes.Count + 1):
                    if chars >= MAX_TEXT:
                        truncated = True
                        return
                    shape = shapes.Item(number)
                    if shape.Type == 6:
                        walk(shape.GroupItems, page)
                    if shape.HasTextFrame and shape.TextFrame.HasText:
                        add(shape.TextFrame.TextRange.Text, f'PPT 第 {page} 页')
                    if shape.HasTable:
                        table = shape.Table
                        for row in range(1, table.Rows.Count + 1):
                            add(' | '.join(str(table.Cell(row, col).Shape.TextFrame.TextRange.Text)
                                           for col in range(1, table.Columns.Count + 1)),
                                f'PPT 第 {page} 页 / 表格第 {row} 行')
                            if chars >= MAX_TEXT:
                                truncated = True
                                return
            for page in range(1, doc.Slides.Count + 1):
                walk(doc.Slides.Item(page).Shapes, page)
                if chars >= MAX_TEXT:
                    truncated = True
                    break
        return {'chunks': chunks, 'truncated': truncated}
    finally:
        if doc is not None:
            try:
                doc.Close(SaveChanges=0) if path.suffix.lower() in {'.doc', '.docx'} else doc.Close()
            except Exception:
                pass
        if app is not None and collection is not None and initial == 0:
            try:
                if collection.Count == 0:
                    app.Quit()
            except Exception:
                pass
        doc = collection = app = None
        pythoncom.CoUninitialize()

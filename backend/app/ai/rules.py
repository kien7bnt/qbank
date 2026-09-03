"""
Rule Manager for AI Question Generation
Reads, updates, and resets pedagogical rules stored in rule.md
"""
from __future__ import annotations
import os
from pathlib import Path

RULES_FILE = Path(__file__).parent.parent.parent / "rule.md"

DEFAULT_RULES = r"""# Quy tắc sư phạm sinh câu hỏi AI (AI Question Generation Rules)

## 1. Quy chuẩn độ dài và từ ngữ
- Phần dẫn (Stem) phải ngắn gọn, súc tích (khuyến nghị từ 15 đến 50 từ), không dài dòng lan man.
- Sử dụng ngôn ngữ chuẩn mực sư phạm, diễn đạt tường minh, không gây hiểu nhầm hoặc đa nghĩa.

## 2. Quy chuẩn mở đầu và cấu trúc câu hỏi
- Tránh các câu mở đầu sáo rỗng như: "Em hãy cho biết...", "Theo em...", "Dưới đây là...".
- Hãy sử dụng câu hỏi trực tiếp hoặc đưa ra tình huống thực tế/ngữ cảnh trước khi đặt câu hỏi.
- Đối với câu hỏi trắc nghiệm, phần dẫn phải nêu rõ câu hỏi trọng tâm (ví dụ: "Phát biểu nào sau đây là ĐÚNG?", "Giá trị của x bằng bao nhiêu?").

## 3. Quy chuẩn 4 phương án trả lời (Options)
- Cả 4 phương án (A, B, C, D) phải có độ dài tương đồng và cấu trúc ngữ pháp đồng nhất.
- Tuyệt đối KHÔNG sử dụng các phương án như: "Tất cả các ý trên đều đúng", "Tất cả các phương án trên đều sai", "Cả A và B đều đúng".
- Các phương án nhiễu (distractors) phải là các lỗi tư duy hoặc ngộ nhận phổ biến thực tế của học sinh, kèm lý giải bẫy tư duy thuyết phục.

## 4. Quy chuẩn định dạng công thức và số liệu
- Tất cả công thức toán học, vật lý, hóa học hoặc ký hiệu khoa học phải được định dạng chuẩn LaTeX (ví dụ: `$x^2 + y^2 = r^2$`, `$H_2SO_4$`, `$\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$`).
- Lời giải chi tiết phải chỉ rõ từng bước logic, công thức áp dụng hoặc trích dẫn kiến thức trọng tâm.
"""


def get_active_rules() -> str:
    """Lấy nội dung quy tắc active từ file rule.md (nếu chưa có thì tạo mới từ default)"""
    try:
        if RULES_FILE.exists():
            return RULES_FILE.read_text(encoding="utf-8")
        else:
            RULES_FILE.write_text(DEFAULT_RULES, encoding="utf-8")
            return DEFAULT_RULES
    except Exception:
        return DEFAULT_RULES


def save_active_rules(content: str) -> str:
    """Lưu nội dung quy tắc mới vào file rule.md"""
    content = content.strip() if content else DEFAULT_RULES
    RULES_FILE.write_text(content, encoding="utf-8")
    return content


def reset_to_default_rules() -> str:
    """Khôi phục quy tắc về mặc định chuẩn"""
    RULES_FILE.write_text(DEFAULT_RULES, encoding="utf-8")
    return DEFAULT_RULES

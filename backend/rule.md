# Quy tắc sư phạm sinh câu hỏi AI (AI Question Generation Rules)

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
- Tất cả công thức toán học, vật lý, hóa học hoặc ký hiệu khoa học phải được định dạng chuẩn LaTeX (ví dụ: `$x^2 + y^2 = r^2$`, `$H_2SO_4$`, `$\lim_{x \to 0} \frac{\sin x}{x} = 1$`).
- Lời giải chi tiết phải chỉ rõ từng bước logic, công thức áp dụng hoặc trích dẫn kiến thức trọng tâm.

## 5. Quy chuẩn mức độ nhận thức Bloom và Độ khó
- BẮT BUỘC tuân thủ nghiêm ngặt mức độ Bloom và độ khó mà người dùng đã chọn khi tạo câu hỏi.
- **Nhận biết (remember) / Dễ (easy)**: Kiểm tra trực tiếp định nghĩa, công thức cơ bản, 1 bước nhận diện.
- **Thông hiểu (understand) / Trung bình (medium)**: Giải thích, mô tả, áp dụng 1-2 bước tính toán cơ bản theo công thức.
- **Vận dụng (apply) / Trung bình - Khó (medium-hard)**: Áp dụng kiến thức vào bài toán có lời văn quen thuộc qua 2-3 bước giải.
- **Vận dụng cao (analyze / evaluate / create) / Khó (hard)**: BẮT BUỘC bài toán phải có tính phân loại cao, đòi hỏi tư duy logic nhiều tầng (tối thiểu 3-4 bước suy luận), liên hệ gián tiếp hoặc sử dụng phương pháp tư duy nâng cao (giả thiết tạm, tỉ số nâng cao, suy luận ngược, phân tích mối quan hệ gián tiếp, cực trị). TUYỆT ĐỐI KHÔNG sinh câu hỏi chỉ áp dụng công thức một cách đơn giản máy móc.

from __future__ import annotations
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, Role, UserRole
from app.models.curriculum import Chapter, Subject
from app.models.question import Question, QuestionOption, QuestionVersion
from app.services.analytics_service import compute_irt_params
from app.core.security import hash_password

DIDONG_QUESTIONS = [{'type': 'mcq',
  'stem': 'Phát triển ứng dụng trên hệ điều hành MAC sử dụng ngôn ngữ?',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'C Object', 'is_correct': True, 'order_index': 0},
              {'label': 'B', 'text': 'C#', 'is_correct': False, 'order_index': 1},
              {'label': 'C', 'text': 'Java', 'is_correct': False, 'order_index': 2},
              {'label': 'D', 'text': 'C General', 'is_correct': False, 'order_index': 3},
              {'label': 'E', 'text': 'C++', 'is_correct': False, 'order_index': 4}]},
 {'type': 'mcq',
  'stem': 'Các dịch vụ di động được phân làm 2 loại: dịch vụ các nhân và dịch vụ cộng đồng '
          '(personal and cummunity services). Dịch vụ SMS và chat là:',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'Các dịch vụ cá nhân', 'is_correct': False, 'order_index': 0},
              {'label': 'B',
               'text': 'Các dịch vụ cộng đồng.',
               'is_correct': False,
               'order_index': 1},
              {'label': 'C',
               'text': 'SMS là dịch vụ các nhân, Chat là dịch vụ cộng đồng',
               'is_correct': True,
               'order_index': 2},
              {'label': 'D',
               'text': 'Chat là dịch vụ các nhân, SMS là dịch vụ cộng đồng',
               'is_correct': False,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Lập trình di động được chia thành lập trình cho mấy thế hệ',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': '2', 'is_correct': False, 'order_index': 0},
              {'label': 'B', 'text': '3', 'is_correct': True, 'order_index': 1},
              {'label': 'C', 'text': '4', 'is_correct': False, 'order_index': 2},
              {'label': 'D', 'text': '5', 'is_correct': False, 'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Nền tảng (platform) là',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Sự liên kết giữa hệ điều hành và các trừu tượng',
               'is_correct': False,
               'order_index': 0},
              {'label': 'B',
               'text': 'Sự liên kết giữa phần cứng, hệ điều hành, ngôn ngữ lập trình và các trừu '
                       'tượng',
               'is_correct': False,
               'order_index': 1},
              {'label': 'C',
               'text': 'Sự liên kết giữa phần cứng và hệ điều hành',
               'is_correct': False,
               'order_index': 2},
              {'label': 'D',
               'text': 'Sự liên kết giữa hệ điều hành, ngôn ngữ lập trình và các trừu tượng',
               'is_correct': True,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Ứng dụng Phone Gap',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Là một SDK(Software Development Kit) - Bộ công cụ phát triển phần mềm cho '
                       'phép người lập trình làm các ứng dụng',
               'is_correct': False,
               'order_index': 0},
              {'label': 'B',
               'text': 'Là một nền tảng (platform) cho phép phát triển các ứng trên điện thoại di '
                       'động',
               'is_correct': True,
               'order_index': 1},
              {'label': 'C',
               'text': 'Là một công cụ lập trình',
               'is_correct': False,
               'order_index': 2}]},
 {'type': 'mcq',
  'stem': 'Lợi ích nhất của Phone Gap (Chọn 3)',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Cho phép người lập trình viết ở một lần chạy được nhiều nơi ( wirte one, '
                       'run everywhere)',
               'is_correct': True,
               'order_index': 0},
              {'label': 'B',
               'text': 'Dựa trên công nghệ web (HTML5, Css, Js) và mã nguồn mở',
               'is_correct': True,
               'order_index': 1},
              {'label': 'C',
               'text': 'Dựa trên các công cụ lập trình C#, Java, Android',
               'is_correct': False,
               'order_index': 2},
              {'label': 'D',
               'text': 'Cung cấp nhiều API cho phép thao tác tốt với các tính năng của thiết bị '
                       '(camera, GPS, Files, Contacts…..)',
               'is_correct': True,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Android hỗ trợ cho các nền tảng nào',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Đa tác vụ (Multitasking)',
               'is_correct': False,
               'order_index': 0},
              {'label': 'B', 'text': 'Kết nối (Bluetooth)', 'is_correct': False, 'order_index': 1},
              {'label': 'C',
               'text': 'Cuộc gọi trực tuyến (Video Calling)',
               'is_correct': False,
               'order_index': 2},
              {'label': 'D',
               'text': 'Tất cả các phương án trên',
               'is_correct': True,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'HIện tại Android được sở hữu bởi công ty nào',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'Apple', 'is_correct': False, 'order_index': 0},
              {'label': 'B', 'text': 'Google', 'is_correct': True, 'order_index': 1},
              {'label': 'C',
               'text': 'Là một công ty độc lập',
               'is_correct': False,
               'order_index': 2},
              {'label': 'D', 'text': 'Nokia', 'is_correct': False, 'order_index': 3},
              {'label': 'E', 'text': 'Microsoft', 'is_correct': False, 'order_index': 4}]},
 {'type': 'mcq',
  'stem': 'Đâu là các trạng thái trong vòng đời dịch vụ1. Bắt đầu (Start)2. Tạm dừng (Pause)3. '
          'Chạy chương trình (Running)4. Phá hủy (Destroy)5. Đợi (Wait)',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': '1, 2, 4', 'is_correct': True, 'order_index': 0},
              {'label': 'B', 'text': '1, 2, 3, 4, 5', 'is_correct': False, 'order_index': 1},
              {'label': 'C', 'text': '1, 2, 3, 4', 'is_correct': False, 'order_index': 2},
              {'label': 'D', 'text': '1, 2, 4, 5', 'is_correct': False, 'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Tệp nào sau đây trong Eclipse SDK Android giải thích các ứng dụng bao gồm',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'Mainfest', 'is_correct': True, 'order_index': 0},
              {'label': 'B', 'text': 'String XML', 'is_correct': False, 'order_index': 1},
              {'label': 'C', 'text': 'Layout File', 'is_correct': False, 'order_index': 2},
              {'label': 'D', 'text': 'R file', 'is_correct': False, 'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Hiện tại ở Việt Nam phổ biến các loại di động dùng các hệ điều hành và sử dụng ngôn ngữ '
          'lập trình gì',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Mac OS sử dụng ngôn ngữ C object trên công cụ X codeAndroid sử dụng ngôn '
                       'ngữ Java trên công cụ Eclipse - SDKWindow Phone sử dụng ngôn ngữ C# trên '
                       'công cụ Visual Studio',
               'is_correct': True,
               'order_index': 0},
              {'label': 'B',
               'text': 'Apple sử dụng ngôn ngữ C object trên công cụ X codeGoogle Play sử dụng '
                       'ngôn ngữ Java trên công cụ Eclipse - SDKWindow Phone sử dụng ngôn ngữ C# '
                       'trên công cụ Visual Studio',
               'is_correct': False,
               'order_index': 1},
              {'label': 'C',
               'text': 'Mac OS sử dụng ngôn ngữ C object trên công cụ X codeGoogle sử dụng ngôn '
                       'ngữ Java trên công cụ Eclipse - SDKNokia sử dụng ngôn ngữ C# trên công cụ '
                       'Visual Studio',
               'is_correct': False,
               'order_index': 2}]},
 {'type': 'mcq',
  'stem': 'APK là viết tắt của từ gì',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Application Package File',
               'is_correct': True,
               'order_index': 0},
              {'label': 'B',
               'text': 'Application Package Kit',
               'is_correct': False,
               'order_index': 1},
              {'label': 'C', 'text': 'Android Package Kit', 'is_correct': False, 'order_index': 2},
              {'label': 'D',
               'text': 'Android Package File',
               'is_correct': False,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Các thành phần của APK bao gồm',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'Nguồn (Resource)', 'is_correct': False, 'order_index': 0},
              {'label': 'B',
               'text': 'Các thực thi với máy ảo Delvilk',
               'is_correct': False,
               'order_index': 1},
              {'label': 'C', 'text': 'Cả a và b', 'is_correct': True, 'order_index': 2},
              {'label': 'D',
               'text': 'Không bao gồm thành phần nào',
               'is_correct': False,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Android không hỗ trợ định dạng nào',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'AVI', 'is_correct': True, 'order_index': 0},
              {'label': 'B', 'text': 'MP4', 'is_correct': False, 'order_index': 1},
              {'label': 'C', 'text': 'MPEG', 'is_correct': False, 'order_index': 2},
              {'label': 'D', 'text': 'MIDI', 'is_correct': False, 'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Android có hỗ trợ AWT và Swing (2 công cụ xây dựng giao diện, API của Java )',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'Yes', 'is_correct': False, 'order_index': 0},
              {'label': 'B', 'text': 'No', 'is_correct': True, 'order_index': 1}]},
 {'type': 'mcq',
  'stem': 'Xây dựng một ứng dụng Anroid người lập trình cần',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'SDK', 'is_correct': True, 'order_index': 0},
              {'label': 'B', 'text': 'JDK', 'is_correct': False, 'order_index': 1},
              {'label': 'C', 'text': 'ADK', 'is_correct': False, 'order_index': 2},
              {'label': 'D', 'text': 'MDK', 'is_correct': False, 'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Các công cụ làm ứng dụng Entertainment (Giải trí) (Chọn 3)',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'Unity', 'is_correct': True, 'order_index': 0},
              {'label': 'B', 'text': 'Game Maker Studio', 'is_correct': True, 'order_index': 1},
              {'label': 'C', 'text': 'Construct', 'is_correct': False, 'order_index': 2},
              {'label': 'D', 'text': 'Android Game', 'is_correct': True, 'order_index': 3},
              {'label': 'E',
               'text': 'Apple Entertainment',
               'is_correct': False,
               'order_index': 4}]},
 {'type': 'mcq',
  'stem': 'Lập trình di động được chia thành mấy phần',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Dành cho các ứng dụng dịch vụ (Application)Dành cho các ứng dụng giải tri '
                       '(Entertainment)',
               'is_correct': True,
               'order_index': 0},
              {'label': 'B',
               'text': 'Dành cho các ứng dụng dịch vụ (Application)Dành cho các ứng dụng giải tri '
                       '(Entertainment)Dành cho các ứng dụng ngân hàng (Banking)',
               'is_correct': False,
               'order_index': 1},
              {'label': 'C',
               'text': 'Dành cho các ứng dụng dịch vụ (Application)Dành cho các ứng dụng giải tri '
                       '(Entertainment)Dành cho các ứng dụng đa nhiệm (Mulltitasking)',
               'is_correct': False,
               'order_index': 2}]},
 {'type': 'mcq',
  'stem': 'Ứng dụng di động thực sự bùng nổ từ những năm bao nhiêu',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': '2007', 'is_correct': False, 'order_index': 0},
              {'label': 'B', 'text': '2008', 'is_correct': True, 'order_index': 1},
              {'label': 'C', 'text': '2009', 'is_correct': False, 'order_index': 2},
              {'label': 'D', 'text': '2010', 'is_correct': False, 'order_index': 3},
              {'label': 'E', 'text': '2011', 'is_correct': False, 'order_index': 4}]},
 {'type': 'mcq',
  'stem': 'Nền tảng (platform) là',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Sự liên kết giữa hệ điều hành và các trừu tượng',
               'is_correct': False,
               'order_index': 0},
              {'label': 'B',
               'text': 'Sự liên kết giữa phần cứng, hệ điều hành, ngôn ngữ lập trình và các trừu '
                       'tượng',
               'is_correct': True,
               'order_index': 1},
              {'label': 'C',
               'text': 'Sự liên kết giữa phần cứng và hệ điều hành',
               'is_correct': False,
               'order_index': 2},
              {'label': 'D',
               'text': 'Sự liên kết giữa hệ điều hành, ngôn ngữ lập trình và các trừu tượng',
               'is_correct': False,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Một Phalet là',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Một laptop với màn hình cảm ứng',
               'is_correct': False,
               'order_index': 0},
              {'label': 'B',
               'text': 'Một notebook với kích cỡ màn hình nhỏ từ 7 đến 9 inch với chức năng chính '
                       'là lướt web và đọc ebook',
               'is_correct': False,
               'order_index': 1},
              {'label': 'C',
               'text': 'Một PDA(Personal Digital Assistants)',
               'is_correct': False,
               'order_index': 2},
              {'label': 'D',
               'text': 'Một điện thoại kích cỡ màn hình từ 5 đến 6,5 inch được thiết kế kết hợp '
                       'chức năng của điện thoại thông minh và máy tính bảng',
               'is_correct': True,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Phiên bản cao nhất của Andorid hiện tại là bao nhiêu',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'Android 14', 'is_correct': False, 'order_index': 0},
              {'label': 'B', 'text': 'Android 13', 'is_correct': True, 'order_index': 1},
              {'label': 'C', 'text': 'Android 12', 'is_correct': False, 'order_index': 2},
              {'label': 'D', 'text': 'Android 11', 'is_correct': False, 'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Phiên bảo cao nhất của MacOS là bao nhiêu',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'Mac OS 10.15.7', 'is_correct': True, 'order_index': 0},
              {'label': 'B', 'text': 'MacOS 15', 'is_correct': False, 'order_index': 1},
              {'label': 'C', 'text': 'MacOS 10.14.6', 'is_correct': False, 'order_index': 2},
              {'label': 'D', 'text': 'MacOS 15.10.7', 'is_correct': False, 'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'MacOS là gi',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Hệ điều hành cho máy điện thoại',
               'is_correct': True,
               'order_index': 0},
              {'label': 'B',
               'text': 'Hệ điều hành cho máy để bàn',
               'is_correct': False,
               'order_index': 1},
              {'label': 'C',
               'text': 'Hệ điều hành cho máy xách tay',
               'is_correct': False,
               'order_index': 2},
              {'label': 'D',
               'text': 'Hệ điều hành cho máy tính nói chung',
               'is_correct': False,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Thế nào là lập trình di động',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Tạo ra phần mềm cho thiết bị di động',
               'is_correct': True,
               'order_index': 0},
              {'label': 'B',
               'text': 'Tạo ra phần mềm trên  điện thoại di động',
               'is_correct': False,
               'order_index': 1},
              {'label': 'C',
               'text': 'Tạo ra phần mềm chạy trên thiết bị điện tử',
               'is_correct': False,
               'order_index': 2},
              {'label': 'D',
               'text': 'Tạo ra phần mềm chạy trên internet',
               'is_correct': False,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Phiên bảo cao nhất của IOS là bao nhiêu',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'IOS 16', 'is_correct': True, 'order_index': 0},
              {'label': 'B', 'text': 'IOS 17', 'is_correct': False, 'order_index': 1},
              {'label': 'C', 'text': 'IOS 15', 'is_correct': False, 'order_index': 2},
              {'label': 'D', 'text': 'IOS 14', 'is_correct': False, 'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'IOS là viết tắt của từ gì',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'iPhone Operating System',
               'is_correct': True,
               'order_index': 0},
              {'label': 'B',
               'text': 'Iphone Operator System',
               'is_correct': False,
               'order_index': 1},
              {'label': 'C',
               'text': 'Iphone Operating Skills',
               'is_correct': False,
               'order_index': 2},
              {'label': 'D',
               'text': 'Iphone Operator Skills',
               'is_correct': False,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Hệ điều hành là gì',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Một phần mềm đặc biệt quản lý phần cứng và làm nền cho phần mềm khác',
               'is_correct': True,
               'order_index': 0},
              {'label': 'B',
               'text': 'Một hệ thống quản lý mọi thứ',
               'is_correct': False,
               'order_index': 1},
              {'label': 'C',
               'text': 'Một phần mềm cho hệ thống',
               'is_correct': False,
               'order_index': 2},
              {'label': 'D',
               'text': 'Một hệ thống đặc biệt',
               'is_correct': False,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Hàm chuyển đổi dữ liệu từ xâu sang số trong Android',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A', 'text': 'Float.ValueOf(String)', 'is_correct': True, 'order_index': 0},
              {'label': 'B', 'text': 'String.Conver(float)', 'is_correct': False, 'order_index': 1},
              {'label': 'C',
               'text': 'Float.IndexOf(String)',
               'is_correct': False,
               'order_index': 2},
              {'label': 'D',
               'text': 'Float.Convert(String)',
               'is_correct': False,
               'order_index': 3}]},
 {'type': 'mcq',
  'stem': 'Hàm chuyển đổi dữ liệu từ số sang xâu trong Android',
  'bloom_level': 'understand',
  'expected_difficulty': 'medium',
  'options': [{'label': 'A',
               'text': 'Float.ValueOf(String)',
               'is_correct': False,
               'order_index': 0},
              {'label': 'B', 'text': 'String.ValueOf(Float)', 'is_correct': True, 'order_index': 1},
              {'label': 'C',
               'text': 'Float.IndexOf(String)',
               'is_correct': False,
               'order_index': 2},
              {'label': 'D',
               'text': 'String.Convert(Float)',
               'is_correct': False,
               'order_index': 3}]}]


async def seed_didong_questions_for_nguyen_minh_huy(session: AsyncSession) -> int:
    """
    Tự động nạp 30 câu hỏi Lập trình di động (didong.xlsx) vào Ngân hàng câu hỏi
    của giảng viên Nguyen Minh Huy nếu chưa được nạp.
    """
    stmt = select(User).where(
        func.lower(User.full_name).in_(["nguyen minh huy", "nguyễn minh huy"])
    )
    res = await session.execute(stmt)
    users = list(res.scalars().all())

    if not users:
        # Tạo tài khoản giảng viên Nguyen Minh Huy nếu chưa tồn tại trong DB local
        new_teacher = User(
            email="nguyenminhhuy@edumate.vn",
            full_name="Nguyen Minh Huy",
            password_hash=hash_password("Teacher@123"),
            status="active",
        )
        session.add(new_teacher)
        await session.flush()
        for r_name in ["teacher", "student"]:
            r_res = await session.execute(select(Role).where(Role.name == r_name))
            role_obj = r_res.scalar_one_or_none()
            if role_obj:
                session.add(UserRole(user_id=new_teacher.id, role_id=role_obj.id))
        await session.flush()
        users = [new_teacher]

    # Tìm hoặc tạo Subject mặc định
    sub_res = await session.execute(select(Subject).limit(1))
    default_sub = sub_res.scalar_one_or_none()
    if not default_sub:
        default_sub = Subject(name="Công nghệ thông tin", code="IT", description="Lĩnh vực CNTT")
        session.add(default_sub)
        await session.flush()

    # Lấy tập item_id hiện có để sinh mã Qxxxx không trùng
    iid_res = await session.execute(select(Question.item_id))
    all_item_ids = set(iid_res.scalars().all())
    max_num = 0
    for iid in all_item_ids:
        if iid and iid.startswith("Q") and iid[1:].isdigit():
            try:
                num = int(iid[1:])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    next_num = max(max_num, len(all_item_ids))

    total_inserted = 0
    for target_user in users:
        # Tìm hoặc tạo lĩnh vực/chương "Lập trình di động" cho giảng viên này
        ch_stmt = select(Chapter).where(
            Chapter.created_by == target_user.id,
            Chapter.name == "Lập trình di động",
        )
        ch_res = await session.execute(ch_stmt)
        chapter = ch_res.scalar_one_or_none()
        if not chapter:
            chapter = Chapter(
                subject_id=default_sub.id,
                name="Lập trình di động",
                description="Ngân hàng câu hỏi Lập trình di động",
                created_by=target_user.id,
                order_index=1,
            )
            session.add(chapter)
            await session.flush()

        # Kiểm tra số lượng câu hỏi đã có trong chương này của giảng viên
        q_count_stmt = select(func.count(Question.id)).where(
            Question.created_by == target_user.id,
            Question.chapter_id == chapter.id,
            Question.status != "archived",
        )
        existing_count = (await session.execute(q_count_stmt)).scalar_one()
        if existing_count >= len(DIDONG_QUESTIONS):
            continue

        for q_data in DIDONG_QUESTIONS:
            next_num += 1
            while f"Q{next_num:04d}" in all_item_ids:
                next_num += 1
            item_id = f"Q{next_num:04d}"
            all_item_ids.add(item_id)

            q = Question(
                item_id=item_id,
                type="mcq",
                status="approved",
                stem=q_data["stem"],
                rationale=None,
                subject_id=default_sub.id,
                chapter_id=chapter.id,
                topic_id=None,
                bloom_level=q_data.get("bloom_level", "understand"),
                expected_difficulty=q_data.get("expected_difficulty", "medium"),
                in_exercise_bank=False,
                is_calibrated=False,
                response_count=0,
                created_by=target_user.id,
                version=1,
            )
            irt_a, irt_b, irt_c = compute_irt_params(q)
            q.irt_a = irt_a
            q.irt_b = irt_b
            q.irt_c = irt_c
            session.add(q)
            await session.flush()

            for idx, opt_data in enumerate(q_data["options"]):
                opt = QuestionOption(
                    question_id=q.id,
                    label=opt_data["label"],
                    text=opt_data["text"],
                    is_correct=opt_data["is_correct"],
                    order_index=opt_data.get("order_index", idx),
                )
                session.add(opt)

            snapshot = {
                "item_id": item_id,
                "type": "mcq",
                "stem": q_data["stem"],
                "bloom_level": q.bloom_level,
                "expected_difficulty": q.expected_difficulty,
                "chapter_id": str(chapter.id),
                "options": q_data["options"],
            }
            session.add(
                QuestionVersion(
                    question_id=q.id,
                    version_number=1,
                    snapshot=snapshot,
                    changed_by=target_user.id,
                )
            )
            total_inserted += 1

    return total_inserted

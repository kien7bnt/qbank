#!/bin/bash
{
set -euo pipefail

# ==============================================================================
# CẤU HÌNH THƯ MỤC DỰ ÁN TRÊN SERVER (Chỉ cần sửa biến PROJECT_DIR tại đây)
# ==============================================================================
PROJECT_DIR="/www/wwwroot/edumate.com.vn"
GIT_BRANCH="main"
COMPOSE_FILE="docker/docker-compose.yml"
WEB_USER="www"

# Lưu lại nội dung script hiện tại để tránh bị git reset --hard ghi đè về bản cũ
SELF_PATH="$(readlink -f "$0" 2>/dev/null || realpath "$0" 2>/dev/null || echo "$PROJECT_DIR/update.sh")"
SELF_CONTENT="$(cat "$SELF_PATH" 2>/dev/null || true)"

# Chuyển vào thư mục dự án
cd "$PROJECT_DIR"

# Tự động ghi toàn bộ log vào file update.log kèm ngày giờ
LOG_FILE="$PROJECT_DIR/update.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=================================================="
echo "🕒 Bắt đầu cập nhật lúc: $(date '+%Y-%m-%d %H:%M:%S')"
echo "📂 Thư mục dự án: $PROJECT_DIR (Nhánh: $GIT_BRANCH)"
echo "=================================================="

# 1. Kéo code mới nhất từ Git
git fetch origin "$GIT_BRANCH"
git reset --hard "origin/$GIT_BRANCH"

# Khôi phục lại file update.sh nếu git reset --hard vừa ghi đè bản cũ từ nhánh git
if [ -n "$SELF_CONTENT" ]; then
  printf '%s\n' "$SELF_CONTENT" | sudo tee "$PROJECT_DIR/update.sh" >/dev/null
fi

# Phân quyền thư mục dự án và khóa quyền chỉnh sửa file update.sh
if id "$WEB_USER" >/dev/null 2>&1; then
  sudo chown -R "$WEB_USER" "$PROJECT_DIR"
fi
if [ -f "$PROJECT_DIR/update.sh" ]; then
  sudo chown root:root "$PROJECT_DIR/update.sh"
  sudo chmod +x "$PROJECT_DIR/update.sh"
fi

# Tự động nhận diện vị trí file docker-compose (nếu repo nằm trong thư mục con qbank)
WORK_DIR="$PROJECT_DIR"
if [ ! -f "$WORK_DIR/$COMPOSE_FILE" ] && [ -f "$PROJECT_DIR/qbank/$COMPOSE_FILE" ]; then
  WORK_DIR="$PROJECT_DIR/qbank"
fi
cd "$WORK_DIR"

# 2. Đảm bảo file .env cho frontend luôn đầy đủ và đồng bộ
if [ -f "$PROJECT_DIR/.env" ] && [ ! -f "./frontend/.env" ]; then
  cp "$PROJECT_DIR/.env" "./frontend/.env"
fi
if [ -f "./frontend/.env.production" ] && [ ! -f "./frontend/.env" ]; then
  cp "./frontend/.env.production" "./frontend/.env"
elif [ -f "./frontend/.env" ] && [ ! -f "./frontend/.env.production" ]; then
  cp "./frontend/.env" "./frontend/.env.production"
elif [ ! -f "./frontend/.env" ]; then
  echo "VITE_API_URL=/api/v1" > "./frontend/.env"
  cp "./frontend/.env" "./frontend/.env.production"
fi

# Nạp biến môi trường từ frontend/.env vào shell để Docker Compose nhận diện
if [ -f "./frontend/.env" ]; then
  set -a
  source "./frontend/.env" 2>/dev/null || true
  set +a
fi

# 3. Tự động nhận diện lệnh Docker Compose (hỗ trợ cả 'docker compose' V2 và 'docker-compose' V1)
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "❌ Không tìm thấy 'docker compose' hoặc 'docker-compose' trên server."
  echo "👉 Chạy lệnh sau để cài đặt trên Ubuntu: sudo apt-get update && sudo apt-get install -y docker-compose-plugin"
  exit 1
fi
echo "ℹ️  Sử dụng lệnh: ${COMPOSE_CMD[*]}"

# 4. Build & Khởi động Docker
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" up -d --build --renew-anon-volumes --remove-orphans

# 5. Kiểm tra trạng thái các container và dọn dẹp image cũ
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" ps
docker image prune -f

echo "✅ Cập nhật hoàn tất lúc: $(date '+%Y-%m-%d %H:%M:%S')"
exit 0
}

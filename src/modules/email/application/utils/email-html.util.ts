// Escape dữ liệu động trước khi chèn vào HTML email để tên shop hoặc mã hồ sơ không thể tạo markup ngoài ý muốn.
export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Loại bỏ ký tự xuống dòng khỏi subject để dữ liệu người dùng không thể chèn thêm email header.
export function sanitizeEmailSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

// Định dạng thời gian sự kiện theo múi giờ Việt Nam; dữ liệu lỗi vẫn có fallback thay vì làm hỏng toàn bộ email.
export function formatVietnameseDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Vừa xong";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

// Định dạng số tiền hoàn theo VND, không hiển thị phần thập phân không có ý nghĩa.
export function formatVietnameseMoney(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

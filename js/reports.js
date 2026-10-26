// Sơn: báo cáo downtime. Tổng phút chỉ tính từ hai mốc downtime hợp lệ.
import { mutate, wrap, LwError as E } from "./store.js";
import { now } from "./incident-flow.js";

/**
 * Tính số phút downtime hợp lệ của một sự cố
 */
export const downtimeMinutes = (i) => {
  if (!i.downtimeStartAt || !i.downtimeEndAt) return null;
  const m = (new Date(i.downtimeEndAt) - new Date(i.downtimeStartAt)) / 6e4;
  return m >= 0 ? Math.round(m) : null;
};

/**
 * Lấy danh sách toàn bộ báo cáo
 */
export const getReports = () => wrap((d) => d.reports);

/**
 * Tạo mới hoặc cập nhật báo cáo sự cố/downtime
 */
export const saveReport = (p) =>
  mutate((d) => {
    // 1. Kiểm tra ca làm việc (shift)
    const sh = d.shifts.find((s) => s.id === p.shiftId);
    if (!sh) throw new E("NOT_FOUND", "Không tìm thấy ca làm việc");

    // 2. Kiểm tra trạng thái báo cáo hợp lệ
    if (!["draft", "ready", "archived"].includes(p.status)) {
      throw new E("VALIDATION_ERROR", "Trạng thái báo cáo không hợp lệ");
    }

    // 3. Kiểm tra mốc thời gian bắt đầu - kết thúc
    if (new Date(p.from) > new Date(p.to)) {
      throw new E("VALIDATION_ERROR", "Mốc bắt đầu phải trước mốc kết thúc");
    }

    // 4. Kiểm tra các sự cố có tồn tại hay không
    const ids = p.incidentIds || [];
    const inc = ids.map((x) => d.incidents.find((i) => i.id === x));
    if (inc.some((i) => !i))
      throw new E("NOT_FOUND", "Báo cáo có sự cố không tồn tại");

    // 5. Kiểm tra báo cáo hiện tại (nếu đang chỉnh sửa)
    let r = p.id ? d.reports.find((x) => x.id === p.id) : null;
    if (p.id && !r) throw new E("NOT_FOUND", `Không tìm thấy báo cáo ${p.id}`);
    if (r && r.status === "archived")
      throw new E("INVALID_TRANSITION", "Báo cáo đã lưu trữ");

    const t = now();

    // 6. Tạo mới báo cáo nếu chưa tồn tại
    if (!r) {
      r = {
        id: `BC-${sh.id.split("-")[0]}-${1001 + d.reports.length}`,
        generatedAt: t,
        archivedAt: null,
      };
      d.reports.push(r);
    }

    // 7. Cập nhật dữ liệu cho báo cáo
    Object.assign(r, {
      shiftId: p.shiftId,
      from: p.from,
      to: p.to,
      incidentIds: ids,
      totalDowntimeMinutes: inc.reduce(
        (a, i) => a + (downtimeMinutes(i) || 0),
        0,
      ),
      status: p.status,
      archivedAt: p.status === "archived" ? t : null,
    });

    return r;
  });

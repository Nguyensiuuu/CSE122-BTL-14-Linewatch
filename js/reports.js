// Sơn: báo cáo downtime. Tổng phút chỉ tính từ hai mốc downtime hợp lệ.
import { mutate, wrap, LwError as E } from "./store.js";
import { now } from "./incident-flow.js";
import { getActiveSession } from './auth.js';

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
    if (getActiveSession()?.role !== 'admin') throw new E('FORBIDDEN', 'Chỉ quản trị viên được lưu báo cáo.');
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
    if (inc.some(i => i.shiftId !== sh.id))
      throw new E('VALIDATION_ERROR', 'Sự cố trong báo cáo phải thuộc ca đã chọn.');
    if (p.lineId && (!d.lines.some(line => line.id === p.lineId) ||
        inc.some(item => item.lineId !== p.lineId)))
      throw new E('VALIDATION_ERROR', 'Dây chuyền lọc không khớp các sự cố trong báo cáo.');
    if (p.ai3TaskId && p.status !== 'archived') {
      const aiTask = d.maintenanceTasks.find(task => task.id === p.ai3TaskId);
      const aiIncident = d.incidents.find(item => item.id === aiTask?.incidentId);
      if (!aiTask || !['accepted', 'edited'].includes(aiTask.ai3?.status) ||
          !inc.some(item => item.machineId === aiIncident?.machineId))
        throw new E('VALIDATION_ERROR', 'Gợi ý AI-3 phải được chấp nhận và thuộc máy có trong báo cáo.');
    }

    // 5. Kiểm tra báo cáo hiện tại (nếu đang chỉnh sửa)
    let r = p.id ? d.reports.find((x) => x.id === p.id) : null;
    if (p.id && !r) throw new E("NOT_FOUND", `Không tìm thấy báo cáo ${p.id}`);
    if (p.status === 'archived' && !r)
      throw new E('INVALID_TRANSITION', 'Chỉ lưu trữ được báo cáo đã tạo.');
    if (r && r.status === "archived")
      throw new E("INVALID_TRANSITION", "Báo cáo đã lưu trữ");

    const t = now();
    // Lưu trữ giữ nguyên số liệu và gợi ý đã chốt trong bản báo cáo.
    if (r && p.status === 'archived') {
      r.status = 'archived'; r.archivedAt = t;
      return r;
    }

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
      lineId: p.lineId || null,
      from: p.from,
      to: p.to,
      incidentIds: ids,
      ai3TaskId: p.ai3TaskId || null,
      ai3Summary: p.ai3TaskId
        ? d.maintenanceTasks.find(task => task.id === p.ai3TaskId)?.ai3?.suggestion?.recommendation || null
        : null,
      totalDowntimeMinutes: inc.reduce(
        (a, i) => a + (downtimeMinutes(i) || 0),
        0,
      ),
      status: p.status,
      archivedAt: p.status === "archived" ? t : null,
    });

    return r;
  });

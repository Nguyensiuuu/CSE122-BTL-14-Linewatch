/**
 * Self-check chạy trong trình duyệt (mở qua Live Server, vào /self-check.html).
 * Kiểm thử luồng: INC mới → accept → assign (tạo MT) → resolved → closed.
 */
import {
  acceptIncident,
  assignIncident,
  closeIncident,
  getIncidents,
  getTasks,
  getCurrentUser,
  loginDemo,
} from "./js/api.js";

const out = [];
const log = (ok, msg) => {
  out.push(`${ok ? "PASS" : "FAIL"} ${msg}`);
  console[ok ? "log" : "error"](ok ? "✓" : "✗", msg);
};
const assert = (cond, msg) => log(!!cond, msg);

// 1. Đăng nhập supervisor
const login = await loginDemo("supervisor");
assert(login.ok, "login supervisor ok");

// 2. Tạo INC mới (dùng store trực tiếp để seed)
const { load } = await import("./js/store.js");
const d = await load();
const newInc = {
  id: "INC-TEST-01",
  lineId: "L01",
  machineId: "M-101",
  shiftId: d.shifts[0].id,
  title: "Test incident",
  description: "Test",
  category: "mechanical",
  priority: "high",
  status: "new",
  reportedById: "USR-OP-01",
  assignedToId: null,
  reportedAt: new Date().toISOString(),
  acceptedAt: null,
  assignedAt: null,
  startedAt: null,
  resolvedAt: null,
  closedAt: null,
  cancelledAt: null,
  downtimeStartAt: null,
  downtimeEndAt: null,
  ai1: null,
};
d.incidents.push(newInc);
localStorage.setItem("linewatch.v1", JSON.stringify(d));

// 3. Accept
const acc = await acceptIncident("INC-TEST-01");
assert(acc.ok && acc.data.status === "accepted", "accept new→accepted");

// 4. Assign (tạo MT)
const asg = await assignIncident("INC-TEST-01", "USR-MT-01");
assert(asg.ok && asg.data.status === "assigned", "assign accepted→assigned");
const tasks = await getTasks();
const mt = tasks.data.find((t) => t.incidentId === "INC-TEST-01");
assert(!!mt, "MT được tạo cho INC-TEST-01");
assert(mt && mt.assigneeId === "USR-MT-01", "MT assigneeId = USR-MT-01");

// 5. Không cho assign lại (DUPLICATE_ID)
const dup = await assignIncident("INC-TEST-01", "USR-MT-01");
assert(!dup.ok && dup.error.code === "DUPLICATE_ID", "assign lại bị chặn (DUPLICATE_ID)");

// 6. Giả lập resolved (Nguyên sẽ làm, nhưng để test close thì set trực tiếp)
const d2 = await load();
const inc2 = d2.incidents.find((i) => i.id === "INC-TEST-01");
inc2.status = "resolved";
inc2.resolvedAt = new Date().toISOString();
localStorage.setItem("linewatch.v1", JSON.stringify(d2));

// 7. Close
const cls = await closeIncident("INC-TEST-01");
assert(cls.ok && cls.data.status === "closed", "close resolved→closed");
assert(!!cls.data.closedAt, "closedAt được ghi");

// 8. Không cho close lại
const cls2 = await closeIncident("INC-TEST-01");
assert(!cls2.ok && cls2.error.code === "INVALID_TRANSITION", "close lại bị chặn (INVALID_TRANSITION)");

// 9. Kiểm tra getCurrentUser
const cu = await getCurrentUser();
assert(cu.ok && cu.data && cu.data.role === "supervisor", "getCurrentUser trả về supervisor");

// Hiển thị kết quả
document.body.innerHTML = `<pre style="font:14px/1.6 monospace;padding:20px">${out.join("\n")}</pre>`;

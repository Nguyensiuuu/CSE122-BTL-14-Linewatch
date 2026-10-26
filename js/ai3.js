import { readStore } from './store.js';

const success = data => ({ ok: true, data, error: null });
const failure = (code, message) => ({ ok: false, data: null, error: { code, message } });

export async function analyzeMachine({ machineId }) {
  if (!machineId) return failure('VALIDATION_ERROR', 'Chọn máy cần phân tích.');
  try {
    const data = await readStore();
    if (!data.machines.some(machine => machine.id === machineId))
      return failure('NOT_FOUND', 'Máy không có trong dữ liệu chung.');
    const completed = data.incidents.filter(item => item.machineId === machineId &&
      ['resolved', 'closed'].includes(item.status) &&
      data.maintenanceTasks.some(task => task.incidentId === item.id && task.status === 'done'));
    const groups = new Map();
    for (const item of completed) {
      const key = item.category || 'other';
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    const repeated = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (!repeated || repeated[1].length < 2)
      return failure('NO_EVIDENCE', 'Chưa có ít nhất hai sự cố đã xử lý cùng nhóm trên máy này. Kỹ thuật viên vẫn có thể nhập tay.');
    const [category, items] = repeated;
    const names = { mechanical: 'cơ khí', electrical: 'điện', quality: 'chất lượng', other: 'khác' };
    const recent = items.slice(-3);
    const actions = recent.map(incident => data.maintenanceTasks.find(task => task.incidentId === incident.id)?.action)
      .filter(Boolean);
    const recommendation = actions.at(-1) || 'Kiểm tra nguyên nhân đã ghi trong lịch sử trước khi vận hành lại.';
    return success({
      kind: 'maintenance-pattern',
      suggestion: { pattern: `Sự cố ${names[category] || category} lặp lại`,
        incidentIds: items.map(item => item.id), recommendation },
      reason: `Có ${items.length} sự cố cùng nhóm đã xử lý trên ${machineId}.`,
      confidence: Math.min(0.9, 0.6 + items.length * 0.1),
      source: 'mock-rule',
      references: items.map(item => item.id)
    });
  } catch (error) { return failure('STORAGE_ERROR', error.message); }
}

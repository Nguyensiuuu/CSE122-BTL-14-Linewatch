/**
 * js/modules/shared/store.js
 * Kho trạng thái dùng chung: nạp dữ liệu qua api.js, giữ bản sao trong bộ nhớ,
 * phát tín hiệu cho các khung cùng cập nhật. Không khung nào tự đọc
 * localStorage hay tự fetch seed.json.
 *
 * Cách dùng trong một khung:
 *   import { store } from "./shared/store.js";
 *   await store.load();                 // nạp lần đầu
 *   store.subscribe(() => render());    // vẽ lại khi dữ liệu đổi
 *   const { lines, machines, incidents } = store.getState();
 */

import {
  listLines,
  listMachines,
  listIncidents,
  getSession,
  loadSeed,
  toApiError
} from "./api.js";

const EMPTY_STATE = {
  status: "idle", // idle | loading | ready | error
  error: null,
  lines: [],
  machines: [],
  incidents: [],
  session: null,
  loadedAt: null
};

const listeners = new Set();
let state = { ...EMPTY_STATE };
let inflight = null;

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.error("[store] Lỗi trong listener:", error);
    }
  });
}

function normaliseSession(session) {
  if (!session) return null;
  const user = session.user || null;
  return {
    ...session,
    user: user
      ? {
          ...user,
          name: user.name || "Công nhân vận hành",
          role: user.role || "operator"
        }
      : null
  };
}

export const store = {
  getState() {
    return state;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Nạp toàn bộ dữ liệu cần cho các khung; gọi nhiều lần vẫn an toàn. */
  async load({ force = false } = {}) {
    if (inflight) return inflight;
    if (state.status === "ready" && !force) return state;

    setState({ status: "loading", error: null });

    inflight = (async () => {
      try {
        await loadSeed();
        const [lines, machines, incidents] = await Promise.all([listLines(), listMachines(), listIncidents()]);
        setState({
          status: "ready",
          error: null,
          lines,
          machines,
          incidents,
          session: normaliseSession(getSession()),
          loadedAt: new Date().toISOString()
        });
        return state;
      } catch (error) {
        const apiError = toApiError(error, "Không tải được dữ liệu LineWatch.");
        setState({ status: "error", error: apiError });
        throw apiError;
      } finally {
        inflight = null;
      }
    })();

    return inflight;
  },

  /** Nạp lại sau khi ghi dữ liệu (api.js đã phát sự kiện linewatch:data-changed). */
  async refresh() {
    return this.load({ force: true });
  },

  /** Cập nhật nhanh một sự cố trong bộ nhớ để UI phản hồi tức thì. */
  patchIncident(incidentId, patch) {
    const incidents = state.incidents.map((incident) =>
      incident.id === incidentId ? { ...incident, ...patch } : incident
    );
    setState({ incidents });
  },

  patchLine(lineId, patch) {
    const lines = state.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line));
    setState({ lines });
  },

  setSession(session) {
    setState({ session: normaliseSession(session) });
  },

  reset() {
    setState({ ...EMPTY_STATE });
  }
};
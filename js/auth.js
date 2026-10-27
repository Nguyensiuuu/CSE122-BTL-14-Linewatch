const SESSION_KEY = "linewatch.v1.session";
const STORE_KEY = "linewatch.v1";

export function getActiveSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!session?.userId) return null;

    const store = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    const user = store?.users?.find((item) => item.id === session.userId);
    return { ...session, role: user?.role };
  } catch {
    return null;
  }
}

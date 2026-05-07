// tests/fixtures/real-world-app/src/ultimateApi.ts
export const useGetUser = () => ({ data: { id: 0, name: "", avatar: "" }, isLoading: false });
export const useGetOrder = () => ({ data: { id: "", total: 0, currency: "" }, isLoading: false });
export const useGetStatus = () => ({ data: { online: false, lastSeen: "" }, isLoading: false });
export const useGetProducts = () => ({ data: [{ id: 0, name: "", price: 0 }], isLoading: false });
export const useGetNotifications = () => ({ data: [{ id: "", message: "", timestamp: "" }], isLoading: false });
export const useGetSales = () => ({ data: [{ month: "", amount: 0 }], isLoading: false });
export const useGetItems = () => ({ data: [{ id: 0, title: "", tags: [""] }], isLoading: false });
export const useGetTableData = () => ({ data: { columns: [], rows: [] }, isLoading: false });
export const useUpdateUser = () => ({ mutate: (data: any) => {} });
export const useGetMessages = () => ({ data: [{ id: 0, text: "", sender: "", timestamp: 0 }], isLoading: false });
export const useGetChartPoints = () => ({ data: [{ x: 0, y: 0 }], isLoading: false });
export const useGetTeam = () => ({ data: [{ id: 0, name: "", department: "" }], isLoading: false });
export const useGetAuth = () => ({ data: { isAuthenticated: false, permissions: [""] }, isLoading: false });
export const useGetTree = () => ({ data: { id: "", label: "", children: [] }, isLoading: false });

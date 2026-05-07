// tests/fixtures/real-world-app/src/hardApi.ts
export const useGetUser = () => ({ data: { id: 0, name: "", avatar: "", status: "" }, isLoading: false });
export const useGetOrders = () => ({ data: [{ id: "", total: 0, status: "" }], isLoading: false });
export const useGetProfile = () => ({ data: { name: "", email: "", bio: "", joined: "" }, isLoading: false });
export const useGetFeatures = () => ({ data: { darkMode: false, betaAccess: false, notifications: false }, isLoading: false });
export const useGetAddress = () => ({ data: { street: "", city: "", zip: "" }, isLoading: false });
export const useGetAllUsers = () => ({ data: [{ id: 0, name: "", active: false }], isLoading: false });
export const useGetTransactions = () => ({ data: [{ id: 0, amount: 0, currency: "" }], isLoading: false });
export const useGetProducts = () => ({ data: [{ id: 0, name: "", price: 0 }], isLoading: false });
export const useGetSettings = () => ({ data: { theme: "", language: "", notifications: false }, isLoading: false });
export const useGetItems = () => ({ data: [{ id: 0, title: "", tags: [""] }], isLoading: false });
export const useGetStats = () => ({ data: { users: 0, revenue: 0, growth: 0 }, isLoading: false });
export const useGetChartData = () => ({ data: [{ label: "", value: 0 }], isLoading: false });
export const useGetAuth = () => ({ data: { isAuthenticated: false, user: { id: 0, role: "" }, permissions: [""] }, isLoading: false });
export const useGetActivities = () => ({ data: [{ id: 0, action: "", timestamp: 0 }], isLoading: false });

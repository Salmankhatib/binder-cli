// tests/fixtures/real-world-app/src/api.ts
export const useGetDashboardStats = () => ({ data: { users: 0, revenue: 0 }, isLoading: false });
export const useGetUsers = () => ({ data: [{ id: 0, name: "", role: "" }], isLoading: false });
export const useGetInvoices = () => ({ data: [{ id: "", amount: 0, status: "" }], isLoading: false });
export const useUpdateUser = () => ({ mutate: (data: any) => {} });
export const useDeleteInvoice = () => ({ mutate: (id: string) => {} });
export const useGetSettings = () => ({ data: { theme: "", notifications: false }, isLoading: false });
export const useGetAdminLogs = () => ({ data: [""], isLoading: false });
export const useGetTableCols = () => ({ data: { id: "", name: "" }, isLoading: false });
export const useGetSearchResults = () => ({ data: [{ title: "" }], isLoading: false });
export const useGetAuthUser = () => ({ data: { isAdmin: false }, isLoading: false });
export const useGetTheme = () => ({ data: "light", isLoading: false });
export const useGetUserDetail = (id: number) => ({ data: { id: 0, name: "", bio: "" }, isLoading: false });
export const useGetProfile = () => ({ data: { name: "", email: "" }, isLoading: false });
export const useGetChartData = () => ({ data: [{ label: "", value: 0 }], isLoading: false });

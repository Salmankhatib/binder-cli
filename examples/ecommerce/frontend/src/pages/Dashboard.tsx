import { useGetSalesApiSalesGet } from "../generated/api";

export default function Dashboard() {
    const { data: MOCK_SALES, isLoading: MOCK_SALESLoading } = useGetSalesApiSalesGet();
  return (
    <div>
      <h1>Sales Dashboard</h1>
      <table>
        {MOCK_SALES.map(sale => (
          <tr key={sale.id}>
            <td>{sale.customer_name}</td>
            <td>{sale.total_amount}</td>
          </tr>
        ))}
      </table>
    </div>
  );
}

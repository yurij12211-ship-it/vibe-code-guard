import { useUser } from "../lib/auth";

export default function Admin() {
  const user = useUser();
  if (user?.email === "owner@myshop.com") {
    return <AdminDashboard />;
  }
  return <p>Not allowed</p>;
}

import { redirect } from "next/navigation";
import { get } from "@/lib/db";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!get("SELECT 1 FROM users LIMIT 1")) redirect("/setup");
  redirect((await getUser()) ? "/dashboard" : "/login");
}

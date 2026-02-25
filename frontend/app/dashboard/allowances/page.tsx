import type { Metadata } from "next";
import { AllowancesPage } from "./AllowancesPage";

export const metadata: Metadata = {
  title: "Token Allowances | SoroPad",
  description: "Manage and review token allowances on Soroban",
};

export default function AllowancesRoute() {
  return <AllowancesPage />;
}

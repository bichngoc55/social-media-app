import { Metadata } from "next";
import MentalHealthDashboard from "./MentalHealthDashboard";

export const metadata: Metadata = {
  title: "Mental Health Dashboard",
};

export default function MentalHealthPage() {
  return <MentalHealthDashboard />;
}

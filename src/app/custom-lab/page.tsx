import { CustomLabLayout } from "@/components/CustomLab/CustomLabLayout";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Custom Lab | Iron Forge Cutelaria",
  description: "Customize your perfect blade in our state-of-the-art configuration lab.",
};

export default function CustomLabPage() {
  return (
    <main className="min-h-screen bg-[#111111] selection:bg-[#8B0000] selection:text-white">
      <CustomLabLayout />
    </main>
  );
}

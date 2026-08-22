import { CustomLabLayout } from '@/components/CustomLab/CustomLabLayout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Custom Lab | Iron Forge Cutelaria',
  description: 'Monte sua faca personalizada no configurador premium da Iron Forge.',
};

export default function CustomizerPage() {
  return (
    <main className="min-h-screen bg-[#080808] selection:bg-[#8B0000] selection:text-white">
      <CustomLabLayout />
    </main>
  );
}

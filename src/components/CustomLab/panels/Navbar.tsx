'use client';

import Link from 'next/link';
import { useLabStore } from '@/store/useLabStore';
import { Hammer, Download, Save, ScanSearch, Edit3 } from 'lucide-react';
import { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export function Navbar() {
  const { editMode, setEditMode, viewMode, setViewMode, config, points } = useLabStore();
  const [projectName, setProjectName] = useState('Untitled Project');
  const [isEditingName, setIsEditingName] = useState(false);

  const handleExportPDF = async () => {
    const canvasContainer = document.querySelector('main > div.flex-1.relative.w-full.h-full') as HTMLElement;
    if (!canvasContainer) {
      alert('Não foi possível encontrar a área de desenho para exportar.');
      return;
    }

    try {
      const canvas = await html2canvas(canvasContainer, {
        backgroundColor: '#050505',
        scale: 2,
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgRatio = imgProps.width / imgProps.height;
      const pdfRatio = pdfWidth / pdfHeight;
      
      let finalWidth, finalHeight;
      if (imgRatio > pdfRatio) {
        finalWidth = pdfWidth;
        finalHeight = pdfWidth / imgRatio;
      } else {
        finalHeight = pdfHeight;
        finalWidth = pdfHeight * imgRatio;
      }
      
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;
      
      pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
      pdf.save(`iron-forge-${projectName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert('Ocorreu um erro ao gerar o PDF.');
    }
  };

  const handleSaveProject = () => {
    const projectData = {
      name: projectName,
      config,
      points,
      savedAt: new Date().toISOString(),
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `projeto-${projectName.replace(/\s+/g, '-').toLowerCase()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleStructuralAnalysis = () => {
    let score = 100;
    const warnings = [];

    if (config.bladeThickness < 3 && config.bladeLength > 20) {
      score -= 20;
      warnings.push("⚠️ Lâmina muito longa para a espessura atual. Risco de entortamento.");
    }
    if (!config.isFullTang && config.bladeLength > 25) {
      score -= 15;
      warnings.push("⚠️ Lâminas muito longas com Hidden Tang são menos resistentes para uso pesado.");
    }
    if (config.hasSkullCrusher && !config.isFullTang) {
      score -= 10;
      warnings.push("⚠️ Quebra-crânio em Hidden Tang pode danificar o cabo no impacto.");
    }

    if (warnings.length === 0) {
      alert(`✅ Análise Estrutural: Excelente! (Nota: ${score}/100)\nA estrutura da faca está segura para as dimensões especificadas.`);
    } else {
      alert(`⚠️ Análise Estrutural (Nota: ${score}/100)\n\n${warnings.join('\n\n')}`);
    }
  };

  return (
    <nav className="h-20 w-full bg-[#050505] border-b border-[#1a1a1a] flex items-center justify-between px-3 sm:px-4 z-50 relative shrink-0">
      
      {/* Left: Logo & Project Name */}
      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="bg-[#111111] p-2 rounded-md border border-[#222] group-hover:border-[#8B0000] transition-colors">
            <Hammer className="w-5 h-5 text-white group-hover:text-[#8B0000] transition-colors" />
          </div>
          <span className="text-white font-bold tracking-widest text-sm uppercase hidden lg:inline-block">Iron Forge</span>
        </Link>

        <div className="h-5 w-px bg-[#222] hidden lg:block"></div>

        <div className="flex items-center gap-2 text-sm text-gray-400 min-w-0 hidden sm:flex">
          {isEditingName ? (
            <input 
              autoFocus
              type="text" 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
              className="bg-[#111111] border border-[#333] text-white px-2 py-1 rounded text-sm w-36 sm:w-48 outline-none focus:border-[#8B0000]"
            />
          ) : (
            <span 
              onClick={() => setIsEditingName(true)}
              className="hover:text-white cursor-pointer transition-colors px-2 py-1 rounded hover:bg-[#111111] truncate max-w-[100px] md:max-w-[180px] lg:max-w-none text-sm"
            >
              {projectName}
            </span>
          )}
          <span className="text-[10px] bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gray-500 hidden xl:inline-block">Modificado</span>
        </div>
      </div>

      {/* Center: Edit Mode Toggle */}
      <div className="flex items-center gap-3 sm:gap-4 bg-[#0a0a0a] p-2 sm:p-2 rounded-lg border border-[#1a1a1a] shrink-0 mx-2 sm:mx-4">
        <button
          onClick={() => { setEditMode(false); setViewMode('mechanic'); }}
          className={`shrink-0 px-5 sm:px-6 py-3 text-base sm:text-lg font-medium rounded-md transition-all ${
            !editMode && viewMode === 'mechanic' ? 'bg-[#222] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="whitespace-nowrap">Mecânico</span>
        </button>
        <button
          onClick={() => { setEditMode(false); setViewMode('3d'); }}
          className={`shrink-0 px-5 sm:px-6 py-3 text-base sm:text-lg font-medium rounded-md transition-all ${
            !editMode && viewMode === '3d' ? 'bg-[#222] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          3D
        </button>
        <button
          onClick={() => { setEditMode(true); setViewMode('mechanic'); }}
          className={`shrink-0 px-5 sm:px-6 py-3 text-base sm:text-lg font-medium rounded-md transition-all flex items-center gap-2 ${
            editMode ? 'bg-[#8B0000] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Edit3 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
          <span className="whitespace-nowrap">Editar</span>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button 
          onClick={handleStructuralAnalysis}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors p-2.5 rounded-lg hover:bg-[#111111] active:scale-95" 
          title="Análise Estrutural"
        >
          <ScanSearch className="w-5 h-5" />
          <span className="hidden xl:inline text-xs">Análise</span>
        </button>
        
        <button 
          onClick={handleExportPDF}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors p-2.5 rounded-lg hover:bg-[#111111] active:scale-95" 
          title="Exportar PDF"
        >
          <Download className="w-5 h-5" />
          <span className="hidden xl:inline text-xs">PDF</span>
        </button>
        
        <button 
          onClick={handleSaveProject}
          className="flex items-center gap-1.5 bg-white text-black hover:bg-gray-200 transition-colors p-2.5 sm:px-4 sm:py-2 rounded-lg font-medium active:scale-95" 
          title="Salvar Projeto"
        >
          <Save className="w-5 h-5 sm:w-4 sm:h-4" />
          <span className="hidden md:inline text-sm">Salvar</span>
        </button>
      </div>
    </nav>
  );
}

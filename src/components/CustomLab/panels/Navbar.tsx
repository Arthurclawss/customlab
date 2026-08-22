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
    <nav className="h-12 w-full bg-[#050505] border-b border-[#1a1a1a] flex items-center justify-between px-2 sm:px-4 z-50 relative shrink-0">
      
      {/* Left: Logo & Project Info */}
      <div className="flex items-center gap-2 sm:gap-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-[#111111] p-1.5 rounded-md border border-[#222] group-hover:border-[#8B0000] transition-colors">
            <Hammer className="w-4 h-4 text-white group-hover:text-[#8B0000] transition-colors" />
          </div>
          <span className="text-white font-bold tracking-widest text-xs sm:text-sm uppercase hidden xs:inline-block">Iron Forge</span>
        </Link>

        <div className="h-4 w-px bg-[#222] hidden sm:block"></div>

        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
          {isEditingName ? (
            <input 
              autoFocus
              type="text" 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
              className="bg-[#111111] border border-[#333] text-white px-2 py-0.5 rounded text-xs sm:text-sm w-28 sm:w-48 outline-none focus:border-[#8B0000]"
            />
          ) : (
            <span 
              onClick={() => setIsEditingName(true)}
              className="hover:text-white cursor-pointer transition-colors px-2 py-0.5 rounded hover:bg-[#111111] truncate max-w-[80px] sm:max-w-none"
            >
              {projectName}
            </span>
          )}
          <span className="text-[10px] bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gray-500 hidden md:inline-block">Modificado</span>
        </div>
      </div>

      {/* Center: Edit Mode Toggle */}
      <div className="flex items-center gap-1 sm:gap-2 bg-[#0a0a0a] p-1 rounded-md border border-[#1a1a1a]">
        <button
          onClick={() => { setEditMode(false); setViewMode('mechanic'); }}
          className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded transition-colors ${
            !editMode && viewMode === 'mechanic' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="hidden sm:inline">Modelo Mecânico</span>
          <span className="sm:hidden">Mecânico</span>
        </button>
        <button
          onClick={() => { setEditMode(false); setViewMode('3d'); }}
          className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded transition-colors ${
            !editMode && viewMode === '3d' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="hidden sm:inline">Visão 3D</span>
          <span className="sm:hidden">3D</span>
        </button>
        <button
          onClick={() => { setEditMode(true); setViewMode('mechanic'); }}
          className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded transition-colors flex items-center gap-1 sm:gap-1.5 ${
            editMode ? 'bg-[#8B0000] text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Edit3 className="w-3 h-3" />
          <span className="hidden sm:inline">Editar Geometria</span>
          <span className="sm:hidden">Editar</span>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 sm:gap-3">
        <button 
          onClick={handleStructuralAnalysis}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors p-1.5 sm:px-3 sm:py-1.5 rounded-md hover:bg-[#111111]" 
          title="Análise Estrutural"
        >
          <ScanSearch className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Análise Estrutural</span>
        </button>
        
        <div className="h-4 w-px bg-[#222] hidden sm:block"></div>
        
        <button 
          onClick={handleExportPDF}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors p-1.5 sm:px-3 sm:py-1.5 rounded-md hover:bg-[#111111]" 
          title="Exportar PDF"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Exportar PDF</span>
        </button>
        
        <button 
          onClick={handleSaveProject}
          className="flex items-center gap-1.5 text-xs bg-white text-black hover:bg-gray-200 transition-colors p-1.5 sm:px-4 sm:py-1.5 rounded-md font-medium" 
          title="Salvar Projeto"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Salvar Projeto</span>
        </button>
      </div>
    </nav>
  );
}

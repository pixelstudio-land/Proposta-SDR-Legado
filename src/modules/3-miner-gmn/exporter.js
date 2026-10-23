import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { settings } from '../../../config/settings.js';

class LeadExporter {
  /**
   * Exporta a lista consolidada de leads minerados para planilha Excel (.xlsx) profissional
   * @param {Array<Object>} leadsList - Lista de leads extraídos
   * @param {string} queryName - Termo de busca usado na mineração para compor o nome do arquivo
   */
  exportToExcel(leadsList = [], queryName = 'geral') {
    if (!fs.existsSync(settings.paths.exportsDir)) {
      fs.mkdirSync(settings.paths.exportsDir, { recursive: true });
    }

    const sanitizedQuery = String(queryName)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `mineracao_gmn_${sanitizedQuery}_${timestamp}.xlsx`;
    const filePath = path.join(settings.paths.exportsDir, fileName);

    // Mapeamento dos dados para colunas executivas
    const rows = leadsList.map((lead, index) => ({
      '#': index + 1,
      'Nome da Empresa': lead.company_name || lead.name || 'Não informado',
      'Telefone Formatado': lead.phone || 'Sem telefone',
      'Tipo de Telefone': lead.phone_type === 'landline' ? 'Fixo Comercial' : (lead.phone_type === 'mobile' ? 'Celular Móvel' : 'Outro'),
      'WhatsApp Ativo': lead.is_whatsapp_active ? 'SIM' : 'NÃO / NÃO VERIFICADO',
      'Nicho / Segmento': lead.niche || queryName,
      'Endereço Completo': lead.address || 'Não informado',
      'Website': lead.website || 'Sem site',
      'Avaliação Google': lead.rating ? `${lead.rating} ★` : 'S/N',
      'Total de Avaliações': lead.reviews_count ? lead.reviews_count : (lead.rating ? `${lead.rating} ★` : 'Não informado'),
      'Status no Sistema': lead.status || 'new',
      'Data da Coleta': lead.created_at || new Date().toLocaleString('pt-BR')
    }));

    const worksheet = xlsx.utils.json_to_sheet(rows);

    // Ajuste de largura das colunas para visualização impecável
    worksheet['!cols'] = [
      { wch: 5 },   // #
      { wch: 35 },  // Nome da Empresa
      { wch: 18 },  // Telefone Formatado
      { wch: 16 },  // Tipo
      { wch: 15 },  // WhatsApp Ativo
      { wch: 25 },  // Nicho
      { wch: 45 },  // Endereço
      { wch: 30 },  // Website
      { wch: 18 },  // Avaliação
      { wch: 20 },  // Total Avaliações
      { wch: 18 },  // Status
      { wch: 22 }   // Data
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Leads Minerados GMN');

    xlsx.writeFile(workbook, filePath);
    console.log(`📊 [LeadExporter] Planilha exportada com sucesso: ${filePath} (${rows.length} registros)`);

    return {
      filePath,
      fileName,
      totalRows: rows.length
    };
  }
}

export const leadExporter = new LeadExporter();
export default leadExporter;

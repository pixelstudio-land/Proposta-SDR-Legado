const fs = require('fs');

function normalizeText(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Synonyms dictionary for Brazilian business search
const SYNONYMS = {
  pet: ['pet', 'veterinario', 'veterinaria', 'animal', 'cachorro', 'gato', 'banho e tosa', 'vacina pet', 'hospital veterinario'],
  dentista: ['dentista', 'odonto', 'odontologia', 'dente', 'sorriso', 'clareamento', 'implante', 'aparelho', 'alinhador', 'facetas'],
  hamburguer: ['hamburguer', 'burger', 'smash', 'lanche', 'artesanal', 'hamburgueria'],
  hamburgueria: ['hamburguer', 'burger', 'smash', 'lanche', 'artesanal', 'hamburgueria'],
  advogado: ['advogado', 'advocacia', 'juridico', 'direito', 'oab', 'processo', 'trabalhista', 'civel', 'escritorio advocacia'],
  advocacia: ['advogado', 'advocacia', 'juridico', 'direito', 'oab', 'processo', 'trabalhista', 'civel', 'escritorio advocacia'],
  medico: ['medico', 'clinica medica', 'policlinica', 'exames', 'consultas', 'saude', 'doutor'],
  estetica: ['estetica', 'harmonizacao', 'botox', 'labial', 'facial', 'pele', 'colageno', 'procedimento estetico'],
  barbearia: ['barbearia', 'barbeiro', 'corte masculino', 'barba', 'degrade', 'navalha'],
  salao: ['salao', 'cabelo', 'cabeleireiro', 'mechas', 'loira', 'corte feminino', 'escova'],
  pizza: ['pizza', 'pizzaria', 'forno a lenha', 'delivery pizza', 'massa'],
  pizzaria: ['pizza', 'pizzaria', 'forno a lenha', 'delivery pizza', 'massa'],
  mecanico: ['mecanico', 'oficina', 'oficina mecanica', 'autocenter', 'carro', 'revisao', 'troca de oleo', 'motor'],
  oficina: ['mecanico', 'oficina', 'oficina mecanica', 'autocenter', 'carro', 'revisao', 'troca de oleo', 'motor'],
  imobiliaria: ['imobiliaria', 'imovel', 'imoveis', 'corretor', 'apartamento', 'casa', 'condominio', 'aluguel', 'venda'],
  solar: ['solar', 'energia solar', 'fotovoltaica', 'painel solar', 'conta de luz', 'economia de energia'],
  contabilidade: ['contabilidade', 'contador', 'cnpj', 'abertura de empresa', 'impostos', 'fiscal', 'mei', 'simples nacional']
};

console.log('Synonyms module ready');

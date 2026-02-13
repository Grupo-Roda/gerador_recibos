
export enum ReceiptType {
  SERVICE = 'PRESTAÇÃO DE SERVIÇO'
}

export interface Taxes {
  iss: number;
  irrf: number;
  inss: number;
}

export interface ProviderInfo {
  name: string;
  document: string; // CPF or CNPJ
  address: string;
  phone: string;
  email: string;
  bankInfo: string;
  signature?: string; // base64 image
}

export interface ReceiptItem {
  id: string;
  description: string;
  value: number;
}

export interface ReceiptData {
  id: string;
  date: string;
  type: ReceiptType;
  items: ReceiptItem[];
  city: string;
  provider: ProviderInfo;
  tomador: TomadorInfo;
  discount: number;
  taxesPercentage: number;
  totalLiquido: number;
}

export interface TomadorInfo {
  name: string;
  cnpj: string;
  address: string;
  neighborhood: string;
  cep: string;
}

export const TOMADORES_LIST: TomadorInfo[] = [
  {
    name: "RODAMOINHO PRODUTORA DE EVENTOS LTDA",
    cnpj: "22.649.661/0001-85",
    address: "AV DAS AMERICAS, 12300 - LOJAS 151 E 152",
    neighborhood: "BARRA DA TIJUCA / RIO DE JANEIRO - RJ",
    cep: "22790-702"
  },
  {
    name: "RODAMOINHO PARTICIPACOES LTDA",
    cnpj: "54.935.839/0001-40",
    address: "AV DAS AMERICAS, 12300 - LOJAS 151 E 152",
    neighborhood: "BARRA DA TIJUCA / RIO DE JANEIRO - RJ",
    cep: "22790-702"
  },
  {
    name: "COLABS RECORDS LTDA",
    cnpj: "63.692.645/0001-52",
    address: "AV DAS AMERICAS, 12300 - LOJAS 151 E 152",
    neighborhood: "BARRA DA TIJUCA / RIO DE JANEIRO - RJ",
    cep: "22790-702"
  },
  {
    name: "RODAMOINHO RECORDS LTDA",
    cnpj: "40.376.932/0001-58",
    address: "AV DAS AMERICAS, 12300 - LOJAS 151 E 152",
    neighborhood: "BARRA DA TIJUCA / RIO DE JANEIRO - RJ",
    cep: "22790-702"
  },
  {
    name: "RODAMOINHO FILMES LTDA",
    cnpj: "31.291.787/0001-11",
    address: "AV DAS AMERICAS, 12300 - LOJAS 151 E 152",
    neighborhood: "BARRA DA TIJUCA / RIO DE JANEIRO - RJ",
    cep: "22790-702"
  }
];

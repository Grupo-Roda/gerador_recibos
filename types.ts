
export enum ReceiptType {
  SERVICE = 'PRESTAÇÃO DE SERVIÇO',
  REIMBURSEMENT = 'REEMBOLSO DE DESPESAS'
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
  receiptFile?: string; // base64
  receiptFileName?: string;
}

export interface ReceiptData {
  id: string;
  date: string;
  type: ReceiptType;
  items: ReceiptItem[];
  city: string;
  provider: ProviderInfo;
  taxes: Taxes;
}

export const CLIENT_DATA = {
  name: "RODAMOINHO PRODUTORA DE EVENTOS LTDA",
  cnpj: "22.649.661/0001-85",
  address: "AV DAS AMERICAS, 12300 - LOJAS 151 E 152",
  neighborhood: "BARRA DA TIJUCA / RIO DE JANEIRO - RJ",
  cep: "22790-702",
  im: "1083245-4"
};

import type { PaymentMethod } from "./project-financial";

export interface ProjectPayment {
  id: string;
  buildingId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPaymentInput {
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  notes: string;
}

export interface ProjectOrderInput {
  orderAmount: number | null;
  orderDate: string | null;
  incomeType: string | null;
  paymentTerms: string | null;
  nextPaymentDate: string | null;
}

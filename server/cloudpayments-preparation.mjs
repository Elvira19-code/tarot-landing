import {catalog, orderPrice} from './catalog.mjs';
import {receiptContact} from './receipt.mjs';

// Preparation only: no endpoint imports this module and no payment is initiated.
export function prepareCloudPayments(order, data, publicTerminalId) {
 const service = catalog[data.service];
 const amount = orderPrice(data);
 if (!service || service.retired || !Number.isFinite(amount) || amount <= 0 ||
     order.amount !== amount || !Number.isSafeInteger(order.id) || order.id <= 0) {
  throw Error('Invalid saved order');
 }
 if (typeof publicTerminalId !== 'string' || !publicTerminalId.trim()) throw Error('Terminal ID required');
 const contact = receiptContact(data);
 if (!contact.email) throw Error('Email receipt contact required');
 return {
  widget: {
   publicTerminalId: publicTerminalId.trim(),
   paymentSchema: 'Single',
   description: service.name,
   amount, currency: 'RUB', culture: 'ru-RU',
   externalId: String(order.id), receiptEmail: contact.email
  },
  // Provider-independent draft for NPD receipt review, not a CloudKassir receipt.
  receiptDraft: {
   email: contact.email, name: service.name, quantity: 1, amount,
   vat: 'none', subject: 'service',
   settlement: 'full_prepayment',
   issuance: 'requires-confirmation'
  }
 };
}

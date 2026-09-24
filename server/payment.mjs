import { createHash } from 'node:crypto';
import { receiptContact } from './receipt.mjs';
// Signed merchant fields retain the chosen receipt channel. SMS delivery must be enabled in Robocheki SMZ.
export function paymentParams(order, data, login, password) {
  const contact = receiptContact(data);
  const custom = { Shp_receipt_contact: contact.email || contact.phone, Shp_receipt_method: contact.receiptMethod };
  const amount = order.amount.toFixed(2);
  const suffix = Object.keys(custom).sort().map(key => `:${key}=${custom[key]}`).join('');
  return { MerchantLogin: login, OutSum: amount, InvId: String(order.id), Description: 'Заказ №' + order.id,
    ...(contact.email ? { Email: contact.email } : {}), ...custom, IsTest: '1', Culture: 'ru',
    SignatureValue: createHash('sha256').update(`${login}:${amount}:${order.id}:${password}${suffix}`).digest('hex') };
}

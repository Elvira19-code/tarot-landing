import { createHash } from 'node:crypto';
import { receiptContact } from './receipt.mjs';
import {catalog} from './catalog.mjs';
// Signed merchant fields retain the chosen receipt channel. SMS delivery must be enabled in Robocheki SMZ.
export function paymentParams(order, data, login, password, {test=true,algorithm='sha256'}={}) {
  const contact = receiptContact(data);
  const custom = { Shp_receipt_contact: contact.email || contact.phone, Shp_receipt_method: contact.receiptMethod };
  const amount = order.amount.toFixed(2);
  const suffix = Object.keys(custom).sort().map(key => `:${key}=${custom[key]}`).join('');
  const receipt=encodeURIComponent(JSON.stringify({items:[{name:catalog[data.service].name,quantity:1,sum:order.amount,tax:'none',payment_object:'service',payment_method:'full_prepayment'}]}));
  return { MerchantLogin: login, OutSum: amount, InvId: String(order.id), Description: 'Заказ №' + order.id,
    ...(contact.email ? { Email: contact.email } : {}), ...custom, ...(test?{IsTest:'1'}:{}), Culture: 'ru', Receipt:receipt,
    SignatureValue: createHash(algorithm).update(`${login}:${amount}:${order.id}:${receipt}:${password}${suffix}`).digest('hex') };
}

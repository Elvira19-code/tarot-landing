export function receiptContact(input) {
  const method = input.receiptMethod || 'email';
  if (method === 'email') {
    const email = String(input.email || '').trim();
    if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Укажите email для чека.');
    return { receiptMethod: method, email };
  }
  if (method !== 'sms') throw Error('Выберите способ получения чека.');
  let phone = String(input.phone || '').trim();
  if (!/^[+\d ()-]{10,25}$/.test(phone)) throw Error('Укажите телефон в международном формате.');
  phone = phone.replace(/[ ()-]/g, '');
  if (/^8\d{10}$/.test(phone)) phone = '+7' + phone.slice(1);
  if (!/^\+?[1-9]\d{9,14}$/.test(phone)) throw Error('Укажите телефон в международном формате.');
  return { receiptMethod: method, phone: '+' + phone.replace(/^\+/, '') };
}

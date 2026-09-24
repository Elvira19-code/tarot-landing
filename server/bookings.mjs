export const TIMES = ['11:00', '13:00', '15:00', '17:00'];
export const PAUSED = 'Временно запись не принимается. Пожалуйста, зайдите позже.';
export const moscowDate = (now = Date.now()) => new Date(now + 3 * 3600000).toISOString().slice(0, 10);
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function createBookings(db, clock = Date.now) {
  db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT OR IGNORE INTO settings VALUES ('accepting', 'true');
    CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY, order_id INTEGER, date TEXT NOT NULL, time TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL, expires INTEGER);
    CREATE UNIQUE INDEX IF NOT EXISTS booking_active_slot ON bookings(date,time) WHERE status IN ('requested','confirmed','reserved');
    CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY, action TEXT NOT NULL, created TEXT NOT NULL);`);
  const accepting = () => db.prepare("SELECT value FROM settings WHERE key='accepting'").get().value === 'true';
  const expire = () => db.prepare("UPDATE bookings SET status='expired' WHERE status='reserved' AND expires<=?").run(clock());
  const atomic = fn => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  function availability(date, exclude = 0) {
    expire();
    const min = moscowDate(clock()), max = moscowDate(clock() + 90 * 86400000);
    if (!validDate(date)) throw Error('Выберите корректную дату.');
    const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
    const workday = weekday !== 0 && weekday !== 6 && date >= min && date <= max;
    const busy = db.prepare("SELECT time FROM bookings WHERE date=? AND id<>? AND status IN ('requested','confirmed','reserved')").all(date, exclude);
    const times = TIMES.filter(time => workday && busy.length < 3 && !busy.some(b => b.time === time) && Date.parse(date + 'T' + time + ':00+03:00') > clock());
    return { date, min, max, accepting: accepting(), times, workday, remaining: Math.max(0, 3 - busy.length), timezone: 'Europe/Moscow' };
  }
  function check(date, time, exclude = 0) {
    if (!availability(date, exclude).times.includes(time)) throw Error('Нет свободных слотов. Выберите другую дату или время.');
  }
  function reserve(data, orderId = null, requestOnly = false) {
    if (!accepting()) throw Error(PAUSED);
    check(data.appointmentDate, data.appointmentTime);
    return Number(db.prepare('INSERT INTO bookings(order_id,date,time,status,data,created,expires) VALUES(?,?,?,?,?,?,?)').run(orderId, data.appointmentDate, data.appointmentTime, orderId && !requestOnly ? 'reserved' : 'requested', JSON.stringify(data), new Date(clock()).toISOString(), orderId && !requestOnly ? clock() + 30 * 60000 : null).lastInsertRowid);
  }
  function requireReservation(orderId) {
    expire();
    const b = db.prepare('SELECT * FROM bookings WHERE order_id=?').get(orderId);
    if (b && !['reserved','confirmed'].includes(b.status)) throw Error('Бронь истекла или отменена. Выберите время заново.');
    return b;
  }
  function paid(orderId) {
    const b = requireReservation(orderId);
    if (b) db.prepare("UPDATE bookings SET status='confirmed',expires=NULL WHERE id=?").run(b.id);
  }
  function adminChange(input) {
    return atomic(() => {
      if (input.action === 'pause') {
        if (typeof input.accepting !== 'boolean') throw Error('Некорректное состояние.');
        db.prepare("UPDATE settings SET value=? WHERE key='accepting'").run(String(input.accepting));
      } else {
        const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(Number(input.id));
        if (!b || !['requested','confirmed','reserved'].includes(b.status)) throw Error('Активная запись не найдена.');
        if (input.action === 'cancel') db.prepare("UPDATE bookings SET status='cancelled',expires=NULL WHERE id=?").run(b.id);
        else if (input.action === 'reschedule') {
          check(input.date, input.time, b.id);
          db.prepare('UPDATE bookings SET date=?,time=? WHERE id=?').run(input.date, input.time, b.id);
        } else if (input.action === 'confirm' && b.status === 'requested') db.prepare("UPDATE bookings SET status='confirmed' WHERE id=?").run(b.id);
        else throw Error('Действие недоступно.');
      }
      db.prepare('INSERT INTO admin_audit(action,created) VALUES(?,?)').run(JSON.stringify(input), new Date(clock()).toISOString());
      return { accepting: accepting() };
    });
  }
  return { accepting, availability, reserve, atomic, paid, requireReservation, adminChange,
    list() { expire(); return db.prepare('SELECT * FROM bookings ORDER BY date DESC,time LIMIT 200').all().map(b => ({ ...b, data: JSON.parse(b.data) })); }
  };
}

export function validateBooking(input) {
  if (input.ageConfirmed !== true || input.offer !== true || input.consent !== true) throw Error('Подтвердите возраст, оферту и согласие.');
  const name = String(input.name || '').trim(), contact = String(input.contact || '').trim(), question = String(input.question || '').trim();
  if (!name || name.length > 80 || contact.length < 3 || contact.length > 150 || question.length > 2000) throw Error('Проверьте имя, контакт и вопрос.');
  if (!['tarot','astrology','matrix','photo','unsure'].includes(input.service)) throw Error('Выберите формат.');
  return { name, contact, question, service: input.service, appointmentDate: input.appointmentDate, appointmentTime: input.appointmentTime, ageConfirmed: true, offer: true, consent: true, legal: '2026-09-24' };
}

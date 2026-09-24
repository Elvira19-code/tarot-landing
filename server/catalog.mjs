import {receiptContact} from './receipt.mjs';
export const catalog = {
 consultation_tarot: {name:'Личная консультация Таро',price:4000,days:0,consultation:true},
 consultation_photo: {name:'Личная консультация: разбор по фото + Таро',price:5500,days:0,consultation:true},
 consultation_full: {name:'Полный личный разбор: матрица, Таро и фото',price:6000,days:0,consultation:true},
 day: {name:'Персональный гороскоп на день',price:350,days:1},
 week: {name:'Персональный гороскоп на неделю',price:400,days:7},
 month: {name:'Персональный гороскоп на месяц',price:450,days:30},
 natal: {name:'Натальная карта с расшифровкой',price:500,days:0},
 tarot: {name:'Расклад Таро',price:350,days:0}
};
export const spreads = {cross:10,relationship:7,choice:5};
export const deck = ['Шут','Маг','Верховная Жрица','Императрица','Император','Иерофант','Влюблённые','Колесница','Сила','Отшельник','Колесо Фортуны','Справедливость','Повешенный','Смерть','Умеренность','Дьявол','Башня','Звезда','Луна','Солнце','Суд','Мир', ...['Жезлы','Кубки','Мечи','Пентакли'].flatMap(s=>['Туз','2','3','4','5','6','7','8','9','10','Паж','Рыцарь','Королева','Король'].map(r=>`${s}: ${r}`))];
export function validate(input) {
 if(input.ageConfirmed!==true) throw Error('Подтвердите, что вам исполнилось 18 лет.');
 const p = catalog[input.service];
 if(!Object.hasOwn(catalog,input.service)) throw Error('Выберите услугу.');
 const text=(key,max)=>{const value=String(input[key]??'').trim();if(!value||value.length>max)throw Error('Проверьте поле '+key);return value;};
 const data={service:input.service,name:text('name',80),...receiptContact(input),ageConfirmed:true};
 if(input.consent!==true||input.offer!==true)throw Error('Подтвердите условия и согласие.');
 data.consent=true;data.offer=true;
 const date=(value)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('Некорректная дата.');return value;};
 if(p.consultation){
  data.question=text('consultationQuestion',1000);
  data.appointmentDate=text('appointmentDate',10);data.appointmentTime=text('appointmentTime',5);
 }else if(input.service==='tarot'){
  data.question=text('question',1000);data.spread=input.spread;
  if(!spreads[data.spread]||!Array.isArray(input.cards)||input.cards.length!==spreads[data.spread]||new Set(input.cards).size!==input.cards.length||input.cards.some(n=>!Number.isInteger(n)||n<0||n>=78))throw Error('Выберите нужное число разных карт.');
  data.cards=input.cards;
  if(!Array.isArray(input.reversed)||input.reversed.length!==input.cards.length||input.reversed.some(value=>typeof value!=='boolean'))throw Error('Проверьте ориентацию выбранных карт.');
  data.reversed=[...input.reversed];
 }else{
  data.birth=date(text('birth',10));if(data.birth>new Date().toISOString().slice(0,10)||data.birth<'1900-01-01')throw Error('Проверьте дату рождения.');
  data.place=text('place',160);data.time=String(input.time||'');
  if(data.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time))throw Error('Проверьте время рождения.');
  if(p.days){data.start=date(text('start',10));if(data.start<new Date().toISOString().slice(0,10))throw Error('Выберите сегодня или будущую дату.');const end=new Date(data.start);end.setUTCDate(end.getUTCDate()+p.days-1);data.end=end.toISOString().slice(0,10);}
 }
 return data;
}

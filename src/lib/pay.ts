export async function pay(token:string) {
 const response=await fetch('/api/pay',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:'{}'});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'Не удалось открыть оплату.');
 if(result.url!=='https://auth.robokassa.ru/Merchant/Index.aspx')throw Error('Некорректный адрес оплаты.');
 const form=document.createElement('form');form.method='POST';form.action=result.url;
 for(const [name,value] of Object.entries(result.params)){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=String(value);form.append(input);}
 document.body.append(form);form.submit();
}

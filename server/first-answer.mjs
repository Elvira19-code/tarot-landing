export const firstOptions = input => ({
 natal: input.firstNatal === true || input.firstNatal === 'on',
 questions: input.firstQuestions === true || input.firstQuestions === 'on',
 extended: input.firstExtended === true || input.firstExtended === 'on'
});
export function firstPrice(input) {
 const {natal, questions, extended} = firstOptions(input);
 return 590 + (natal ? 200 : 0) + (questions ? 100 : 0) + (extended && natal && questions ? 100 : 0);
}
export function firstSummary(input) {
 const {natal, questions, extended} = firstOptions(input);
 return ['Диагностика: ответы на вопросы', 'Резюме: как можно изменить ситуацию', 'Направление помощи: психология', ...(natal ? ['Натальная карта как часть диагностики'] : []), ...(questions ? ['Список вопросов для самоанализа'] : []), ...(extended && natal && questions ? ['Расширенное резюме'] : []), 'Без личной консультации'].join('\n');
}

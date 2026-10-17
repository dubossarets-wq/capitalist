// Карточки «Шанс», «Казна» и сектора колеса фортуны

export type CardEffect =
  | { kind: 'money'; amount: number }
  | { kind: 'moveTo'; target: 'start' | 'lastProp' | 'firstTransport' | 'jail' | 'parking' }
  | { kind: 'moveRel'; steps: number }
  | { kind: 'nearest'; what: 'transport' | 'utility' }
  | { kind: 'goJail' }
  | { kind: 'jailFree' }
  | { kind: 'repairs'; house: number; hotel: number }
  | { kind: 'payEach'; amount: number }
  | { kind: 'collectEach'; amount: number }
  | { kind: 'jackpot' }
  | { kind: 'nothing' };

export interface CardDef {
  title: string;
  text: string;
  effect: CardEffect;
}

export const CHANCE_CARDS: CardDef[] = [
  { title: 'Вперёд!', text: 'Отправляйтесь на СТАРТ и получите зарплату', effect: { kind: 'moveTo', target: 'start' } },
  { title: 'Роскошная жизнь', text: 'Отправляйтесь в самый дорогой район поля', effect: { kind: 'moveTo', target: 'lastProp' } },
  { title: 'Путешествие', text: 'Отправляйтесь к ближайшему транспорту. Если он чужой — заплатите двойную аренду', effect: { kind: 'nearest', what: 'transport' } },
  { title: 'Коммуналка', text: 'Отправляйтесь к ближайшему предприятию. Если оно чужое — заплатите 10× сумму кубиков', effect: { kind: 'nearest', what: 'utility' } },
  { title: 'Дивиденды', text: 'Банк выплачивает вам дивиденды', effect: { kind: 'money', amount: 50 } },
  { title: 'Адвокат', text: 'Карта «Освобождение из тюрьмы». Сохраните её до нужного момента', effect: { kind: 'jailFree' } },
  { title: 'Ой!', text: 'Вернитесь на 3 клетки назад', effect: { kind: 'moveRel', steps: -3 } },
  { title: 'Арест', text: 'Отправляйтесь прямо в тюрьму, не проходя СТАРТ', effect: { kind: 'goJail' } },
  { title: 'Ремонт', text: 'Капитальный ремонт: $25 за каждый дом и $100 за каждый отель', effect: { kind: 'repairs', house: 25, hotel: 100 } },
  { title: 'Штраф', text: 'Штраф за превышение скорости', effect: { kind: 'money', amount: -15 } },
  { title: 'Председатель', text: 'Вас избрали председателем совета. Заплатите каждому игроку $50', effect: { kind: 'payEach', amount: 50 } },
  { title: 'Кредит погашен', text: 'Ваш кредит погашен досрочно — получите премию', effect: { kind: 'money', amount: 150 } },
  { title: 'В аэропорт', text: 'Отправляйтесь к первому транспорту на поле', effect: { kind: 'moveTo', target: 'firstTransport' } },
  { title: 'Лотерея', text: 'Вы выиграли в лотерею!', effect: { kind: 'money', amount: 100 } },
  { title: 'Отпуск', text: 'Отправляйтесь в отпуск', effect: { kind: 'moveTo', target: 'parking' } },
  { title: 'Спонсор', text: 'Спонсорский взнос на городской фестиваль', effect: { kind: 'money', amount: -100 } },
];

export const CHEST_CARDS: CardDef[] = [
  { title: 'Ошибка банка', text: 'Ошибка банка в вашу пользу', effect: { kind: 'money', amount: 200 } },
  { title: 'Визит к врачу', text: 'Оплатите услуги врача', effect: { kind: 'money', amount: -50 } },
  { title: 'Акции', text: 'Вы удачно продали акции', effect: { kind: 'money', amount: 50 } },
  { title: 'Связи', text: 'Карта «Освобождение из тюрьмы»', effect: { kind: 'jailFree' } },
  { title: 'Налоговая проверка', text: 'Отправляйтесь прямо в тюрьму, не проходя СТАРТ', effect: { kind: 'goJail' } },
  { title: 'Праздничный фонд', text: 'Получите выплату из праздничного фонда', effect: { kind: 'money', amount: 100 } },
  { title: 'Возврат налога', text: 'Возврат подоходного налога', effect: { kind: 'money', amount: 20 } },
  { title: 'День рождения', text: 'У вас день рождения! Получите по $10 от каждого игрока', effect: { kind: 'collectEach', amount: 10 } },
  { title: 'Страховка', text: 'Истёк срок страхования жизни — получите выплату', effect: { kind: 'money', amount: 100 } },
  { title: 'Больница', text: 'Оплатите счёт из больницы', effect: { kind: 'money', amount: -100 } },
  { title: 'Учёба', text: 'Оплатите курсы повышения квалификации', effect: { kind: 'money', amount: -50 } },
  { title: 'Консультация', text: 'Получите гонорар за консультацию', effect: { kind: 'money', amount: 25 } },
  { title: 'Ремонт улиц', text: 'Ремонт улиц: $40 за каждый дом и $115 за каждый отель', effect: { kind: 'repairs', house: 40, hotel: 115 } },
  { title: 'Конкурс', text: 'Второе место в конкурсе красоты', effect: { kind: 'money', amount: 10 } },
  { title: 'Наследство', text: 'Вы получили наследство', effect: { kind: 'money', amount: 100 } },
  { title: 'На старт', text: 'Отправляйтесь на СТАРТ и получите зарплату', effect: { kind: 'moveTo', target: 'start' } },
];

export interface WheelSector {
  label: string;
  text: string;
  color: string;
  effect: CardEffect;
}

export const WHEEL_SECTORS: WheelSector[] = [
  { label: '+$50', text: 'Небольшой выигрыш: +$50', color: '#43A047', effect: { kind: 'money', amount: 50 } },
  { label: '−$75', text: 'Неудача: −$75', color: '#E53935', effect: { kind: 'money', amount: -75 } },
  { label: '+$150', text: 'Отличный выигрыш: +$150', color: '#1E88E5', effect: { kind: 'money', amount: 150 } },
  { label: 'СТАРТ', text: 'Перенос на СТАРТ с зарплатой', color: '#FB8C00', effect: { kind: 'moveTo', target: 'start' } },
  { label: '×$25', text: 'Каждый игрок платит вам $25', color: '#8E24AA', effect: { kind: 'collectEach', amount: 25 } },
  { label: '−$150', text: 'Большая неудача: −$150', color: '#C62828', effect: { kind: 'money', amount: -150 } },
  { label: 'КЛЮЧ', text: 'Карта «Освобождение из тюрьмы»', color: '#00ACC1', effect: { kind: 'jailFree' } },
  { label: '+$300', text: 'ДЖЕКПОТ! +$300', color: '#FDD835', effect: { kind: 'money', amount: 300 } },
  { label: 'ПУСТО', text: 'Пусто… в следующий раз повезёт', color: '#78909C', effect: { kind: 'nothing' } },
  { label: '+$100', text: 'Выигрыш: +$100', color: '#7CB342', effect: { kind: 'money', amount: 100 } },
];

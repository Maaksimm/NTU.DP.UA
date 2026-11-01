/*
 * Налаштування спільного чату та акаунтів «World Students».
 *
 * 1) База повідомлень: Firebase Realtime Database (databaseURL нижче).
 * 2) Справжні акаунти (реєстрація, вхід, фото профілю): Firebase Authentication.
 *    Щоб їх увімкнути:
 *      a) Firebase Console → Build → Authentication → Get started → Sign-in method → Email/Password → Enable.
 *      b) Project settings (шестерня) → General → «Web API Key» - скопіюйте значення в apiKey нижче.
 *         Це ключ клієнта, він не є таємним, але доступ до даних обмежують правила (п. 3).
 *      c) У Realtime Database → Rules вставте правила з п. 3 і натисніть Publish.
 *    Поки apiKey порожній, акаунти працюють у ДЕМО-режимі: лише в браузері користувача, без перевірки на сервері.
 *
 * 3) Правила Realtime Database (повний актуальний текст - у файлі firebase-rules.json у корені проєкту;
 * писати в чат і залишати відгуки можуть лише користувачі з підтвердженою поштою):
 * {
 *   "rules": {
 *     "chat": {
 *       ".read": true,
 *       "messages": {
 *         "$id": {
 *           ".write": "auth != null && auth.token.email_verified === true && !data.exists()",
 *           ".validate": "newData.hasChildren(['n','t','ts','u']) && newData.child('u').val() === auth.uid && newData.child('t').isString() && newData.child('t').val().length <= 500 && newData.child('n').isString() && newData.child('n').val().length <= 40"
 *         }
 *       }
 *     },
 *     "users": {
 *       ".read": "auth != null",
 *       "$uid": {
 *         ".read": true,
 *         ".write": "auth != null && auth.uid === $uid",
 *         ".validate": "newData.hasChildren(['n']) && newData.child('n').isString() && newData.child('n').val().length <= 40 && (!newData.child('a').exists() || newData.child('a').val().length <= 30000)"
 *       }
 *     },
 *     "profiles": {
 *       ".read": "auth != null",
 *       "$uid": {
 *         ".write": "auth != null && auth.uid === $uid",
 *         ".validate": "(!newData.child('g').exists() || newData.child('g').val() === '' || newData.child('g').val() === 'm' || newData.child('g').val() === 'f') && (!newData.child('age').exists() || (newData.child('age').isNumber() && newData.child('age').val() >= 10 && newData.child('age').val() <= 99)) && (!newData.child('c').exists() || (newData.child('c').isString() && newData.child('c').val().length <= 20)) && (!newData.child('f').exists() || (newData.child('f').isString() && newData.child('f').val().length <= 120))"
 *       }
 *     },
 *     "reviews": {
 *       ".read": "auth != null",
 *       "$target": {
 *         "$author": {
 *           ".write": "auth != null && auth.token.email_verified === true && auth.uid === $author && $target !== auth.uid",
 *           ".validate": "newData.hasChildren(['r','t','n','ts']) && newData.child('r').isNumber() && newData.child('r').val() >= 1 && newData.child('r').val() <= 5 && newData.child('t').isString() && newData.child('t').val().length <= 300 && newData.child('n').isString() && newData.child('n').val().length <= 40"
 *         }
 *       }
 *     }
 *   }
 * }
 *
 * Поки databaseURL порожній, чат працює в локальному режимі: повідомлення зберігаються
 * лише в браузері цього пристрою (і синхронізуються між вкладками).
 */
window.NTU_CHAT = {
	databaseURL: 'https://ntubd-93efc-default-rtdb.europe-west1.firebasedatabase.app',
	apiKey: 'AIzaSyAB3YiH2DL32jHLzMHOct4H3tCulrf2EnY'
}

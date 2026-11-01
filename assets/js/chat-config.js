/*
 * Налаштування спільного чату «World Students».
 *
 * Щоб повідомлення зберігалися на сервері й були спільними для ВСІХ відвідувачів,
 * потрібна безкоштовна база Firebase Realtime Database:
 *   1. console.firebase.google.com → Create project → Build → Realtime Database → Create (режим «locked»).
 *   2. Вкладка Rules — встав правила нижче й натисни Publish.
 *   3. Скопіюй адресу бази (вигляду https://НАЗВА-default-rtdb.europe-west1.firebasedatabase.app)
 *      у databaseURL нижче.
 *
 * Правила (читати й дописувати можуть усі, змінювати/видаляти старе — ніхто; довжина обмежена):
 * {
 *   "rules": {
 *     "chat": {
 *       ".read": true,
 *       "messages": {
 *         "$id": {
 *           ".write": "!data.exists()",
 *           ".validate": "newData.hasChildren(['n','t','ts','u']) && newData.child('t').isString() && newData.child('t').val().length <= 500 && newData.child('n').isString() && newData.child('n').val().length <= 40"
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
	databaseURL: ''
}

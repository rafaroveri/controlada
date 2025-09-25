// firebase-config.js
// Preencha os dados abaixo com as credenciais do seu projeto Firebase

const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_AUTH_DOMAIN",
    databaseURL: "SEU_DATABASE_URL",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_STORAGE_BUCKET",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
};

if (typeof firebase !== 'undefined' && firebase?.apps) {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
}

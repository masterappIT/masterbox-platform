// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './public/locales/en.json';
import tw from './public/locales/zh-TW.json';

const resources = {
  'en': {
    translation: en,
  },
  'zh-TW': {
    translation: tw,
  },
};

// 將i18next傳入react-i18next裡並實例化initReactI18next
i18n.use(initReactI18next).init({
  resources,
  lng: 'zh-TW',             //預設語言
  fallbackLng: 'en',     //如果當前切換的語言沒有對應的翻譯則使用這個語言，
  interpolation: {
    escapeValue: false, // 是否要讓字詞escaped防止xss攻擊，因為React已經做了，設成false即可
  },
});

export default i18n;

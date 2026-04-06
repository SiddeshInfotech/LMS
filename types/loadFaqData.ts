// Utility to load FAQ data based on language
export async function loadFaqData(lang: 'en' | 'mr') {
  if (lang === 'en') {
    return import('../src/assets/faq_en.json').then(m => m.default);
  } else {
    return import('../src/assets/faq_mr.json').then(m => m.default);
  }
}

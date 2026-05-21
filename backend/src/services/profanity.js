'use strict';

// Root-based Russian profanity detection — matches as substrings
const MAT_ROOTS = [
  'хуй','хуе','хуя','нахуй','похуй','хуйн','захуяр','хуяр','хуйл',
  'пизд','пизда','пиздец',
  'еба','ёба','заеба','проеба','выеба','ебан','ёбан','ебло',
  'блядь','блять','бляд','блят',
  'мудак','мудил','мудозвон',
  'пидор','пидар','пидрил',
  'залупа','манда','хуесос',
  'долбоеб','долбаеб','долбан',
  'трахать','трахн','ёбн','ебн',
];

// Clear insults (word-level, need space/boundary or standalone)
const INSULT_WORDS = [
  'ублюдок','ублюд','урод','скотина','тварь','шлюха','проститутка',
  'кретин','дебил','идиот','придурок','дурак','тупица',
];

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')       // ё → е for consistent matching
    .replace(/[*!@#$%^&]/g, '') // strip common char substitutions
    .replace(/(.)\1{2,}/g, '$1'); // collapse repeated chars: ааааа → а
}

function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  const norm = normalize(text);

  for (const root of MAT_ROOTS) {
    if (norm.includes(normalize(root))) return true;
  }

  // Insult words — check as word substrings (surrounded by non-alpha or string edges)
  for (const word of INSULT_WORDS) {
    const re = new RegExp('(^|[\\s,!?.;:«»"\'()-])' + normalize(word) + '($|[\\s,!?.;:«»"\'()-])', 'u');
    if (re.test(norm)) return true;
  }

  return false;
}

module.exports = { containsProfanity };

/* Numeros — calculation engine. Pure functions, no DOM. */
const Numerology = (() => {
  const LETTER_VALUES = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
    J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
    S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8,
  };

  const VOWELS = 'AEIOU';
  const MASTER_NUMBERS = [11, 22, 33];
  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const ALL_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];

  function stripDiacritics(value) {
    if (!value) return '';
    return String(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  function normalizeName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function letterValue(char) {
    return LETTER_VALUES[String(char).toUpperCase()] || 0;
  }

  function reduceMaster(value) {
    let total = Math.abs(Math.trunc(Number(value) || 0));
    while (total > 9 && !MASTER_NUMBERS.includes(total)) {
      total = String(total).split('').reduce((acc, digit) => acc + Number(digit), 0);
    }
    return total;
  }

  function reduceRoot(value) {
    let total = Math.abs(Math.trunc(Number(value) || 0));
    while (total > 9) {
      total = String(total).split('').reduce((acc, digit) => acc + Number(digit), 0);
    }
    return total;
  }

  function sumLetters(letters) {
    return letters.reduce((acc, letter) => acc + letter.value, 0);
  }

  /*
   * Y is a vowel when it stands alone or sits between consonants; it becomes a
   * consonant the moment it touches another vowel. Word edges count as consonant
   * neighbours, so "Lynn", "Ly" and "Y" keep their Y in the soul urge.
   */
  function classifyY(word, index) {
    const prev = word[index - 1];
    const next = word[index + 1];
    const prevVowel = prev !== undefined && VOWELS.includes(prev);
    const nextVowel = next !== undefined && VOWELS.includes(next);

    if (prevVowel || nextVowel) return { role: 'consonant', reason: 'yTouchesVowel' };
    if (word.length === 1) return { role: 'vowel', reason: 'yAlone' };
    if (prev !== undefined && next !== undefined) return { role: 'vowel', reason: 'yBetweenConsonants' };
    return { role: 'vowel', reason: 'yAtWordEdge' };
  }

  function analyzeName(rawName, overrides) {
    const name = normalizeName(rawName);
    const cleaned = stripDiacritics(name).toUpperCase();
    const tokens = cleaned.split(/[^A-Z]+/).filter(Boolean);
    const flips = overrides || {};

    const words = tokens.map((token, wordIndex) => {
      const letters = token.split('').map((char, position) => {
        const id = `${wordIndex}:${position}`;
        let role;
        let reason;
        if (VOWELS.includes(char)) {
          role = 'vowel';
          reason = 'isVowel';
        } else if (char === 'Y') {
          const verdict = classifyY(token, position);
          role = verdict.role;
          reason = verdict.reason;
        } else {
          role = 'consonant';
          reason = 'isConsonant';
        }
        const flipped = char === 'Y' && flips[id] && flips[id] !== role;
        return {
          id,
          char,
          value: letterValue(char),
          role: flipped ? flips[id] : role,
          autoRole: role,
          reason,
          isY: char === 'Y',
          flipped: Boolean(flipped),
          wordIndex,
          position,
        };
      });
      return { text: token, wordIndex, letters };
    });

    const letters = words.flatMap((word) => word.letters);
    const vowels = letters.filter((letter) => letter.role === 'vowel');
    const consonants = letters.filter((letter) => letter.role === 'consonant');
    const vowelTotal = sumLetters(vowels);
    const consonantTotal = sumLetters(consonants);
    const total = vowelTotal + consonantTotal;

    return {
      name,
      cleaned,
      words,
      letters,
      vowels,
      consonants,
      vowelTotal,
      consonantTotal,
      total,
      soul: { total: vowelTotal, reduced: reduceMaster(vowelTotal), letters: vowels },
      personality: { total: consonantTotal, reduced: reduceMaster(consonantTotal), letters: consonants },
      destiny: { total, reduced: reduceMaster(total), letters },
      yCount: letters.filter((letter) => letter.isY).length,
      flippedCount: letters.filter((letter) => letter.flipped).length,
    };
  }

  function lifePath(month, day, year) {
    const monthReduced = reduceMaster(month);
    const dayReduced = reduceMaster(day);
    const yearReduced = reduceMaster(year);
    const sum = monthReduced + dayReduced + yearReduced;
    return {
      monthReduced,
      dayReduced,
      yearReduced,
      sum,
      value: reduceMaster(sum),
    };
  }

  function pinnacles(month, day, year, lifePathValue) {
    const first = reduceMaster(month + day);
    const second = reduceMaster(day + year);
    const third = reduceMaster(first + second);
    const fourth = reduceMaster(month + year);

    const firstStart = Math.max(0, 36 - lifePathValue - 9);
    const firstEnd = firstStart + 9;
    const secondEnd = firstEnd + 9;
    const thirdEnd = secondEnd + 9;

    return [
      { index: 0, key: 'first', value: first, formula: [month, '+', day], startAge: firstStart, endAge: firstEnd },
      { index: 1, key: 'second', value: second, formula: [day, '+', year], startAge: firstEnd, endAge: secondEnd },
      { index: 2, key: 'third', value: third, formula: [first, '+', second], startAge: secondEnd, endAge: thirdEnd },
      { index: 3, key: 'fourth', value: fourth, formula: [month, '+', year], startAge: thirdEnd, endAge: null },
    ];
  }

  function challenges(month, day, year) {
    const first = reduceRoot(Math.abs(month - day));
    const second = reduceRoot(Math.abs(day - year));
    const third = reduceRoot(Math.abs(first - second));
    const fourth = reduceRoot(Math.abs(month - year));
    return [
      { index: 0, key: 'first', value: first, formula: ['|', month, '−', day, '|'] },
      { index: 1, key: 'second', value: second, formula: ['|', day, '−', year, '|'] },
      { index: 2, key: 'third', value: third, formula: ['|', first, '−', second, '|'] },
      { index: 3, key: 'fourth', value: fourth, formula: ['|', month, '−', year, '|'] },
    ];
  }

  function periodCycles(month, day, year, firstPinnacleEnd) {
    return [
      { index: 0, key: 'first', value: reduceMaster(month), source: 'month', startAge: 0, endAge: firstPinnacleEnd },
      { index: 1, key: 'second', value: reduceMaster(day), source: 'day', startAge: firstPinnacleEnd, endAge: firstPinnacleEnd + 27 },
      { index: 2, key: 'third', value: reduceMaster(year), source: 'year', startAge: firstPinnacleEnd + 27, endAge: null },
    ];
  }

  function ageOn(birth, on) {
    const ref = on || new Date();
    let age = ref.getFullYear() - birth.year;
    const beforeBirthday =
      ref.getMonth() + 1 < birth.month ||
      (ref.getMonth() + 1 === birth.month && ref.getDate() < birth.day);
    if (beforeBirthday) age -= 1;
    return Math.max(0, age);
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function isValidDate(year, month, day) {
    if (!year || !month || !day) return false;
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    return day <= daysInMonth(year, month);
  }

  function personalYear(birthMonth, birthDay, year) {
    const sum = birthMonth + birthDay + year;
    return { sum, value: reduceRoot(sum) };
  }

  function personalMonth(birthMonth, birthDay, year, month) {
    const py = personalYear(birthMonth, birthDay, year);
    const sum = py.value + month;
    return { sum, value: reduceRoot(sum), yearValue: py.value, yearSum: py.sum };
  }

  function personalDay(birthMonth, birthDay, year, month, day) {
    const pm = personalMonth(birthMonth, birthDay, year, month);
    const sum = pm.value + day;
    return { sum, value: reduceRoot(sum), monthValue: pm.value, monthSum: pm.sum, yearValue: pm.yearValue, yearSum: pm.yearSum };
  }

  function personalYearMonths(birthMonth, birthDay, year) {
    return Array.from({ length: 12 }, (_, index) => personalMonth(birthMonth, birthDay, year, index + 1));
  }

  const HARMONY = {
    1: { 1: 76, 2: 62, 3: 92, 4: 64, 5: 90, 6: 66, 7: 84, 8: 70, 9: 74 },
    2: { 2: 80, 3: 72, 4: 90, 5: 56, 6: 86, 7: 76, 8: 92, 9: 74 },
    3: { 3: 78, 4: 54, 5: 88, 6: 84, 7: 62, 8: 60, 9: 90 },
    4: { 4: 82, 5: 52, 6: 86, 7: 78, 8: 92, 9: 60 },
    5: { 5: 74, 6: 58, 7: 84, 8: 72, 9: 76 },
    6: { 6: 84, 7: 60, 8: 84, 9: 90 },
    7: { 7: 80, 8: 58, 9: 82 },
    8: { 8: 78, 9: 66 },
    9: { 9: 76 },
  };

  function harmony(a, b) {
    const x = reduceRoot(a);
    const y = reduceRoot(b);
    const low = Math.min(x, y);
    const high = Math.max(x, y);
    return HARMONY[low][high];
  }

  const ASPECT_WEIGHTS = { lifePath: 0.4, soul: 0.25, destiny: 0.2, personality: 0.15 };

  function compatibility(a, b) {
    const aspects = ['lifePath', 'soul', 'destiny', 'personality'].map((key) => {
      const left = key === 'lifePath' ? a.lifePath.value : a.name[key].reduced;
      const right = key === 'lifePath' ? b.lifePath.value : b.name[key].reduced;
      const score = harmony(left, right);
      return { key, left, right, score, weight: ASPECT_WEIGHTS[key], mirrored: reduceRoot(left) === reduceRoot(right) };
    });
    const score = Math.round(aspects.reduce((acc, aspect) => acc + aspect.score * aspect.weight, 0));
    const band = score >= 85 ? 'radiant' : score >= 70 ? 'harmonious' : score >= 55 ? 'dynamic' : 'learning';
    const strongest = aspects.slice().sort((x, y) => y.score - x.score)[0];
    const weakest = aspects.slice().sort((x, y) => x.score - y.score)[0];
    return { score, band, aspects, strongest, weakest };
  }

  function buildChart(profile, overrides) {
    const { name, month, day, year } = profile;
    const nameAnalysis = analyzeName(name, overrides);
    const lp = lifePath(month, day, year);
    const pin = pinnacles(month, day, year, lp.value);
    const chal = challenges(month, day, year);
    const periods = periodCycles(month, day, year, pin[0].endAge);
    const birthday = reduceMaster(day);
    const maturity = reduceMaster(lp.value + nameAnalysis.destiny.reduced);

    return {
      profile,
      name: nameAnalysis,
      lifePath: lp,
      destiny: nameAnalysis.destiny,
      soul: nameAnalysis.soul,
      personality: nameAnalysis.personality,
      birthday: { value: birthday, day },
      maturity: { value: maturity, sum: lp.value + nameAnalysis.destiny.reduced },
      pinnacles: pin,
      challenges: chal,
      periods,
      core: [
        { key: 'lifePath', value: lp.value },
        { key: 'destiny', value: nameAnalysis.destiny.reduced },
        { key: 'soul', value: nameAnalysis.soul.reduced },
        { key: 'personality', value: nameAnalysis.personality.reduced },
        { key: 'birthday', value: birthday },
        { key: 'maturity', value: maturity },
      ],
    };
  }

  function currentPinnacle(chart, age) {
    return chart.pinnacles.find((p) => age >= p.startAge && (p.endAge === null || age < p.endAge)) || null;
  }

  function currentChallenge(chart, age) {
    const pin = currentPinnacle(chart, age);
    if (!pin) return chart.challenges[0];
    return chart.challenges[pin.index];
  }

  function currentPeriod(chart, age) {
    return chart.periods.find((p) => age >= p.startAge && (p.endAge === null || age < p.endAge)) || null;
  }

  const PAIRINGS = {
    1: [3, 5, 7], 2: [1, 4, 8], 3: [1, 5, 9], 4: [2, 6, 8], 5: [1, 3, 7],
    6: [2, 4, 9], 7: [1, 5, 7], 8: [2, 4, 6], 9: [3, 6, 7],
    11: [2, 7, 9], 22: [4, 6, 8], 33: [3, 6, 9],
  };

  function pairings(number) {
    return PAIRINGS[number] || PAIRINGS[reduceRoot(number)] || [3, 6, 9];
  }

  return {
    LETTER_VALUES, VOWELS, MASTER_NUMBERS, DIGITS, ALL_NUMBERS,
    stripDiacritics, normalizeName, letterValue, reduceMaster, reduceRoot,
    analyzeName, lifePath, pinnacles, challenges, periodCycles,
    ageOn, daysInMonth, isValidDate,
    personalYear, personalMonth, personalDay, personalYearMonths,
    harmony, compatibility, buildChart,
    currentPinnacle, currentChallenge, currentPeriod, pairings,
  };
})();
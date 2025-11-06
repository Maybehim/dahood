const PROFANE_WORDS = ['damn', 'hell', 'shit', 'fuck'];

type Mode = 'replace' | 'block';

export class ProfanityFilter {
  filter(input: string, mode: Mode): string {
    let result = input;
    for (const word of PROFANE_WORDS) {
      const regex = new RegExp(word, 'gi');
      if (regex.test(result)) {
        if (mode === 'block') {
          throw new Error('Inappropriate language detected');
        }
        result = result.replace(regex, '*'.repeat(word.length));
      }
    }
    return result;
  }
}

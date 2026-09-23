/**
 * Spelling autocorrect for résumé text, applied the moment a word is finished (space or
 * punctuation typed after it) — the way a phone keyboard does it.
 *
 * Deliberately a fixed list of unambiguous misspellings rather than a spellchecker: a
 * word is only ever replaced when the typo can mean exactly one thing. Real words that
 * are common mistypes of other words ("manger", "costumer", "collage", "defiantly")
 * are left alone, because correcting them would sometimes be wrong.
 */

const FIXES: Record<string, string> = {
  // general
  acheive: 'achieve', acheived: 'achieved', acommodate: 'accommodate', accomodate: 'accommodate', adress: 'address',
  agressive: 'aggressive', alot: 'a lot', apparant: 'apparent', arguement: 'argument', basicly: 'basically',
  begining: 'beginning', beleive: 'believe', buisness: 'business', busness: 'business', bussiness: 'business',
  calender: 'calendar', catagory: 'category', collegue: 'colleague', comittee: 'committee', commited: 'committed',
  completly: 'completely', concious: 'conscious', definately: 'definitely', definatly: 'definitely',
  desparate: 'desperate', dissapoint: 'disappoint', embarass: 'embarrass', enviroment: 'environment',
  existance: 'existence', familar: 'familiar', finaly: 'finally', foward: 'forward', freind: 'friend',
  goverment: 'government', grammer: 'grammar', happend: 'happened', immediatly: 'immediately',
  independant: 'independent', intrest: 'interest', knowlege: 'knowledge', liason: 'liaison', libary: 'library',
  neccessary: 'necessary', neccesary: 'necessary', necesary: 'necessary', noticable: 'noticeable', occured: 'occurred',
  occurence: 'occurrence', occassion: 'occasion', oppurtunity: 'opportunity', oppertunity: 'opportunity',
  peice: 'piece', persistant: 'persistent', posession: 'possession', prefered: 'preferred', publically: 'publicly',
  realy: 'really', recieve: 'receive', recieved: 'received', recieving: 'receiving', reccomend: 'recommend',
  recomend: 'recommend', refered: 'referred', relevent: 'relevant', remeber: 'remember', seperate: 'separate',
  seperated: 'separated', suprise: 'surprise', tommorow: 'tomorrow', tomorow: 'tomorrow', truely: 'truly',
  untill: 'until', wierd: 'weird', wich: 'which', writting: 'writing', teh: 'the', thier: 'their', becuase: 'because',
  beacuse: 'because', thru: 'through',
  // work and résumé vocabulary
  accuratly: 'accurately', accurite: 'accurate', asistant: 'assistant', assistent: 'assistant', casheir: 'cashier',
  cashir: 'cashier', certifed: 'certified', cleanning: 'cleaning', comunication: 'communication',
  commuication: 'communication', custmer: 'customer', custmers: 'customers', costumers: 'customers',
  delivey: 'delivery', diplomma: 'diploma', efficent: 'efficient', employe: 'employee', employes: 'employees',
  equiptment: 'equipment', experiance: 'experience', experince: 'experience', forklit: 'forklift',
  gradueted: 'graduated', inventroy: 'inventory', invintory: 'inventory', intership: 'internship',
  lisence: 'license', liscense: 'license', maintainance: 'maintenance', maintenence: 'maintenance',
  maintanence: 'maintenance', managment: 'management', orgainzed: 'organized', orginized: 'organized',
  proficent: 'proficient', profesional: 'professional', proffesional: 'professional', responsable: 'responsible',
  responsability: 'responsibility', responsibilites: 'responsibilities', responsiblities: 'responsibilities',
  resturant: 'restaurant', resteraunt: 'restaurant', schedual: 'schedule', shelvs: 'shelves', sucess: 'success',
  succesful: 'successful', successfull: 'successful', sucessful: 'successful', supervisior: 'supervisor',
  supervizor: 'supervisor', techician: 'technician', volenteer: 'volunteer', volunter: 'volunteer',
  warehose: 'warehouse', wharehouse: 'warehouse',
  // missing apostrophes (only where the bare form is not itself a word)
  im: "I'm", ive: "I've", dont: "don't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", wasnt: "wasn't",
  werent: "weren't", couldnt: "couldn't", wouldnt: "wouldn't", shouldnt: "shouldn't", thats: "that's",
  theyre: "they're", youre: "you're",
};

/** Characters that finish a word and trigger a correction. */
const BOUNDARY = /[\s.,;:!?)\]"]/;

export interface Correction {
  text: string;
  caret: number;
  from: string;
  to: string;
}

function matchCase(original: string, replacement: string): string {
  if (original.length > 1 && original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0]!.toUpperCase()) return replacement[0]!.toUpperCase() + replacement.slice(1);
  return replacement;
}

/** The replacement for one word, or null when it's fine. Exported for tests. */
export function correctWord(word: string): string | null {
  if (word === 'i') return 'I';
  const fix = FIXES[word.toLowerCase()];
  return fix ? matchCase(word, fix) : null;
}

/**
 * If the character just before `caret` finished a word, and that word is a known
 * misspelling, return the corrected text and where the caret should go. Otherwise null.
 * Never touches emails, URLs or handles (a word glued to @ / . / : is skipped).
 */
export function autocorrectAt(text: string, caret: number): Correction | null {
  if (caret < 2 || !BOUNDARY.test(text[caret - 1] ?? '')) return null;
  const before = text.slice(0, caret - 1);
  const m = before.match(/([A-Za-z']+)$/);
  if (!m) return null;
  const word = m[1]!;
  const start = before.length - word.length;
  const glued = text[start - 1];
  if (glued && /[@/.:\\_\-0-9]/.test(glued)) return null;
  if (text[caret - 1] === '.' && /^[a-z]{2,4}$/i.test(text.slice(caret, caret + 4))) return null; // example.com
  const to = correctWord(word);
  if (!to || to === word) return null;
  const next = text.slice(0, start) + to + text.slice(caret - 1);
  return { text: next, caret: caret + (to.length - word.length), from: word, to };
}

/** Correct every finished word in a block of text (used for pasted text). */
export function autocorrectAll(text: string): string {
  return text.replace(/(^|[^A-Za-z'@/.:\\_\-0-9])([A-Za-z']+)(?=[\s.,;:!?)\]"]|$)/g, (all, lead: string, word: string) => {
    const to = correctWord(word);
    return to ? lead + to : all;
  });
}

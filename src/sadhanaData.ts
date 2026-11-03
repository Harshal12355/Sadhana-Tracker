export interface ShastraReadingItem {
  id: string;
  book: string;
  reference: string;
  pages: number;
  minutes: number;
  note: string;
}

export interface LectureHearingItem {
  id: string;
  youtubeUrl: string;
  youtubeId: string;
  title: string;
  speaker: string;
  minutes: number;
  timestampNote: string;
  realization: string;
}

export interface DailySadhanaRecord {
  date: string; // YYYY-MM-DD
  tithi: string;
  panchangaNote: string;
  targetRounds: number;
  completedRounds: number;
  chantedBefore7AM: boolean;
  readings: ShastraReadingItem[];
  lectures: LectureHearingItem[];
  reflection: string;
  wakeTime: string;
  mangalaArati: boolean;
}

export interface VaishnavaEvent {
  date: string; // YYYY-MM-DD
  tithi: string;
  paksha: 'Krsna' | 'Gaura';
  masa: string;
  festival: string | null;
  type: 'ekadashi' | 'parana' | 'festival' | 'regular';
  fastingNote: string | null;
  paranaBaseWindow: [string, string] | null; // Base window before city offset
}

export interface IskconCity {
  id: string;
  name: string;
  country: string;
  paranaShiftMinutes: number; // local sunrise shift for Parana calculation
}

export interface CloudAccountState {
  connectedProvider: 'none' | 'google' | 'github';
  userEmailOrHandle: string | null;
  lastSyncedAt: string;
  autoSync: boolean;
}

export const ISKCON_CITIES: IskconCity[] = [
  { id: 'nyc', name: 'New York (Brooklyn)', country: 'USA (EST)', paranaShiftMinutes: 0 },
  { id: 'lax', name: 'Los Angeles (New Dvaraka)', country: 'USA (PST)', paranaShiftMinutes: 14 },
  { id: 'lon', name: 'London (Bhaktivedanta Manor)', country: 'UK (GMT)', paranaShiftMinutes: 22 },
  { id: 'may', name: 'Sri Mayapur Candrodaya Mandir', country: 'India (IST)', paranaShiftMinutes: -35 },
  { id: 'mum', name: 'Mumbai (Juhu / Chowpatty)', country: 'India (IST)', paranaShiftMinutes: -18 },
  { id: 'tor', name: 'Toronto (New Remuna)', country: 'Canada (EST)', paranaShiftMinutes: 8 },
];

export function formatParanaForCity(
  baseWindow: [string, string] | null,
  city: IskconCity
): string | null {
  if (!baseWindow) return null;
  const shiftTime = (hhmm: string, deltaMins: number) => {
    const [h, m] = hhmm.split(':').map(Number);
    const total = h * 60 + m + deltaMins;
    const nh = Math.floor(total / 60);
    const nm = ((total % 60) + 60) % 60;
    const hStr = String(nh).padStart(2, '0'); // taste-skill-ignore
    const mStr = String(nm).padStart(2, '0'); // taste-skill-ignore
    return `${hStr}:${mStr}`;
  };
  return `${shiftTime(baseWindow[0], city.paranaShiftMinutes)} – ${shiftTime(baseWindow[1], city.paranaShiftMinutes)} (${city.name.split(' (')[0]})`;
}

// Built-in November 2026 (Damodara / Kesava Masa, Gaurabda 540) ISKCON Vaishnava Calendar
export const DEFAULT_VAISHNAVA_CALENDAR_NOV_2026: VaishnavaEvent[] = [
  {
    date: '2026-11-01',
    tithi: 'Ekadashi',
    paksha: 'Krsna',
    masa: 'Damodara',
    festival: 'Rama Ekadashi (Fast from grains & beans)',
    type: 'ekadashi',
    fastingNote: 'Complete fast from grains and beans',
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-02',
    tithi: 'Dvadashi',
    paksha: 'Krsna',
    masa: 'Damodara',
    festival: 'Rama Ekadashi Parana (Break Fast)',
    type: 'parana',
    fastingNote: null,
    paranaBaseWindow: ['06:24', '10:18'],
  },
  {
    date: '2026-11-03',
    tithi: 'Trayodashi',
    paksha: 'Krsna',
    masa: 'Damodara',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-04',
    tithi: 'Chaturdashi',
    paksha: 'Krsna',
    masa: 'Damodara',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-05',
    tithi: 'Amavasya',
    paksha: 'Krsna',
    masa: 'Damodara',
    festival: 'Dipavali · Kalipuja (Offering of Ghee Lamps)',
    type: 'festival',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-06',
    tithi: 'Pratipada',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: 'Govardhana Puja · Annakuta · Go-Puja',
    type: 'festival',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-07',
    tithi: 'Dvitiya',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-08',
    tithi: 'Tritiya',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: 'Srila Prabhupada Disappearance Day (Fast till noon)',
    type: 'festival',
    fastingNote: 'Fast till noon in honor of Srila Prabhupada',
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-09',
    tithi: 'Chaturthi',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-10',
    tithi: 'Panchami',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-11',
    tithi: 'Shashthi',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-12',
    tithi: 'Saptami',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-13',
    tithi: 'Ashtami',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: 'Gopashtami · Gosthashtami',
    type: 'festival',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-14',
    tithi: 'Navami',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: 'Jagaddhatri Puja',
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-15',
    tithi: 'Dashami',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-16',
    tithi: 'Ekadashi',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: 'Utthana Ekadashi · Srila Gaura Kisora Dasa Babaji Disappearance',
    type: 'ekadashi',
    fastingNote: 'Complete fast from grains & beans · Bhisma-pancaka begins',
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-17',
    tithi: 'Dvadashi',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: 'Utthana Ekadashi Parana',
    type: 'parana',
    fastingNote: null,
    paranaBaseWindow: ['06:38', '10:24'],
  },
  {
    date: '2026-11-18',
    tithi: 'Trayodashi',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-19',
    tithi: 'Chaturdashi',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: 'Srila Bhugarbha Gosvami & Srila Kasisvara Pandita Disappearance',
    type: 'festival',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-20',
    tithi: 'Purnima',
    paksha: 'Gaura',
    masa: 'Damodara',
    festival: 'Sri Krsna Rasayatra · Tulasi-Saligrama Vivaha · Last Day of Kartik',
    type: 'festival',
    fastingNote: 'Final evening of Damodarastakam lamp offering',
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-21',
    tithi: 'Pratipada',
    paksha: 'Krsna',
    masa: 'Kesava',
    festival: 'Katyayani Vrata Begins (Kesava Masa)',
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-22',
    tithi: 'Dvitiya',
    paksha: 'Krsna',
    masa: 'Kesava',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-23',
    tithi: 'Tritiya',
    paksha: 'Krsna',
    masa: 'Kesava',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-24',
    tithi: 'Chaturthi',
    paksha: 'Krsna',
    masa: 'Kesava',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-25',
    tithi: 'Panchami',
    paksha: 'Krsna',
    masa: 'Kesava',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-26',
    tithi: 'Shashthi',
    paksha: 'Krsna',
    masa: 'Kesava',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-27',
    tithi: 'Saptami',
    paksha: 'Krsna',
    masa: 'Kesava',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-28',
    tithi: 'Ashtami',
    paksha: 'Krsna',
    masa: 'Kesava',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-29',
    tithi: 'Navami',
    paksha: 'Krsna',
    masa: 'Kesava',
    festival: null,
    type: 'regular',
    fastingNote: null,
    paranaBaseWindow: null,
  },
  {
    date: '2026-11-30',
    tithi: 'Ekadashi',
    paksha: 'Krsna',
    masa: 'Kesava',
    festival: 'Utpanna Ekadashi (Fast from grains & beans)',
    type: 'ekadashi',
    fastingNote: 'Complete fast from grains and beans',
    paranaBaseWindow: null,
  },
];

// Client-side parser for any .ics file exported from vaishnavacalendar.org or GCal
export function parseVaishnavaIcs(icsText: string): VaishnavaEvent[] {
  const events: VaishnavaEvent[] = [];
  const blocks = icsText.split('BEGIN:VEVENT').slice(1);
  for (const block of blocks) {
    const dtMatch = block.match(/DTSTART(?:;[^:]*)?:(\d{4})(\d{2})(\d{2})/);
    const sumMatch = block.match(/SUMMARY:(.+)/);
    const descMatch = block.match(/DESCRIPTION:(.+)/);
    if (!dtMatch || !sumMatch) continue;
    const dateStr = `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`;
    const summary = sumMatch[1].trim().replace(/\\,/g, ',');
    const desc = descMatch ? descMatch[1].trim().replace(/\\n/g, ' ') : '';
    const isEkadashi = /ekadasi|ekadashi/i.test(summary);
    const isParana = /break fast|parana/i.test(summary + ' ' + desc);
    events.push({
      date: dateStr,
      tithi: isEkadashi ? 'Ekadashi' : isParana ? 'Dvadashi' : 'Tithi',
      paksha: 'Gaura',
      masa: 'Imported',
      festival: summary,
      type: isEkadashi ? 'ekadashi' : isParana ? 'parana' : 'festival',
      fastingNote: desc || null,
      paranaBaseWindow: isParana ? ['06:30', '10:15'] : null,
    });
  }
  return events;
}

export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const regExp =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

export function getYouTubeThumbUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export const INITIAL_SADHANA_HISTORY: DailySadhanaRecord[] = [
  {
    date: '2026-11-02',
    tithi: 'Damodara Masa · Krishna Dvadashi · Gaurabda 540',
    panchangaNote: 'Rama Ekadashi Parana today · Govardhana Puja Nov 6',
    targetRounds: 16,
    completedRounds: 12,
    chantedBefore7AM: true,
    readings: [
      {
        id: 'rd-2026-11-02-1',
        book: 'Bhagavad-gita As It Is',
        reference: 'Ch. 9, Texts 14 to 22',
        pages: 7,
        minutes: 20,
        note: 'Satatam kirtayanto mam: endeavoring with determination without waiting for mood.',
      },
      {
        id: 'rd-2026-11-02-2',
        book: 'Srimad-Bhagavatam',
        reference: 'Canto 10, Ch. 9, Texts 1 to 11 (Damodara-lila)',
        pages: 2,
        minutes: 10,
        note: 'Mother Yasoda binds Damodara with ropes of unalloyed affection during Kartik.',
      },
      {
        id: 'rd-2026-11-02-3',
        book: 'Nectar of Devotion',
        reference: 'Ch. 7 · Evidence Regarding Devotional Principles',
        pages: 2,
        minutes: 5,
        note: 'Hearing and chanting are the primary limbs of sadhana-bhakti.',
      },
    ],
    lectures: [
      {
        id: 'lec-2026-11-02-1',
        youtubeUrl: 'https://www.youtube.com/watch?v=fbm_O3pD_3c',
        youtubeId: 'fbm_O3pD_3c',
        title: 'Srila Prabhupada · Bhagavad-gita 9.14 Lecture (Chanting with Fixed Determination)',
        speaker: 'A.C. Bhaktivedanta Swami Prabhupada',
        minutes: 42,
        timestampNote: '18:24',
        realization:
          'When the mind wanders during Japa, bring it back to the sound vibration of the Hare Krishna mantra immediately without self-criticism.',
      },
      {
        id: 'lec-2026-11-02-2',
        youtubeUrl: 'https://www.youtube.com/watch?v=kR8BfG8D1qU',
        youtubeId: 'kR8BfG8D1qU',
        title: 'H.G. Chaitanya Charan Prabhu · Steady Daily Sadhana Habits',
        speaker: 'Chaitanya Charan Das',
        minutes: 28,
        timestampNote: '11:05', // taste-skill-ignore
        realization: 'Keep the Japa counter simple so logging takes two seconds.',
      },
    ],
    reflection:
      'Broke Rama Ekadashi fast during the morning Parana window and chanted 12 rounds so far. 4 rounds left before evening.',
    wakeTime: '04:55', // taste-skill-ignore
    mangalaArati: true,
  },
  {
    date: '2026-11-01',
    tithi: 'Damodara Masa · Krishna Ekadashi (Rama Ekadashi)',
    panchangaNote: 'Ekadashi Vrata observed',
    targetRounds: 16,
    completedRounds: 16,
    chantedBefore7AM: true,
    readings: [
      {
        id: 'rd-2026-11-01-1',
        book: 'Srimad-Bhagavatam',
        reference: 'Canto 1, Ch. 2, Texts 6 to 12',
        pages: 14,
        minutes: 45,
        note: 'Sa vai pumsam paro dharmo yato bhaktir adhoksaje: devotional service must be unmotivated and uninterrupted.',
      },
    ],
    lectures: [
      {
        id: 'lec-2026-11-01-1',
        youtubeUrl: 'https://www.youtube.com/watch?v=v7w5N7w9K2c',
        youtubeId: 'v7w5N7w9K2c',
        title: 'H.H. Radhanath Swami · The Essence of Damodara Lila & Kartik Sadhana',
        speaker: 'Radhanath Swami',
        minutes: 50,
        timestampNote: '24:10',
        realization: 'Mother Yasoda’s rope is bound by small, sincere daily offerings rather than occasional grand feats.',
      },
    ],
    reflection: 'Rama Ekadashi: completed 16 rounds by 07:10 AM and offered Damodarastakam lamp in the evening.',
    wakeTime: '04:40', // taste-skill-ignore
    mangalaArati: true,
  },
  {
    date: '2026-10-31',
    tithi: 'Damodara Masa · Krishna Dashami',
    panchangaNote: 'Eves of Ekadashi preparation',
    targetRounds: 16,
    completedRounds: 16,
    chantedBefore7AM: true,
    readings: [
      {
        id: 'rd-2026-10-31-1',
        book: 'Sri Caitanya-caritamrta',
        reference: 'Adi-lila Ch. 7, Texts 73 to 85',
        pages: 9,
        minutes: 30,
        note: 'Panca-tattva mantra clears offenses before chanting Hare Krishna.',
      },
    ],
    lectures: [],
    reflection: 'Completed all 16 rounds before 08:00 AM.',
    wakeTime: '05:05', // taste-skill-ignore
    mangalaArati: true,
  },
  {
    date: '2026-10-30',
    tithi: 'Damodara Masa · Krishna Navami',
    panchangaNote: 'Regular Kartik Vrata',
    targetRounds: 16,
    completedRounds: 16,
    chantedBefore7AM: false,
    readings: [
      {
        id: 'rd-2026-10-30-1',
        book: 'Bhagavad-gita As It Is',
        reference: 'Ch. 9, Texts 1 to 13',
        pages: 10,
        minutes: 30,
        note: 'Raja-vidya raja-guhyam: the most confidential knowledge is joyful to perform.',
      },
    ],
    lectures: [],
    reflection: 'Finished last 2 rounds in the evening after work; glad I completed all 16.',
    wakeTime: '05:25', // taste-skill-ignore
    mangalaArati: false,
  },
  {
    date: '2026-10-29',
    tithi: 'Damodara Masa · Krishna Ashtami (Bahulashtami)',
    panchangaNote: 'Appearance of Radha-kunda',
    targetRounds: 16,
    completedRounds: 16,
    chantedBefore7AM: true,
    readings: [
      {
        id: 'rd-2026-10-29-1',
        book: 'Nectar of Instruction (Upadesamrta)',
        reference: 'Texts 8 to 11',
        pages: 12,
        minutes: 40,
        note: 'Absorbing the mind and words in remembrance during Kartik.',
      },
    ],
    lectures: [],
    reflection: 'Bahulashtami: all 16 rounds completed early.',
    wakeTime: '04:30', // taste-skill-ignore
    mangalaArati: true,
  },
  {
    date: '2026-10-28',
    tithi: 'Damodara Masa · Krishna Saptami',
    panchangaNote: 'Regular Kartik Vrata',
    targetRounds: 16,
    completedRounds: 16,
    chantedBefore7AM: true,
    readings: [
      {
        id: 'rd-2026-10-28-1',
        book: 'Srimad-Bhagavatam',
        reference: 'Canto 1, Ch. 2, Texts 1 to 5',
        pages: 7,
        minutes: 25,
        note: 'Ugra-sravah: hearing with submissive aural reception.',
      },
    ],
    lectures: [],
    reflection: 'Steady morning Japa.',
    wakeTime: '05:00', // taste-skill-ignore
    mangalaArati: true,
  },
  {
    date: '2026-10-27',
    tithi: 'Damodara Masa · Krishna Shashthi',
    panchangaNote: 'Regular Kartik Vrata',
    targetRounds: 16,
    completedRounds: 16,
    chantedBefore7AM: true,
    readings: [
      {
        id: 'rd-2026-10-27-1',
        book: 'Prabhupada Lilamrta',
        reference: 'Vol. 1, Ch. 4',
        pages: 15,
        minutes: 35,
        note: 'Preparing Back to Godhead by hand in Delhi.',
      },
    ],
    lectures: [],
    reflection: 'Good reading focus.',
    wakeTime: '05:00', // taste-skill-ignore
    mangalaArati: true,
  },
  {
    date: '2026-10-26',
    tithi: 'Damodara Masa · Krishna Panchami',
    panchangaNote: 'Regular Kartik Vrata',
    targetRounds: 16,
    completedRounds: 14,
    chantedBefore7AM: false,
    readings: [
      {
        id: 'rd-2026-10-26-1',
        book: 'Bhagavad-gita As It Is',
        reference: 'Ch. 8, Texts 20 to 28',
        pages: 8,
        minutes: 20,
        note: 'Supreme abode beyond material nature.',
      },
    ],
    lectures: [],
    reflection: 'Travel day: completed 14 rounds; logged honestly without guilt and resumed 16 next morning.',
    wakeTime: '05:45', // taste-skill-ignore
    mangalaArati: false,
  },
  {
    date: '2026-10-25',
    tithi: 'Damodara Masa · Krishna Chaturthi',
    panchangaNote: 'Regular Kartik Vrata',
    targetRounds: 16,
    completedRounds: 16,
    chantedBefore7AM: true,
    readings: [
      {
        id: 'rd-2026-10-25-1',
        book: 'Srimad-Bhagavatam',
        reference: 'Canto 1, Ch. 1, Texts 15 to 23',
        pages: 10,
        minutes: 30,
        note: 'Sages of Naimisaranya inquiring from Suta Gosvami.',
      },
    ],
    lectures: [],
    reflection: 'Clear morning session.',
    wakeTime: '04:50', // taste-skill-ignore
    mangalaArati: true,
  },
  {
    date: '2026-10-24',
    tithi: 'Damodara Masa · Krishna Tritiya',
    panchangaNote: 'Regular Kartik Vrata',
    targetRounds: 16,
    completedRounds: 16,
    chantedBefore7AM: true,
    readings: [
      {
        id: 'rd-2026-10-24-1',
        book: 'Bhagavad-gita As It Is',
        reference: 'Ch. 8, Texts 10 to 19',
        pages: 9,
        minutes: 25,
        note: 'Ananya-cetah satatam yo mam smarati nityasah.',
      },
    ],
    lectures: [],
    reflection: 'Focused on clear pronunciation.',
    wakeTime: '05:05', // taste-skill-ignore
    mangalaArati: true,
  },
  {
    date: '2026-10-23',
    tithi: 'Damodara Masa · Krishna Dvitiya',
    panchangaNote: 'Regular Kartik Vrata',
    targetRounds: 16,
    completedRounds: 16,
    chantedBefore7AM: true,
    readings: [
      {
        id: 'rd-2026-10-23-1',
        book: 'Srimad-Bhagavatam',
        reference: 'Canto 1, Ch. 1, Texts 6 to 14',
        pages: 8,
        minutes: 25,
        note: 'Questions of the sages for the welfare of all.',
      },
    ],
    lectures: [],
    reflection: 'Very inspiring class during lunch break.',
    wakeTime: '05:00', // taste-skill-ignore
    mangalaArati: true,
  },
  {
    date: '2026-10-22',
    tithi: 'Damodara Masa · Krishna Pratipada',
    panchangaNote: 'First day of Damodara Masa',
    targetRounds: 16,
    completedRounds: 16,
    chantedBefore7AM: true,
    readings: [
      {
        id: 'rd-2026-10-22-1',
        book: 'Srimad-Bhagavatam',
        reference: 'Canto 10, Ch. 9 (Damodara-lila)',
        pages: 14,
        minutes: 45,
        note: 'Beginning Kartik with Damodara-lila reading.',
      },
    ],
    lectures: [],
    reflection: 'Began Kartik vrata with 16 rounds before 06:45 AM.',
    wakeTime: '04:35', // taste-skill-ignore
    mangalaArati: true,
  },
  {
    date: '2026-10-21',
    tithi: 'Pasankusa Purnima (Sharad Purnima)',
    panchangaNote: 'Kartik Vrata Archana begins',
    targetRounds: 16,
    completedRounds: 16,
    chantedBefore7AM: true,
    readings: [
      {
        id: 'rd-2026-10-21-1',
        book: 'Bhagavad-gita As It Is',
        reference: 'Ch. 8, Texts 1 to 9',
        pages: 10,
        minutes: 30,
        note: 'Remembering Krishna at every moment.',
      },
    ],
    lectures: [],
    reflection: 'Sharad Purnima evening kirtan.',
    wakeTime: '04:50', // taste-skill-ignore
    mangalaArati: true,
  },
  {
    date: '2026-10-20',
    tithi: 'Padmanabha Masa · Shukla Chaturdashi',
    panchangaNote: 'Eve of Purnima',
    targetRounds: 16,
    completedRounds: 16,
    chantedBefore7AM: false,
    readings: [
      {
        id: 'rd-2026-10-20-1',
        book: 'Bhagavad-gita As It Is',
        reference: 'Ch. 7, Texts 25 to 30',
        pages: 7,
        minutes: 20,
        note: 'Punya-karmanam: acting piously frees one from duality.',
      },
    ],
    lectures: [],
    reflection: 'Completed all 16 rounds.',
    wakeTime: '05:10', // taste-skill-ignore
    mangalaArati: false,
  },
];

export function countCompletedRounds(record: DailySadhanaRecord): number {
  return record.completedRounds;
}

export function sumReadingMinutes(record: DailySadhanaRecord): number {
  return record.readings.reduce((acc, item) => acc + item.minutes, 0);
}

export function sumReadingPages(record: DailySadhanaRecord): number {
  return record.readings.reduce((acc, item) => acc + item.pages, 0);
}

export function sumLectureMinutes(record: DailySadhanaRecord): number {
  return record.lectures.reduce((acc, item) => acc + item.minutes, 0);
}

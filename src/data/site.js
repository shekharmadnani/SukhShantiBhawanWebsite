/**
 * ============================================================================
 *  CONTENT — the one file you edit to keep the site current.
 * ============================================================================
 *
 *  Everything the website says about the centre lives here: contact details,
 *  class timings, courses, events, service wings, FAQs. Change a value, run
 *  `npm run build`, and every page that uses it updates.
 *
 *  ⚠  FIELDS MARKED `VERIFY` ARE PLACEHOLDERS.
 *     They could not be confirmed from a public source and must be replaced
 *     with the centre's real details before this site goes live. Search this
 *     file for "VERIFY" to find them all.
 */

module.exports = {
  /* ---------------------------------------------------------- identity --- */
  name: 'Sukh Shanti Bhawan',
  org: 'Brahma Kumaris',
  fullName: 'Brahma Kumaris Sukh Shanti Bhawan',
  locality: 'Sector 115, Noida',
  tagline: 'A quiet place to return to yourself',
  greeting: 'Om Shanti',
  greetingDev: 'ॐ शान्ति',

  // VERIFY — set to the final domain before launch; used for canonical URLs,
  // the sitemap and social share cards.
  url: 'https://sukhshantibhawannoida.org',

  description:
    'A Brahma Kumaris Rajyoga meditation centre in Sector 115, Noida. Free daily meditation, ' +
    'the seven-day Rajyoga foundation course, and courses in positive thinking and stress-free living.',

  /* ----------------------------------------------------------- contact --- */
  contact: {
    // VERIFY — building name / plot number and the exact street line.
    addressLines: ['Sukh Shanti Bhawan', 'Sector 115, Noida', 'Gautam Buddha Nagar, Uttar Pradesh 201307'],
    addressShort: 'Sector 115, Noida, Uttar Pradesh 201307',
    phone: '+91 00000 00000',          // VERIFY
    phoneHref: '+910000000000',        // VERIFY — digits only, for tel: links
    whatsapp: '910000000000',          // VERIFY — country code + number, no +
    email: 'info@sukhshantibhawannoida.org', // VERIFY
    // VERIFY — replace with the centre's own Google Maps place link / embed.
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Brahma+Kumaris+Sector+115+Noida',
    mapsEmbed:
      'https://www.google.com/maps?q=Sector%20115%2C%20Noida%2C%20Uttar%20Pradesh%20201307&output=embed',
    // VERIFY — nearest landmarks help far more than a pin on a map.
    directions: [
      { mode: 'Metro', detail: 'Aqua Line — Sector 101 and Sector 81 are the nearest stations; a short auto ride away.' },
      { mode: 'Road', detail: 'Off the Noida–Greater Noida Expressway, close to the Sector 115 residential blocks.' },
      { mode: 'Parking', detail: 'Free parking is available in front of the centre.' },
    ],
  },

  social: [
    // VERIFY — remove any the centre does not maintain; an empty link is worse
    // than no icon at all.
    { name: 'Facebook', url: 'https://www.facebook.com/p/Sukh-Shanti-Bhawan-100067358058947/', icon: 'facebook' },
    { name: 'YouTube', url: '#', icon: 'youtube' },
    { name: 'Instagram', url: '#', icon: 'instagram' },
    { name: 'WhatsApp', url: 'https://wa.me/910000000000', icon: 'whatsapp' },
  ],

  /* -------------------------------------------------------- navigation --- */
  nav: [
    { id: 'home', label: 'Home', href: '/' },
    { id: 'about', label: 'About', href: '/about.html' },
    { id: 'meditation', label: 'Rajyoga', href: '/meditation.html' },
    { id: 'courses', label: 'Courses', href: '/courses.html' },
    { id: 'services', label: 'Service Wings', href: '/services.html' },
    { id: 'events', label: 'Events', href: '/events.html' },
    { id: 'gallery', label: 'Gallery', href: '/gallery.html' },
    { id: 'contact', label: 'Visit Us', href: '/contact.html' },
  ],

  /* ------------------------------------------------------------ timings --- */
  // VERIFY — every row below. These are the timings common to Brahma Kumaris
  // centres in India, not confirmed timings for this centre.
  timings: {
    note: 'All sessions are free and open to everyone. Please arrive a few minutes early.',
    daily: [
      { name: 'Amrit Vela Meditation', time: '4:00 – 4:45 AM', days: 'Every day', detail: 'The stillest hour of the day, kept by students of the centre.' },
      { name: 'Morning Murli Class', time: '6:30 – 7:30 AM', days: 'Monday – Saturday', detail: 'The daily spiritual study class, in Hindi.' },
      { name: 'Evening Meditation', time: '6:30 – 7:30 PM', days: 'Every day', detail: 'Guided commentary and silent practice. Newcomers welcome.' },
      { name: 'Sunday Gathering', time: '9:00 – 10:30 AM', days: 'Sunday', detail: 'A longer class with discussion, followed by refreshments.' },
    ],
    firstVisit:
      'If this is your first time, come to the evening meditation. Nothing is expected of you — ' +
      'no registration, no fee, no change of belief. Just sit, and see how it feels.',
  },

  /* ------------------------------------------------------------ courses --- */
  courses: [
    {
      slug: 'foundation',
      title: 'Foundation Course in Rajyoga',
      duration: '7 sessions · 1 hour each',
      format: 'One-to-one or small group',
      art: 'course-foundation',
      summary:
        'The starting point for everything else. Seven unhurried conversations that answer the oldest questions — who am I, where do I come from, why does life turn the way it does — and teach you to meditate with your eyes open, anywhere.',
      covers: [
        'The soul: what you actually are, underneath the roles',
        'The Supreme Soul, and how a relationship with the divine works',
        'The cycle of time and the law of karma',
        'Raja Yoga meditation, practised from the first session',
        'The tree of humanity and the confluence age',
        'A way of living that keeps the practice alive',
      ],
      featured: true,
    },
    {
      slug: 'positive-thinking',
      title: 'Positive Thinking',
      duration: '4 sessions',
      format: 'Group workshop',
      art: 'course-positive',
      summary:
        'Thought is the first act of the day and the one we least examine. This course looks at where thoughts come from, why the same ones return, and how to change their quality at the source rather than argue with them.',
      covers: [
        'The four kinds of thought and how to tell them apart',
        'Where wasteful thinking begins',
        'Turning attention into a deliberate act',
        'Daily practices: traffic control, the morning hour',
      ],
    },
    {
      slug: 'stress-free-living',
      title: 'Stress-Free Living',
      duration: '3 sessions',
      format: 'Group workshop',
      art: 'course-stress',
      summary:
        'For anyone carrying more than they can put down. A practical course in the mechanics of stress — how it forms, what it costs, and the small returns to stillness that dissolve it before it settles.',
      covers: [
        'What stress is, physically and mentally',
        'Responses that relieve and responses that store',
        'Traffic control: a one-minute practice, several times a day',
        'Sleep, food and the rhythm of a settled day',
      ],
    },
    {
      slug: 'self-management-leadership',
      title: 'Self-Management Leadership',
      duration: '6 sessions',
      format: 'Group workshop · offered to organisations',
      art: 'course-leadership',
      summary:
        'Leadership that begins with the self. Built for people who carry responsibility for others — in workplaces, institutions and families — and want to carry it without losing themselves in it.',
      covers: [
        'Self-awareness as the first management skill',
        'Deciding clearly under pressure',
        'Listening, and the authority it creates',
        'Values that hold when it is expensive to hold them',
      ],
    },
    {
      slug: 'anger-management',
      title: 'Understanding Anger',
      duration: '3 sessions',
      format: 'Group workshop',
      art: 'course-anger',
      summary:
        'Anger is rarely about the moment it arrives in. This course traces it back to expectation and attachment, and offers something more durable than suppression.',
      covers: [
        'The anatomy of an angry moment',
        'Expectation, attachment and the ego underneath',
        'Forgiveness as a practice, not a feeling',
        'Repairing what anger has already damaged',
      ],
    },
    {
      slug: 'value-education',
      title: 'Values for Students',
      duration: 'Ongoing · by arrangement',
      format: 'Schools and colleges',
      art: 'course-values',
      summary:
        'Sessions taken into schools and colleges around Noida on concentration, self-respect, honesty and handling exam pressure — in language that lands with students rather than lectures them.',
      covers: [
        'Concentration and memory',
        'Self-respect, and what it is not',
        'Handling comparison and exam pressure',
        'Honesty as a practical advantage',
      ],
    },
  ],

  /* ------------------------------------------------------- what we offer --- */
  offerings: [
    {
      icon: 'lotus',
      title: 'Daily Meditation',
      text: 'Open sessions morning and evening. Come once, come every day — both are welcome, and neither costs anything.',
      href: '/meditation.html',
    },
    {
      icon: 'book',
      title: 'Free Courses',
      text: 'The seven-day Rajyoga foundation course, plus short courses in positive thinking, stress and leadership.',
      href: '/courses.html',
    },
    {
      icon: 'hands',
      title: 'Spiritual Counselling',
      text: 'A quiet, confidential conversation with an experienced teacher, by appointment, at no charge.',
      href: '/contact.html',
    },
    {
      icon: 'community',
      title: 'Service in the City',
      text: 'Sessions in schools, hospitals, offices and residential societies across Noida, on request.',
      href: '/services.html',
    },
  ],

  /* ------------------------------------------------------ service wings --- */
  wings: [
    { name: 'Medical Wing', text: 'Doctors and health workers bringing the inner dimension into patient care, and health camps for the neighbourhood.' },
    { name: 'Education Wing', text: 'Value education for students and teachers, taken into schools and colleges across Noida.' },
    { name: 'Youth Wing', text: 'For students and young professionals: purpose, focus, and the questions that do not get asked at work.' },
    { name: "Women's Wing", text: 'Self-respect, inner strength and independence — for women at every stage of life.' },
    { name: 'Business & Industry', text: 'Ethics, stress and leadership sessions for teams and organisations in and around Noida.' },
    { name: 'Senior Citizens', text: 'Companionship, meaning and a settled mind in the later years — a large part of who you will meet here.' },
    { name: 'Art & Culture', text: 'Exhibitions, music and drama that carry spiritual understanding without a lecture.' },
    { name: 'Social Service', text: 'Relief work, cleanliness drives and environmental initiatives, run with local partners.' },
  ],

  /* ------------------------------------------------------------- events --- */
  // VERIFY — dates change every year. Update annually, or the site ages badly.
  events: [
    {
      title: 'Shiv Jayanti — Mahashivratri',
      when: 'February / March',
      art: 'event-shiv',
      text: 'The night the Brahma Kumaris mark as the descent of the Supreme Soul. A full day of meditation, a candlelit evening programme, and the year\'s largest gathering at the centre.',
    },
    {
      title: 'International Day of Yoga',
      when: '21 June',
      art: 'event-yoga',
      text: 'A public morning of Rajyoga meditation in the open, held with residents of the surrounding sectors. Free and open to all.',
    },
    {
      title: 'Raksha Bandhan',
      when: 'August',
      art: 'event-raksha',
      text: 'The thread as a spiritual promise — of purity, and of protection given rather than asked for. One of the warmest days in the centre\'s year.',
    },
    {
      title: 'Deepavali & Spiritual New Year',
      when: 'October / November',
      art: 'event-diwali',
      text: 'Lamps lit in silence rather than noise. An evening of meditation, song and a shared meal to begin the year settled.',
    },
  ],

  /* --------------------------------------------------------- reflections --- */
  // VERIFY — replace with real, attributed words from students of this centre,
  // with their permission. Written placeholders until then.
  reflections: [
    {
      quote:
        'I came because I could not sleep. I stayed because for the first time someone explained my own mind to me in a way that made sense.',
      by: 'Student of the foundation course',
      meta: 'Sector 115, Noida',
    },
    {
      quote:
        'Nobody asked me to believe anything. They asked me to sit for ten minutes and notice what happened. That was the whole beginning.',
      by: 'Evening meditation regular',
      meta: 'Noida',
    },
    {
      quote:
        'Twenty-two years in the same job and I was carrying all of it home. The traffic-control practice sounds too small to work. It worked.',
      by: 'Participant, Stress-Free Living',
      meta: 'Noida',
    },
  ],

  /* ---------------------------------------------------------------- FAQ --- */
  faqs: [
    {
      q: 'Is there any charge?',
      a: 'No. Every class, course and counselling session at every Brahma Kumaris centre in the world is free. The centre is run entirely by its students and accepts no fees for its teaching.',
    },
    {
      q: 'Do I have to change my religion?',
      a: 'No. People of every faith, and of none, study here and go on practising their own tradition. What is taught is a way of understanding and steadying the self, not a replacement for what you already hold.',
    },
    {
      q: 'What should I wear, and what should I bring?',
      a: 'Anything modest and comfortable. Bring nothing. Shoes come off at the door, as they would at any home.',
    },
    {
      q: 'Is this meditation with eyes closed?',
      a: 'Open, usually. Rajyoga is practised with the eyes open and the attention turned inward, so that the same state can be carried into an ordinary day — at a desk, in traffic, in conversation.',
    },
    {
      q: 'Do I need to register before coming?',
      a: 'Not for the daily meditation — simply come. For the seven-day foundation course it helps to call ahead, so a teacher can set aside the right hour for you.',
    },
    {
      q: 'Can you come to our school, office or society?',
      a: 'Yes, and often. Sessions on stress, values, leadership and meditation are taken to schools, hospitals, offices and residential societies across Noida at no cost. Write or call to arrange one.',
    },
  ],

  /* ----------------------------------------------------------- about org --- */
  org_facts: [
    { value: '1937', label: 'Founded in Hyderabad, Sindh' },
    { value: '110+', label: 'Countries served' },
    { value: '8,500+', label: 'Centres worldwide' },
    { value: 'Free', label: 'Every course, always' },
  ],

  values: [
    { name: 'Purity', text: 'A mind without the residue of resentment, and a life simple enough to keep it that way.' },
    { name: 'Peace', text: 'Not the absence of noise. The original state of the self, recoverable at any moment.' },
    { name: 'Love', text: 'Regard that does not depend on what the other person does next.' },
    { name: 'Joy', text: 'The lightness that arrives when nothing is being carried unnecessarily.' },
    { name: 'Knowledge', text: 'Understanding the self, time and God clearly enough to act on it.' },
    { name: 'Power', text: 'The strength to tolerate, to face, to let go, to discern — eight in all.' },
    { name: 'Truth', text: 'Living so that nothing needs to be hidden or explained away.' },
    { name: 'Bliss', text: 'The steady, unspectacular contentment of a self at home in itself.' },
  ],

  /* ------------------------------------------------------------- footer --- */
  footer: {
    blurb:
      'A centre of the Brahma Kumaris World Spiritual University, serving Sector 115 and the neighbouring sectors of Noida. Everything here is offered free of charge.',
    parentLinks: [
      { label: 'Brahma Kumaris (Global)', href: 'https://www.brahmakumaris.com' },
      { label: 'Om Shanti Retreat Centre, Gurugram', href: 'https://www.orcgurgaon.com' },
      { label: 'Brahma Kumaris Media', href: 'https://www.bkmedia.org' },
    ],
  },
};

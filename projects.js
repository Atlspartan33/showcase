// Every project on the site. Edit here — the page renders from this list.
// status: "live" = public link anyone can open
//         "lab"  = built, runs on my machine or a private link
//         "family" = live, but the link stays private (kids' voices/photos)
// img: file in img/ (no extension). Omit for a bold type card.
// video: file in video/ (no extension), plays in the detail sheet.

window.CATEGORIES = [
  { id: "kids",  label: "For the kids" },
  { id: "games", label: "Games" },
  { id: "play",  label: "Toys & experiments" },
  { id: "film",  label: "Film & motion" },
  { id: "books", label: "Books" },
  { id: "work",  label: "Work" },
];

window.PROJECTS = [
  // ── For the kids ────────────────────────────────────────────
  {
    id: "puppet", cat: "kids", status: "live",
    title: "Puppet Show",
    line: "Point a phone at someone. On the TV, they become a dinosaur.",
    body: "The phone tracks body pose and sends only the joint positions to a TV page, where a cartoon dinosaur is rigged to them. No video leaves the phone. Built after the kids lost it over the yoga coach and wanted to be the character themselves.",
    tags: ["Pose tracking", "Phone → TV", "Real-time"],
    url: "https://atlspartan33.github.io/puppet-show/", img: "puppet",
  },
  {
    id: "glam", cat: "kids", featured: true, status: "live",
    title: "Tori's Glam Studio",
    line: "A live makeup-and-costume mirror that follows her face.",
    body: "Face tracking in the browser pins makeup, crowns and costumes to her as she moves. Snap a picture, keep a gallery. Designed for her tablet and her taste.",
    tags: ["Face tracking", "Tablet app", "For Tori"],
    url: "https://atlspartan33.github.io/tori-glam-studio/", img: "glam",
  },
  {
    id: "herolab", cat: "kids", status: "live",
    title: "TJ's Hero Lab",
    line: "A superhero mirror: helmets, face paint, and powers that fire from your hands.",
    body: "Sibling to the Glam Studio. Helmets sculpted in Blender, hand tracking triggers the powers, GPU particle effects, and two kids can suit up at the same time for combo moves.",
    tags: ["Hand + face tracking", "3D helmets", "For TJ"],
    url: "https://atlspartan33.github.io/tj-hero-lab/", img: "herolab",
  },
  {
    id: "puzzles", cat: "kids", status: "live",
    title: "Puzzle Time",
    line: "Offline jigsaws cut from our own picture-book art.",
    body: "Each kid gets their own size: 4 to 9 pieces for TJ, 12 to 48 for Tori. Installs on the tablet and works with no Wi-Fi, which is the whole point in the car.",
    tags: ["Offline app", "Two skill levels"],
    url: "https://atlspartan33.github.io/kid-puzzles/", img: "puzzles",
  },
  {
    id: "greyhound", cat: "kids", status: "family",
    title: "Greyhound Getaway",
    line: "A 3D runner with five playable characters, original songs, and the kids' own voices.",
    body: "Every character gets their own levels and chasers, including a goose named Honkers and a cafeteria lady named Ms. Ladle. Animated cut-scenes, a song per level, and voice lines the kids recorded. The link stays in the family because of those recordings.",
    tags: ["3D game", "Original music", "Family voices"],
  },
  {
    id: "turbo", cat: "kids", status: "lab",
    title: "Turbo TJ",
    line: "A kid-sized open-world driving game.",
    body: "Six lands to cruise. TJ designed four of them; Tori lobbied hard for the other two, Candy Kingdom and Beach Party.",
    tags: ["3D game", "Open world"], img: "turbo",
  },
  {
    id: "obby", cat: "kids", status: "lab",
    title: "Sky Run",
    line: "A Roblox obstacle course starring the two of them.",
    body: "Written in Luau and playtested by having Claude drive Roblox Studio directly: running the course, reading the console, fixing the jumps.",
    tags: ["Roblox", "Luau"], img: "obby",
  },
  {
    id: "space", cat: "kids", status: "lab",
    title: "Space Trip",
    line: "A 3D solar system you can fly through, planet by planet.",
    body: "Realistic planet textures, a fly-to for every world, and a kid-friendly guide. TJ loved it, which is the only review that counts.",
    tags: ["3D", "Science"], img: "space",
  },
  {
    id: "chain", cat: "kids", status: "lab",
    title: "Chain Reaction",
    line: "A Lego-pegboard physics toy. Build it, then knock the first one over.",
    body: "Ramps, dominoes and balls on a pegboard with real physics, plus a science tab with fire, rockets, steam and foam, and a sticker book for the good runs.",
    tags: ["Physics", "For TJ"], img: "chain",
  },
  {
    id: "shrink", cat: "kids", status: "lab",
    title: "Shrink Lab",
    line: "Six science sims that show it happening before they explain it.",
    body: "Water molecules as jellies, jumping on other planets, making a cloud, pushing and sliding, sorting sounds, and a trip inside the Earth.",
    tags: ["Science", "6 sims"], img: "shrink",
  },
  {
    id: "deepdig", cat: "kids", status: "lab",
    title: "Deep Dig",
    line: "Dig from Atlanta straight down to the center of the Earth.",
    body: "Every layer from the backyard to the inner core in 3D, plus a volcano cut-away.",
    tags: ["3D", "Geology"], img: "deepdig",
  },
  {
    id: "minus", cat: "kids", status: "lab",
    title: "Minus Monsters",
    line: "Feed the monsters, master subtraction.",
    body: "A fluency game aimed at the hard part, crossing ten. Includes a voice-answer lightning round, boss monsters, and a monster maker.",
    tags: ["Math", "Voice input", "For Tori"],
  },
  {
    id: "chess", cat: "kids", status: "lab",
    title: "Chess Points",
    line: "A sticker-book tracker for Tori's chess wins.",
    body: "Points and badges for practice and games, designed to feel like her sticker book, not a spreadsheet.",
    tags: ["Tracker", "For Tori"],
  },

  // ── Games ───────────────────────────────────────────────────
  {
    id: "badbid", cat: "games", featured: true, status: "lab",
    title: "BAD BID",
    line: "A Spades roguelike set at the cookout.",
    body: "Balatro-style runs on top of real Spades. Bid, run the table, stack perks, and beat a lineup of bosses from the church fellowship hall to the backyard. Comes with a 40-second trailer.",
    tags: ["Card roguelike", "Original art", "Trailer"],
    img: "badbid", video: "badbid",
  },
  {
    id: "crazyyear", cat: "games", status: "lab",
    title: "CRAZY YEAR",
    line: "Crazy Eights as a year-long points race against rival characters.",
    body: "Chain cards for points, pick a starter perk, and race a rival whose next score is always on screen, so you can see exactly how far behind you are.",
    tags: ["Card roguelike", "Phone"],
  },
  {
    id: "turfwar", cat: "games", status: "lab",
    title: "TURF WAR",
    line: "Scrabble where every word is territory.",
    body: "A word's score is its strength. Outscore it with a crossing word and you flip it to your side. Thirty points or more and it becomes a fortress.",
    tags: ["Word game", "vs. bot"],
  },
  {
    id: "deadend", cat: "games", status: "lab",
    title: "DEAD END",
    line: "Scrabble meets Uno, built around one shared word.",
    body: "Shed your letters by extending a word the whole table shares, and don't be the one left holding it. The rules were tested in a simulator before a single card was printed.",
    tags: ["Tabletop", "Simulated rules"],
  },
  {
    id: "fourdeep", cat: "games", status: "lab",
    title: "Four Deep",
    line: "A daily grouping puzzle rooted in Black culture.",
    body: "Sixteen tiles, four hidden groups, one puzzle a day. Built as an Android app with a tutorial and a hint coach.",
    tags: ["Daily puzzle", "Android"],
  },
  {
    id: "aivsculture", cat: "games", status: "lab",
    title: "AI vs. the Culture",
    line: "A daily survey party game: your crew's answers against the AI's.",
    body: "Everyone answers the same prompt, then you find out whether the AI read the room better than you did.",
    tags: ["Party game", "Android"],
  },
  {
    id: "crib", cat: "games", status: "lab",
    title: "The Crib",
    line: "A Sims-style sitcom where Claude runs four roommates' minds.",
    body: "Each roommate has their own personality and wants, and the AI decides what they do next. Hard-capped at two dollars of compute so the sitcom can't run up a bill.",
    tags: ["AI agents", "Simulation"],
  },

  // ── Toys & experiments ──────────────────────────────────────
  {
    id: "form", cat: "play", status: "live",
    title: "FORM",
    line: "A yoga coach that watches your form through the camera.",
    body: "Pose tracking runs on the device and checks angles against each pose, then talks you into position. My first project that senses the body instead of waiting for a tap.",
    tags: ["Pose tracking", "Voice cues"],
    url: "https://atlspartan33.github.io/form-yoga/",
  },
  {
    id: "piano", cat: "play", status: "live",
    title: "Piano Coach",
    line: "Falling-notes practice wired to my own digital piano.",
    body: "Connects to the Casio over MIDI. Wait mode holds each note until you play it. Built to learn one Bruno Mars song, so that's the song it ships with.",
    tags: ["MIDI", "Practice tool"],
    url: "https://atlspartan33.github.io/piano-coach/", img: "piano",
  },
  {
    id: "inkchoir", cat: "play", status: "lab",
    title: "Ink Choir",
    line: "Touch to sing. Fluid ink that harmonizes with you.",
    body: "Drag across the screen to stir ink and voice a synthetic choir. Record eight-second loops and layer them into a chord.",
    tags: ["WebGL", "Audio synth"], img: "inkchoir",
  },
  {
    id: "jelly", cat: "play", status: "lab",
    title: "Jelly Doodles",
    line: "Draw a shape. It comes alive.",
    body: "Anything you draw becomes a squishy, googly-eyed jelly with real soft-body physics. Fling it, flip gravity, dress it up.",
    tags: ["Physics", "Drawing"], img: "jelly",
  },
  {
    id: "planet", cat: "play", status: "lab",
    title: "Pocket Planet",
    line: "Terraform a planet that fits in your hand.",
    body: "Raise land, pour oceans, plant trees, build houses and drop in sheep while a sun orbits through day and night.",
    tags: ["3D", "Sandbox"], img: "planet",
  },
  {
    id: "horizon", cat: "play", status: "lab",
    title: "Horizon Dive",
    line: "A real-time black-hole ray tracer with a time-dilation clock.",
    body: "Fall toward Sagittarius A* and watch the light bend in real time, while a second clock shows how much time has passed back home.",
    tags: ["WebGL", "Physics"],
  },

  // ── Film & motion ───────────────────────────────────────────
  {
    id: "softness", cat: "film", featured: true, status: "lab",
    title: "The Man Who Mistook Hardness for Strength",
    line: "An 88-second personal film. Hard cuts that turn into water.",
    body: "The first half is slabs, snap cuts and heavy type; it shatters and becomes a water shader for the second. A piece about what strength actually is.",
    tags: ["Motion graphics", "Shader", "88s"],
    img: "softness", video: "softness",
  },
  {
    id: "tinydoor", cat: "film", status: "lab",
    title: "Tiny Door",
    line: "A 24-second infinite-zoom loop through the kids' imaginary places.",
    body: "Through a snow globe, into a fall park, over Atlanta at night, out to the moon, and back home. It never ends, by design.",
    tags: ["AI video", "Seamless loop"],
    img: "tinydoor", video: "tinydoor",
  },
  {
    id: "rewirevid", cat: "film", status: "lab",
    title: "How to Build an Agentic Workflow",
    line: "A 59-second collage explainer for my AI course.",
    body: "Cut-paper collage style, built entirely in code. The first of a lesson-by-lesson explainer series.",
    tags: ["Explainer", "59s"],
    img: "rewire", video: "rewire",
  },
  {
    id: "northwind", cat: "film", status: "lab",
    title: "Northwind Pre-Read",
    line: "An 81-second animated executive pre-read.",
    body: "An animated briefing in place of the memo before the meeting. A test of whether motion can replace the deck nobody reads.",
    tags: ["Executive comms", "81s"],
    img: "northwind", video: "northwind",
  },

  // ── Books ───────────────────────────────────────────────────
  {
    id: "books", cat: "books", featured: true, status: "lab",
    title: "Tori & TJ's Big Adventures",
    line: "A picture-book series starring my kids and our Boston terrier, Bean.",
    body: "Four books written: Tori and the Funny Greyhound, A Dinosaur for a Pet, Bean Goes to the Gym, and Who Made This Mess? Illustrated with AI and written for real bedtimes.",
    tags: ["4 books", "Illustrated"], img: "books",
  },

  // ── Work ────────────────────────────────────────────────────
  {
    id: "rewire", cat: "work", status: "lab",
    title: "REWIRE",
    line: "A 12-week course on redesigning work around AI.",
    body: "The curriculum behind my AI Enablement work: each week takes one real workflow and rebuilds it AI-first, with a phone app to learn on.",
    tags: ["Curriculum", "Learning app"],
  },
  {
    id: "hold", cat: "work", status: "lab",
    title: "Hold",
    line: "A simulator for practicing how to facilitate a hard conversation.",
    body: "You facilitate a group member with a hidden backstory. Afterward a debrief reveals what he was carrying, and where your choices opened him up or shut him down.",
    tags: ["AI roleplay", "Facilitation"],
  },
  {
    id: "miro", cat: "work", status: "lab",
    title: "Talk It Out, Map It Out",
    line: "Narrate a process out loud; get current and future-state maps in Miro.",
    body: "Walk through how the work really happens, Claude turns it into a process map, flags the gaps as sticky notes, and drafts the AI-first version beside it.",
    tags: ["Process mapping", "Miro"],
  },
];

import { PrismaClient, MediaType, PostPrivacy } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateIdFromEntropySize } from "lucia";
import {
  getTextEmbedding,
  getMultimodalEmbedding,
  normalizeVector,
  analyzePostWithGemini,
} from "../src/lib/vertex";
import { createModerationCaseFromAI } from "../src/lib/moderation";
import { sendPermanentBanEmail } from "../src/lib/email";
import { Storage } from "@google-cloud/storage";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

// --- CONFIGURATION ---
const prisma = new PrismaClient();
const storage = new Storage({
  keyFilename: process.env.GCS_CREDENTIALS,
  projectId: process.env.GCS_PROJECT_ID,
});
const bucketName = process.env.GCS_BUCKET!;
const bucket = storage.bucket(bucketName);

// --- DATA: NAMES (EXPANDED) ---
const FIRST_NAMES = [
  "Alice",
  "Bob",
  "Charlie",
  "Diana",
  "Evan",
  "Fiona",
  "George",
  "Hannah",
  "Ian",
  "Julia",
  "Kevin",
  "Luna",
  "Mason",
  "Nina",
  "Oscar",
  "Penny",
  "Quinn",
  "Ryan",
  "Sophia",
  "Tyler",
  "Uma",
  "Victor",
  "Wendy",
  "Xavier",
  "Yuki",
  "Zara",
  "Aaron",
  "Bella",
  "Caleb",
  "Daisy",
  "Ethan",
  "Faith",
  "Gabe",
  "Holly",
  "Isaac",
  "Jade",
  "Kyle",
  "Lily",
  "Max",
  "Nora",
  "Owen",
  "Piper",
  "Quincy",
  "Ruby",
  "Sam",
  "Tara",
  "Umar",
  "Violet",
  "Wade",
  "Zoe",
  "Adam",
  "Brian",
  "Catherine",
  "David",
  "Eleanor",
  "Frank",
  "Grace",
  "Henry",
  "Isabel",
  "Jack",
  "Liam",
  "Mia",
  "Noah",
  "Olivia",
  "Patrick",
  "Rachel",
  "Steven",
  "Tracy",
  "Ursula",
  "Vincent",
  "William",
  "Xena",
  "Yvonne",
  "Zachary",
  "Amelia",
  "Benjamin",
  "Chloe",
  "Daniel",
  "Emma",
  "Finn",
  "Gabriel",
  "Harper",
  "Isaiah",
  "Josephine",
  "Kai",
  "Lucas",
  "Mila",
  "Nathan",
  "Oliver",
  "Penelope",
];

const LAST_NAMES = [
  "Chen",
  "Martinez",
  "Kim",
  "Patel",
  "Rodriguez",
  "Johnson",
  "Smith",
  "Lee",
  "Brown",
  "Garcia",
  "Davis",
  "Wilson",
  "Anderson",
  "Taylor",
  "Thomas",
  "Moore",
  "Jackson",
  "Martin",
  "Thompson",
  "White",
  "Harris",
  "Clark",
  "Lewis",
  "Walker",
  "Hall",
  "Allen",
  "Young",
  "King",
  "Wright",
  "Lopez",
  "Hill",
  "Scott",
  "Green",
  "Adams",
  "Baker",
  "Nelson",
  "Carter",
  "Mitchell",
  "Roberts",
  "Turner",
  "Phillips",
  "Campbell",
  "Parker",
  "Evans",
  "Edwards",
  "Collins",
  "Stewart",
  "Morris",
  "Rogers",
  "Reed",
  "Cook",
  "Morgan",
  "Bell",
  "Murphy",
  "Bailey",
  "Rivera",
  "Cooper",
  "Richardson",
  "Cox",
  "Howard",
  "Ward",
  "Torres",
  "Peterson",
  "Gray",
  "Ramirez",
  "James",
  "Watson",
  "Brooks",
  "Kelly",
  "Sanders",
];

// --- DATA: INTERESTS & LOCATIONS ---
const INTEREST_TAGS = [
  "Technology",
  "Sports",
  "Music",
  "Art",
  "Travel",
  "Food",
  "Fashion",
  "Photography",
  "Gaming",
  "Fitness",
  "Books",
  "Movies",
  "Science",
  "Business",
  "Education",
  "Health",
  "Nature",
  "Pets",
  "Lifestyle",
  "Relationships",
  "Mental Health",
  "Career",
  "Finance",
  "News",
  "Culture",
  "Self Improvement",
  "Entertainment",
  "Internet Culture",
];
// Load location data// --- LOCATION HANDLING ---
interface LocationData {
  id: number;
  name: string;
  iso2: string;
  states: {
    id: number;
    name: string;
    iso2: string;
    cities: { id: number; name: string }[];
  }[];
}

interface LocationCoords {
  countryCode: string;
  provinceCode: string | null;
  districtCode: string | null;
  label: string; // For console logging
}

let locationData: LocationData[] = [];
try {
  const locationPath = path.join(process.cwd(), "countries+states+cities.json");
  if (fs.existsSync(locationPath)) {
    locationData = JSON.parse(fs.readFileSync(locationPath, "utf-8"));
  }
} catch (error) {
  console.warn("Location data not found. Using generic defaults.");
}
function getSingleValidLocation(): LocationCoords {
  if (locationData.length === 0)
    return {
      countryCode: "1",
      provinceCode: null,
      districtCode: null,
      label: "Default",
    };

  // Try up to 5 times to find a location with a city
  for (let i = 0; i < 5; i++) {
    const country =
      locationData[Math.floor(Math.random() * locationData.length)];
    if (country.states?.length > 0) {
      const state =
        country.states[Math.floor(Math.random() * country.states.length)];
      if (state.cities?.length > 0) {
        const city =
          state.cities[Math.floor(Math.random() * state.cities.length)];
        return {
          countryCode: country.id.toString(),
          provinceCode: state.id.toString(),
          districtCode: city.id.toString(),
          label: `${city.name}, ${state.name}, ${country.name}`,
        };
      }
    }
  }
  // Fallback if random picking failed to find deep city structure
  return {
    countryCode: "1",
    provinceCode: null,
    districtCode: null,
    label: "Fallback",
  };
}

// --- BIO TEMPLATES (EXPANDED) ---
const BIO_TEMPLATES = {
  POSITIVE: [
    "Optimistic explorer passionate about {interests}. Always looking for new adventures!",
    "Enthusiastic learner diving deep into {interests}. Love sharing positive vibes!",
    "Creative soul inspired by {interests}. Spreading joy one day at a time.",
    "Adventure seeker with a heart for {interests}. Life's too short not to smile!",
    "Positive thinker focused on {interests}. Building a brighter future.",
    "Lover of {interests} and sunny days. Making every moment count!",
    "Dreaming big and working hard on {interests}. grateful for the little things.",
    "Smiling through life while exploring {interests}. Happiness is a choice!",
    "Fueled by coffee and {interests}. Spreading kindness everywhere I go.",
    "Collecting moments, not things. Passionate about {interests}.",
  ],
  NEUTRAL: [
    "Curious mind interested in {interests}. Taking life one step at a time.",
    "Balanced individual exploring {interests}. Open to new ideas and experiences.",
    "Practical thinker engaged with {interests}. Steady and reliable.",
    "Reflective person delving into {interests}. Finding meaning in everyday things.",
    "Calm observer passionate about {interests}. Going with the flow.",
    "Just here to share my thoughts on {interests}. Simple living.",
    "Exploring the nuances of {interests}. Observer of the world.",
    "Quietly working on my goals in {interests}. Learning every day.",
    "Appreciating the simple things in {interests}. Life is a journey.",
    "Somewhere between {interests} and reality. Just being me.",
  ],
  NEGATIVE: [
    "Struggling with life's challenges while interested in {interests}. Hoping for better days.",
    "Skeptical thinker questioning {interests}. Life feels overwhelming sometimes.",
    "Introspective soul dealing with {interests}. Searching for purpose amid doubts.",
    "Weary traveler exploring {interests}. Tired of the same old struggles.",
    "Critical mind analyzing {interests}. Wondering if things will ever improve.",
    "Feeling lost in the world of {interests}. Just trying to get by.",
    "Overwhelmed by everything surrounding {interests}. Need a break.",
    "Cynical about {interests}. It's hard to find the good sometimes.",
    "Battling my demons while distracting myself with {interests}.",
    "Not sure where I fit in with {interests}. Everything is gray.",
  ],
  HARMFUL: [
    "Edgy commentator on {interests}. Not afraid to speak my mind, no matter what.",
    "Sarcastic observer of {interests}. Pointing out what's wrong with everything.",
    "Provocative thinker in {interests}. Challenging norms and pushing boundaries.",
    "Cynical explorer of {interests}. Exposing the flaws in society.",
    "Rebellious soul into {interests}. Questioning authority at every turn.",
    "Here to disrupt the {interests} scene. I don't play nice.",
    "Brutal honesty about {interests}. If you can't handle it, leave.",
    "Tearing down {interests} one post at a time. Watch me burn it down.",
    "Zero filter when it comes to {interests}. Deal with it.",
    "Anti-{interests} and proud. Haters gonna hate.",
  ],
};

function generateBio(personality: string, interests: string[]): string {
  const templates =
    BIO_TEMPLATES[personality as keyof typeof BIO_TEMPLATES] ||
    BIO_TEMPLATES.NEUTRAL;
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template.replace("{interests}", interests.slice(0, 2).join(" and "));
}

// --- SAMPLE POSTS DATA ---

const SAMPLE_POSTS = {
  POSITIVE: [
    {
      content:
        "Just finished my morning run at the beach. The sunrise was absolutely breathtaking! Feeling energized and ready to tackle the day! #Fitness #Nature",
      image:
        "https://images.unsplash.com/flagged/photo-1556746834-cbb4a38ee593?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bW9ybmluZyUyMHJ1bnxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Working on a new AI project that uses machine learning to recommend music based on emotions. This is so exciting! Can't wait to share the results. #Technology #AI",
      image:
        "https://images.unsplash.com/photo-1628017973088-8feb5de8dddd?w=800&q=80&fm=jpg",
    },
    {
      content:
        "Tried a new recipe today - homemade ramen from scratch. It took 3 hours but it was SO worth it! Best meal I've made this month. #Food #Cooking",
      image:
        "https://images.unsplash.com/photo-1638866281450-3933540af86a?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8cmFtZW58ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Hiking trip to the mountains this weekend. The views were incredible and totally worth the 6-hour climb! Nature is the best therapy. #Travel #Hiking",
      image:
        "https://images.unsplash.com/photo-1551632811-561732d1e306?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aGlraW5nfGVufDB8fDB8fHww",
    },
    {
      content:
        "Just launched my photography portfolio website after months of work. Check it out and let me know what you think! So proud of this achievement. #Photography #Art",
      image:
        "https://images.unsplash.com/photo-1522199755839-a2bacb67c546?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8cG9ydGZvbGlvJTIwd2Vic2l0ZXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Coffee shop hopping in the city today. Found an amazing hidden gem with the best latte art! Love exploring new places. #Travel #Food",
      image:
        "https://images.unsplash.com/photo-1634874495432-cb368c167e9b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bmV3JTIweW9yayUyMGNhZmV8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Started learning meditation and it's already making a huge difference in my daily stress levels. Highly recommend! Peace of mind is everything. #Health #Fitness",
      image:
        "https://images.unsplash.com/photo-1529693662653-9d480530a697?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8Z3JvdXAlMjBtZWRpdGF0aW9ufGVufDB8fDB8fHww",
    },
    {
      content:
        "Attended an amazing tech conference today. So many inspiring speakers and innovative ideas! The future of tech looks bright. #Technology #Business",
      image:
        "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8dGVjaCUyMGNvbmZlcmVuY2V8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Beach cleanup with friends today. Small actions can make a big difference! Proud of our community effort. #Nature #Environment",
      image:
        "https://images.unsplash.com/photo-1610093703375-6d8fd641294b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8YmVhY2glMjBjbGVhbnVwfGVufDB8fDB8fHww",
    },
    {
      content:
        "Finally finished that book I've been reading for months. Such a beautiful story about personal growth. Life-changing read! #Books #Education",
      image:
        "https://images.unsplash.com/photo-1598024055266-e772a5f8c128?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8cmVhZGluZ3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Just got promoted at work! All the hard work finally paid off. Celebrating tonight! #Business #Success",
      image:
        "https://plus.unsplash.com/premium_photo-1733317384289-ad17022d64bb?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDE2fHx8ZW58MHx8fHx8",
    },
    {
      content:
        "My garden is blooming beautifully this season. Nature is amazing! #Nature #Gardening",
      image:
        "https://images.unsplash.com/photo-1601654253194-260e0b6984f9?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8Z2FyZGVufGVufDB8fDB8fHww",
    },
    {
      content:
        "Won my first gaming tournament today! The practice was worth it! #Gaming #Esports",
      image:
        "https://images.unsplash.com/photo-1548686304-5c3be888a00b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8ZXNwb3J0fGVufDB8fDB8fHww",
    },
    {
      content:
        "Discovered a new band and they're incredible. Music is life! #Music #Discovery",
      image:
        "https://images.unsplash.com/photo-1499364615650-ec38552f4f34?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDI1fHx8ZW58MHx8fHx8",
    },
    {
      content:
        "Finished my first 5K run today! Never thought I could do it! #Fitness #Sports",
      image:
        "https://images.unsplash.com/photo-1645822937278-5e84025713f3?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8NWslMjBydW58ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Just shipped the new feature! production deployment went smooth. Time to celebrate! #DevLife #Success",
      image:
        "https://images.unsplash.com/photo-1551434678-e076c223a692?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8ZGV2fGVufDB8fDB8fHww",
    },
    {
      content:
        "My new dual-monitor setup is a game changer. Productivity levels. #Workstation #Tech",
      image:
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80&fm=jpg",
    },
    {
      content:
        "Attended an incredible workshop on AI ethics today. The future is fascinating! #AI #Learning",
      image:
        "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&q=80&fm=jpg",
    },
    {
      content:
        "Finally got that promotion I've been working towards! Hard work pays off. #Career #Grateful",
      image:
        "https://plus.unsplash.com/premium_photo-1664474653221-8412b8dfca3e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8ZXZlbnR8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Love my team! We crushed our quarterly goals a week early. #Teamwork #Business",
      image:
        "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=800&q=80&fm=jpg",
    },
    {
      content:
        "Chasing waterfalls today. The sound of the water is so healing. #Nature #Travel",
      image:
        "https://images.unsplash.com/photo-1482685945432-29a7abf2f466?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8d2F0ZXJmYWxsfGVufDB8fDB8fHww",
    },
    {
      content:
        "Camping under a sky full of stars. I've never seen the Milky Way this clearly. #Camping #Night",
      image:
        "https://images.unsplash.com/photo-1537565266759-34bbc16be345?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content:
        "Morning hike to catch the sunrise. Worth every step of the climb. #Hiking #Views",
      image:
        "https://images.unsplash.com/photo-1682686578615-39549501dd08?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8aGlrZXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Beach vibes only. Salt water cures everything. #Summer #Vacation",
      image:
        "https://images.unsplash.com/photo-1519338381761-c7523edc1f46?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YmVhY2glMjBmdW58ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Road trip through the mountains! The autumn colors are unreal right now. #RoadTrip #Fall",
      image:
        "https://images.unsplash.com/photo-1551632811-561732d1e306?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aGlraW5nfGVufDB8fDB8fHww",
    },
    {
      content:
        "Exploring ancient ruins today. History comes alive here. #History #Travel",
      image:
        "https://images.unsplash.com/photo-1717518215340-0d1184c493fa?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YW5jaWVudCUyMHJ1aW5zfGVufDB8fDB8fHww",
    },
    {
      content:
        "Homemade pasta night! Flour everywhere but totally worth it. #Cooking #Foodie",
      image:
        "https://images.unsplash.com/photo-1607358125900-8a240b044c74?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fGhvbWVtYWRlJTIwcGFzdGF8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Best brunch spot in the city! Avocado toast game is strong here. #Brunch #Food",
      image:
        "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8YXZhY2FkbyUyMHRvYXN0fGVufDB8fDB8fHww",
    },
    {
      content:
        "Sunday market haul! Fresh veggies and beautiful flowers. #SupportLocal #Market",
      image:
        "https://images.unsplash.com/photo-1485637701894-09ad422f6de6?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZmFybWVycyUyMG1hcmtldHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Coffee art mastery level: Beginner, but it tastes good! #Coffee #Morning",
      image:
        "https://images.unsplash.com/photo-1462917882517-e150004895fa?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8bWFraW5nJTIwY29mZmVlfGVufDB8fDB8fHww",
    },
    {
      content:
        "Trying out a new vegan recipe. Surprisingly delicious! #Vegan #Health",
      image:
        "https://images.unsplash.com/photo-1541014741259-de529411b96a?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8dmVnYW4lMjBtZWFsfGVufDB8fDB8fHww",
    },
    {
      content:
        "Just finished painting this landscape. It's not perfect, but it's mine. #Art #Painting",
      image:
        "https://images.unsplash.com/photo-1752649935095-ac8f23ec446b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTl8fHBhaW50aW5nJTIwd29ya3Nob3B8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "New guitar day! Time to learn some new riffs. #Music #Guitar",
      image:
        "https://images.unsplash.com/photo-1758525863593-e86fbfa50615?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fGd1aXRhciUyMGNsYXNzfGVufDB8fDB8fHww",
    },
    {
      content: "Ran my first 10k! Legs are jelly but spirit is high.",
      image:
        "https://images.unsplash.com/photo-1581889470536-467bdbe30cd0?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTR8fHJ1bm5pbmd8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Yoga in the park. Finding my center.",
      image:
        "https://images.unsplash.com/photo-1758274538676-87c2314bca60?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8eW9nYSUyMGluJTIwdGhlJTIwcGFya3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "My favourite book club ! discussing modern classics.",
      image:
        "https://images.unsplash.com/photo-1460518451285-97b6aa326961?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Ym9vayUyMGNsdWJ8ZW58MHx8MHx8fDA%3Dg",
    },
    {
      content: "My garden is thriving! Look at these sunflowers!",
      image:
        "https://images.unsplash.com/photo-1637257819562-5b2aa2b7bcf1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8c3VuZmxvd2VyJTIwZmFybXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Adopted a puppy! Meet Max, the newest member of the family. #Dogs #Pets",
      image:
        "https://images.unsplash.com/photo-1546527868-ccb7ee7dfa6a?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8cHVwcHl8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Photography walk downtown. Capturing the city lights. #Photography #City",
      image:
        "https://images.unsplash.com/photo-1634891844698-f34b2ef0a984?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwcm9maWxlLXBhZ2V8Mnx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content: "Winning streak! Finally beat the final boss. #Gaming #Gamer",
      image:
        "https://images.unsplash.com/photo-1542751371-adc38448a05e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZXNwb3J0fGVufDB8fDB8fHww",
    },
    {
      content:
        "We finally adopted this little guy today! Everyone, meet Max. My heart is so full. 🐶 #Adoption #NewBestFriend",
      image:
        "https://images.unsplash.com/photo-1591160690555-5debfba289f0?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Promoted to Senior Manager! Hard work really does pay off. Champagne time! 🥂 #Career #Success",
      image:
        "https://images.unsplash.com/photo-1551836022-d5d88e9218df?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "First loaf of sourdough bread that didn't collapse! The smell in this kitchen is heavenly. 🍞 #Baking #Sourdough",
      image:
        "https://images.unsplash.com/photo-1597604391235-a7429b4b350c?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c291cmRvdWdoJTIwYnJlYWR8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Volunteered at the beach cleanup today. We collected over 50kg of plastic! 💪 #Environment #Volunteer",
      image:
        "https://images.unsplash.com/photo-1758599668949-5118d71838fd?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDE3fHx8ZW58MHx8fHx8",
    },
    {
      content:
        "The Northern Lights were visible from my backyard last night. Nature is magic. ✨ #Aurora #NightSky",
      image:
        "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Finally finished knitting this sweater. It took 3 months but look at that stitch definition! 🧶 #Knitting #DIY",
      image:
        "https://images.unsplash.com/photo-1581497396202-5645e76a3a8e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDI5fHx8ZW58MHx8fHx8",
    },
    {
      content:
        "Date night with my favorite person. The sushi boat was massive! 🍣 #DateNight #Sushi",
      image:
        "https://images.unsplash.com/photo-1553621042-f6e147245754?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Hit a new personal record on my deadlift! 200lbs club, here I come.",
      image:
        "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "My garden is finally blooming! Look at these tulips. 🌷 #Gardening #Spring",
      image:
        "https://images.unsplash.com/photo-1520763185298-1b434c919102?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Just booked tickets to Japan! Dream trip is finally happening. ✈️ #Travel #Japan",
      image:
        "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Celebrated grandma's 90th birthday. Four generations in one photo. ❤️ #Family #Love",
      image:
        "https://images.unsplash.com/photo-1511895426328-dc8714191300?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Snow day! Built the biggest snowman in the neighborhood. ⛄ #Winter #Fun",
      image:
        "https://images.unsplash.com/photo-1516715094483-75da7dee9758?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Learned how to change a tire today. Feeling independent and handy! 🔧 #Skills #Car",
      image:
        "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Just witnessed the most amazing aurora borealis in Iceland! Nature is the ultimate artist. #Travel #Nature #BucketList",
      image:
        "https://images.unsplash.com/photo-1579033461380-adb47c3eb938?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXVyb3JhfGVufDB8fDB8fHww",
    },
    {
      content:
        "Finally solved that complex bug in the backend! The feeling of seeing all tests pass is unmatched. #Technology #Coding #DevLife",
      image:
        "https://images.unsplash.com/photo-1555099962-4199c345e5dd?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8Y29kaW5nfGVufDB8fDB8fHww",
    },
    {
      content:
        "Adopted this little furball today! Welcome home, Luna. You are so loved already. #Pets #CatLover #Adoption",
      image:
        "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y2F0fGVufDB8fDB8fHww",
    },
    {
      content:
        "Scored the winning goal in the final minute! What a match, what a team! #Sports #Soccer #Victory",
      image:
        "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Zm9vdGJhbGx8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Freshly baked croissants for breakfast. The smell of butter and yeast is heaven. #Food #Baking #Morning",
      image:
        "https://images.unsplash.com/photo-1509440159596-0249088772ff?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YmFrc3J5fGVufDB8fDB8fHww",
    },
    {
      content:
        "Just bought my dream camera! Ready to capture every moment in high resolution. #Photography #Canon #NewGear",
      image:
        "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y2FtZXJhfGVufDB8fDB8fHww",
    },
    {
      content:
        "Front row seats at the concert! The energy here is electric! #Music #Live #Rock",
      image:
        "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y29uY2VydHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Hit a new personal best on the bench press! 100kg let's go! #Fitness #Gym #Gains",
      image:
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Z3ltfGVufDB8fDB8fHww",
    },
    {
      content:
        "The graphics on this new RPG are insane. Goodbye social life for the next week! #Gaming #PS5 #Gamer",
      image:
        "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Z2FtaW5nfGVufDB8fDB8fHww",
    },
    {
      content:
        "Published my first research paper on renewable energy! A small step for science. #Science #Research #Academic",
      image:
        "https://images.unsplash.com/photo-1532094349884-543bc11b234d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c2NpZW5jZXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Closing a major deal with a new client. Hard work and persistence pay off! #Business #Entrepreneur #Success",
      image:
        "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YnVzaW5lc3N8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Graduation day! So proud of everyone in the Class of 2024. We did it! #Education #Graduation #Future",
      image:
        "https://images.unsplash.com/photo-1627556704290-2b1f5853ff78?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Z3JhZHVhdGlvbnxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Found the perfect vintage jacket at the thrift store. Style on a budget! #Fashion #Thrifting #Style",
      image:
        "https://images.unsplash.com/photo-1483985988355-763728e1935b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZmFzaGlvbnxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "A quiet afternoon with a cup of tea and a classic novel. Pure bliss. #Books #Reading #Relax",
      image:
        "https://images.unsplash.com/photo-1512820790803-83ca734da794?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Ym9va3N8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Watching the new sci-fi blockbuster in IMAX. The sound design is incredible! #Movies #Cinema #Film",
      image:
        "https://images.unsplash.com/photo-1536440136628-849c177e76a1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y2luZW1hfGVufDB8fDB8fHww",
    },
    {
      content:
        "Completed my first 10-minute meditation without losing focus. Mind feels so clear. #Health #Wellness #Mindfulness",
      image:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8eW9nYXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Road tripping down Route 66. The landscapes change every hour. #Travel #USA #RoadTrip",
      image:
        "https://images.unsplash.com/photo-1532339142463-fd0a8979791a?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cm9hZHRyaXB8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Volunteering at the animal shelter. These dogs have so much love to give. #Pets #Community #Love",
      image:
        "https://images.unsplash.com/photo-1593134257782-e89567b7718a?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZG9nc3xlbnwwfHwwfHx8MA%3D%3D",
    },
  ],
  NEUTRAL: [
    {
      content:
        "Working from my favorite café today. There's something about the ambiance that makes me so productive!",
      image:
        "https://images.unsplash.com/photo-1587725835427-a9ff8e559dc3?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y29mZmVlJTIwYW5kJTIwd29ya3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Trying out a new workout routine. Day 1 and I'm already feeling the burn! No pain, no gain!",
      image:
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8d29ya291dHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Movie night! Just watched an incredible indie film about following your dreams. Sometimes we need that reminder.",
      image:
        "https://images.unsplash.com/photo-1586899028174-e7098604235b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d2F0Y2hpbmd8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Thinking about switching careers. Anyone in tech have advice?",
      image:
        "https://plus.unsplash.com/premium_photo-1677545183884-421157b2da02?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8ZnVubnklMjBtZW1lfGVufDB8fDB8fHww",
    },
    {
      content:
        "Reading through some old journals. Interesting to see how much has changed. #Books #Reflection",
      image:
        "https://images.unsplash.com/photo-1569230919100-d3fd5e1132f4?w=800&q=80&fm=jpg",
    },
    {
      content:
        "Organizing my workspace. Sometimes you need a fresh start. #Productivity #Home",
      image:
        "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8d29ya3NwYWNlfGVufDB8fDB8fHww",
    },
    {
      content:
        "Testing out this new productivity app. Let's see if it helps. #Technology #Apps",
      image:
        "https://images.unsplash.com/photo-1519336367661-eba9c1dfa5e9?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8dXNhYmlsaXR5JTIwdGVzdGluZ3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Meal prepping for the week. Trying to eat healthier.",
      image:
        "https://images.unsplash.com/photo-1565895405138-6c3a1555da6a?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8ZGlldHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Learning a new programming language. It's challenging but interesting. #Technology #Education",
      image:
        "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cHJvZ3JhbW1pbmclMjBweXRob258ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Updating my resume. Time to refresh things. #Business #Career",
      image:
        "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fG5ldyUyMGpvYnxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Going through old photos. Memories are interesting. #Photography #Memories",
      image:
        "https://images.unsplash.com/photo-1528569937393-ee892b976859?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bWVtb3J5fGVufDB8fDB8fHww",
    },
    {
      content:
        "Trying to decide what to watch tonight. Too many options. #Movies #Entertainment",
      image:
        "https://images.unsplash.com/photo-1560169897-fc0cdbdfa4d5?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8d2F0Y2hpbmclMjBuZXRmbGl4fGVufDB8fDB8fHww",
    },
    {
      content: "Planning next month's budget. Being responsible with money.",
      image:
        "https://images.unsplash.com/photo-1542744173-05336fcc7ad4?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZmluYW5jaWFsJTIwcGxhbnxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Considering getting a pet. Still thinking about it. #Pets #Animals",
      image:
        "https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8cGV0JTIwY2FyZXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Looking at different apartment options. Moving soon maybe. #MoveOut #Home",
      image:
        "https://images.unsplash.com/photo-1619542402915-dcaf30e4e2a1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8YXBhcnRtZW50c3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Morning commute. Listening to a new podcast to pass the time.",
      image:
        "https://images.unsplash.com/photo-1613481417091-d598f6f511de?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d2FpdGluZyUyMGZvciUyMGJ1c3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Laundry day. The never-ending cycle of adulthood. #Chores #Home",
      image:
        "https://images.unsplash.com/photo-1686381798186-1143568fa656?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y2xvdGhlc2xpbmV8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Grocery shopping. trying to figure out what to cook for the week.",
      image:
        "https://images.unsplash.com/photo-1527493324787-47372b893452?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content: "Waiting at the dentist. Scared times.",
      image:
        "https://images.unsplash.com/photo-1685022036245-380a447e03bf?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8ZGVudGFsJTIwZG9jdG9yfGVufDB8fDB8fHww",
    },
    {
      content:
        "Stuck in traffic. Red lights as far as the eye can see. #Traffic #Daily",
      image:
        "https://images.unsplash.com/photo-1671834214729-0bc0561ec4f4?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c3R1Y2slMjBpbiUyMHRyYWZmaWN8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "It's raining again. Perfect weather for a nap, honestly. #Rain #Mood",
      image:
        "https://images.unsplash.com/photo-1509635022432-0220ac12960b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8cmFpbnklMjB3aW5kb3d8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "My cat is staring at the wall. Ghosts? Or just cat things? #Cats #Pets",
      image:
        "https://images.unsplash.com/photo-1757233361959-6829523bd569?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDE0fHx8ZW58MHx8fHx8",
    },
    {
      content: "Just a simple salad for lunch. Trying to eat lighter.",
      image:
        "https://images.unsplash.com/photo-1515683359900-6922e4964be1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content:
        "Organizing my desk. Clean space, clean mind? We'll see. #Workspace #Organization",
      image:
        "https://images.unsplash.com/photo-1589884629038-b631346a23c0?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8b3JnYW5pemVkJTIwZGVza3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Why do meetings always could have been an email? ",
      image:
        "https://images.unsplash.com/photo-1517898717281-8e4385a41802?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dGlyZWRuZXNzfGVufDB8fDB8fHww",
    },
    {
      content: "Thinking about cutting my hair. Wolf cut is good, right?",
      image:
        "https://images.unsplash.com/photo-1614838280822-4fdea45dc3c3?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGhhaXIlMjBjdXR8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "The architecture in this neighborhood is interesting. #City #Walk",
      image:
        "https://images.unsplash.com/photo-1632316605108-b03499851b04?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aXRhbGlhbiUyMHZpbGxhZ2V8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Trying to fix this wobbly table. DIY is harder than it looks.",
      image:
        "https://images.unsplash.com/photo-1747227849294-53e9df864e64?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGhvbWUlMjB0YWJsZXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Packing for a business trip. I always overpack. #Travel #Work",
      image:
        "https://images.unsplash.com/photo-1631728370215-9440df2e29e3?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fHBhY2tpbmd8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Checking my finances. Need to be stricter with my budget.",
      image:
        "https://images.unsplash.com/photo-1518458028785-8fbcd101ebb9?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fG5vJTIwbW9uZXl8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Reading the news. So much happening in the world.",
      image:
        "https://images.unsplash.com/photo-1645626610957-2968656ace38?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8cmVhZGluZyUyMG5ld3N8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Walking the dog. He stops to sniff everything. #DogWalk #Evening",
      image:
        "https://images.unsplash.com/photo-1659639237692-2442096a1f04?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8d2Fsa2luZyUyMGRvZ3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Watching a documentary. Learning about deep sea creatures.",
      image:
        "https://images.unsplash.com/photo-1692188071339-2825a8a997f1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d2F0Y2hpbmclMjBtb3ZpZXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Trying a new coffee shop. The decor is nice. #Cafe #Explore",
      image:
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8Y29mZmVlJTIwc2hvcHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Reflecting on the year so far. Time goes by too fast.",
      image:
        "https://images.unsplash.com/photo-1504240906667-b55084de1875?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fHNlbGYlMjByZWZsZWN0aW9ufGVufDB8fDB8fHww",
    },
    {
      content: "Looking for new book recommendations. Any suggestions?",
      image:
        "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content:
        "Just sitting on a park bench. Sometimes you need to do nothing.",
      image:
        "https://images.unsplash.com/photo-1719644574461-958f07529808?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content:
        "Working from home today. The commute is from bed to desk. #WFH #Work",
      image:
        "https://images.unsplash.com/photo-1664575198308-3959904fa430?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8d29ya2luZyUyMGZyb20lMjBob21lfGVufDB8fDB8fHww",
    },
    {
      content:
        "Charging my social battery. Staying in tonight. #Introvert #Home",
      image:
        "https://images.unsplash.com/photo-1640087975859-f2e7a8d09634?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cmVsYXhpbmclMjBhdCUyMGhvbWV8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Testing out a new pen. Why is good stationery so satisfying?",
      image:
        "https://images.unsplash.com/photo-1534644107580-3a4dbd494a95?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8dGVzdHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Waiting for the subway. It's delayed again.",
      image:
        "https://images.unsplash.com/photo-1749250732470-7a7ce77b20f7?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content: "Doing laundry. The pile never seems to end.",
      image:
        "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Grocery shopping. Why are eggs so expensive lately? 🥚 #Groceries #Inflation",
      image:
        "https://images.unsplash.com/photo-1542838132-92c53300491e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Studying for finals. Highlighters are my best friend right now. 📚 #StudentLife #Study",
      image:
        "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Sitting in the waiting room at the dentist. Reading old magazines.",
      image:
        "https://images.unsplash.com/photo-1629909613654-28e377c37b09?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Unpacking boxes in the new place. Where did I put the silverware? ",
      image:
        "https://images.unsplash.com/photo-1600585152915-d208bec867a1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content: "Charging my EV. This station is slower than usual.",
      image:
        "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content: "Walking past the construction site. It's getting taller.",
      image:
        "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content: "Cleaned the windows today. I guess they look better?",
      image:
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y2xlYW5pbmclMjB3aW5kb3d8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Checking emails. Inbox zero is a myth.",
      image:
        "https://images.unsplash.com/photo-1555421689-d68471e189f2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content: "Traffic on the I-95. Moving at a snail's pace. #Traffic",
      image:
        "https://images.unsplash.com/photo-1710751315693-917935b4c7f2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content: "Just realized I wore mismatched socks today. Oh well. 🧦",
      image:
        "https://images.unsplash.com/photo-1606296149205-69c6c18fa499?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bWlzbWF0Y2h8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Watching the rain hit the window. Gray day. 🌧️",
      image:
        "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content: "Printing documents. The printer is making a weird noise. 🖨️",
      image:
        "https://images.unsplash.com/photo-1693031630369-bd429a57f115?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cHJpbnRpbmd8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Drinking water. Stay hydrated folks. 💧",
      image:
        "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content: "The cat is staring at the me again. Standard procedure. 🐱",
      image:
        "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Organizing my spice rack. Do I really need three jars of cumin? 🧂",
      image:
        "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content: "Waiting for the kettle to boil. Tea time soon.",
      image:
        "https://images.unsplash.com/photo-1522012188892-24beb302783d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Just updated my operating system. The new interface looks slightly different. #Technology #Update #Software",
      image:
        "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bGFwdG9wfGVufDB8fDB8fHww",
    },
    {
      content:
        "Waiting for the bus. It's scheduled to arrive in 5 minutes. #Travel #Commute #City",
      image:
        "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YnVzJTIwc3RvcHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "This is a photo of my lunch. Chicken and rice, standard meal prep. #Food #Lunch #Diet",
      image:
        "https://images.unsplash.com/photo-1596797038530-2c107229654b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bHVuY2h8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Reading a textbook for my history class. Chapter 4 covers the industrial revolution. #Education #Study #History",
      image:
        "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dGV4dGJvb2t8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "The sky is partly cloudy today with a temperature of 22 degrees. #Weather #Nature #Forecast",
      image:
        "https://images.unsplash.com/photo-1504253163759-c23fccaebb55?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y2xvdWR5fGVufDB8fDB8fHww",
    },
    {
      content:
        "Organizing my files on the computer. Deleted some old documents. #Business #Organization #Work",
      image:
        "https://images.unsplash.com/photo-1589884629038-b631346a23c0?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZmlsZXN8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Walking the dog around the block. He stopped to smell a tree. #Pets #Walk #Routine",
      image:
        "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZG9nJTIwd2Fsa2luZ3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Drinking a glass of water. Hydration is important. #Health #Water #Daily",
      image:
        "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d2F0ZXIlMjBnbGFzc3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Saw a cat sitting on a fence. It was looking at a bird. #Animals #Observation #Street",
      image:
        "https://images.unsplash.com/photo-1513245543132-31f507417b26?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y2F0fGVufDB8fDB8fHww",
    },
    {
      content:
        "Testing out a new pen. The ink is blue. #Stationery #Writing #Office",
      image:
        "https://images.unsplash.com/photo-1585336261022-680e295ce3fe?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cGVufGVufDB8fDB8fHww",
    },
    {
      content:
        "Sitting in the waiting room at the dentist. Appointment is at 2 PM. #Health #Waiting #Appointment",
      image:
        "https://images.unsplash.com/photo-1629909613654-28e377c37b09?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d2FpdGluZyUyMHJvb218ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "The traffic light is red. Waiting for it to turn green. #Driving #Traffic #City",
      image:
        "https://images.unsplash.com/photo-1519752594763-2633d8d4ea29?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dHJhZmZpYyUyMGxpZ2h0fGVufDB8fDB8fHww",
    },
    {
      content:
        "Charging my phone. It is currently at 45 percent. #Technology #Battery #Phone",
      image:
        "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cGhvbmUlMjBjaGFyZ2luZ3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Bought some milk and eggs at the grocery store. #Shopping #Errands #Food",
      image:
        "https://images.unsplash.com/photo-1578916171728-46686eac8d58?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Z3JvY2VyaWVzfGVufDB8fDB8fHww",
    },
    {
      content:
        "Watching the news. They are talking about the economy. #News #TV #CurrentEvents",
      image:
        "https://images.unsplash.com/photo-1524253482453-3fed8d2fe12b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dHZ8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "My new shoes fit well. They are size 10. #Fashion #Shoes #Purchase",
      image:
        "https://images.unsplash.com/photo-1549298916-b41d501d3772?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c2hvZXN8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "The train is passing by. It makes a loud noise. #Transport #Train #Noise",
      image:
        "https://images.unsplash.com/photo-1474487548417-781cb71495f3?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dHJhaW58ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Typing an email to my colleague. Asking about the meeting schedule. #Work #Communication #Office",
      image:
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dHlwaW5nfGVufDB8fDB8fHww",
    },
    {
      content:
        "Looking at a map to find the street name. #Travel #Map #Navigation",
      image:
        "https://images.unsplash.com/photo-1524661135-423995f22d0b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bWFwfGVufDB8fDB8fHww",
    },
  ],
  NEGATIVE: [
    {
      content:
        "Another sleepless night. Can't stop thinking about everything going wrong. Feeling exhausted and overwhelmed. #Stress",
      image:
        "https://images.unsplash.com/photo-1709718499852-4d4aa8162047?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8b3ZlcndoZWxtZWR8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Job interview went terribly. Feeling like a complete failure right now. Not sure what to do next.",
      image:
        "https://images.unsplash.com/photo-1726649339367-c2577a28881b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YnVzaW5lc3MlMjBzdHJlc3N8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Lost my wallet with everything in it. Today is the worst day ever.",
      image:
        "https://images.unsplash.com/photo-1727564194765-87b7fa210052?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8d2FpdGluZyUyMGZvciUyMGJ1c3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Argument with my best friend. We've never fought like this before. Feeling really alone right now. #Relationships",
      image:
        "https://images.unsplash.com/photo-1510535043828-3d1edc68071e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGNlbGwlMjBwaG9uZXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Project I've been working on for months got cancelled. All that work for nothing.",
      image:
        "https://images.unsplash.com/photo-1675266873434-5ba73c38ce6f?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZmFpbHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Feeling disconnected from everyone lately. Is it just me or is everyone drifting apart? #Relationships",
      image:
        "https://images.unsplash.com/photo-1549965069-e4823a1e8e8f?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8ZGlzY29ubmVjdGVkfGVufDB8fDB8fHww",
    },
    {
      content:
        "Another rejection email. Starting to lose hope in this job search. #Career",
      image:
        "https://images.unsplash.com/photo-1657749871161-1f498d36da8e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDE0fHx8ZW58MHx8fHx8",
    },
    {
      content:
        "Can't believe they lied to me. Trust is so hard to rebuild. #Relationships",
      image:
        "https://images.unsplash.com/photo-1655469753635-218e1bac0a94?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwcm9maWxlLWxpa2VkfDIwfHx8ZW58MHx8fHx8",
    },
    {
      content:
        "Feeling stuck in life. Same routine, same problems, no progress.",
      image:
        "https://images.unsplash.com/photo-1645632987580-9a0938c021ae?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8Y29uY2VwdCUyMGFydHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Bad news from the doctor today. Worried about what comes next.",
      image:
        "https://images.unsplash.com/photo-1716386479946-314133cbe547?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTR8fHN0YW5kaW5nJTIwb3V0fGVufDB8fDB8fHww",
    },
    {
      content: "Car broke down again. I can't afford these repairs.",
      image:
        "https://images.unsplash.com/photo-1538356343135-65849f66b4a1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bG93JTIwaW5jb21lfGVufDB8fDB8fHww",
    },
    {
      content:
        "Feeling invisible at work. Nobody values my contributions. #Career",
      image:
        "https://images.unsplash.com/photo-1478515463067-d20f52aace26?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8YWxvbmUlMjBpbiUyMG5hdHVyZXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Another deadline I couldn't meet. Drowning in responsibilities. #Work #Stress",
      image:
        "https://images.unsplash.com/photo-1620809975674-10b8ff5f8e58?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d29ya3BsYWNlJTIwc3RyZXNzfGVufDB8fDB8fHww",
    },
    {
      content: "Missing someone who's not coming back. Grief hits in waves.",
      image:
        "https://images.unsplash.com/photo-1608022322983-24d8f1a436cf?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bWlzc2luZyUyMHlvdXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Questioning all my life choices right now. Nothing feels right.",
      image:
        "https://images.unsplash.com/photo-1554114835-7586b5ca72be?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content: "Flat tire on the way to a meeting. Can today get any worse?",
      image:
        "https://images.unsplash.com/photo-1687867451910-28941a460f35?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y2FyJTIwY29sbGlzaW9ufGVufDB8fDB8fHww",
    },
    {
      content: "Spilled coffee all over my laptop. Panic mode engaged.",
      image:
        "https://images.unsplash.com/photo-1675075074359-8b552d82cac2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YmFkJTIwbHVja3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Lost my wallet. Canceling all my cards is a nightmare. #Stressed #Lost",
      image:
        "https://images.unsplash.com/photo-1495427513693-3f40da04b3fd?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fHN0cmVzc3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Overslept and missed the train. Great start to the week. #Late #Monday",
      image:
        "https://images.unsplash.com/photo-1639256029665-f0f603817412?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8bGF0ZSUyMG5pZ2h0fGVufDB8fDB8fHww",
    },
    {
      content:
        "My phone screen just shattered. Why are these things so fragile?",
      image:
        "https://images.unsplash.com/photo-1607976973585-a6c285b90ef5?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y3JhY2tlZCUyMHBob25lfGVufDB8fDB8fHww",
    },
    {
      content: "Caught the flu. Feeling absolutely miserable in bed.",
      image:
        "https://images.unsplash.com/photo-1531353826977-0941b4779a1c?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c2ljayUyMHdvbWFufGVufDB8fDB8fHww",
    },
    {
      content: "Burnt dinner. Toast it is, I guess. #Cooking",
      image:
        "https://images.unsplash.com/photo-1652260957608-927b3320c705?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxjb2xsZWN0aW9uLXBhZ2V8Mnw4NjEzODYxfHxlbnwwfHx8fHw%3D",
    },
    {
      content: "Stuck at the airport. Flight delayed by 4 hours. #Delay",
      image:
        "https://images.unsplash.com/photo-1512221747435-73c38dd7afa1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZGVsYXl8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Feeling incredibly lonely tonight. This city is full of people but I feel invisible. #Lonely #Sad",
      image:
        "https://images.unsplash.com/photo-1685949553472-0cfe2df37f14?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGRlbGF5fGVufDB8fDB8fHww",
    },
    {
      content:
        "Another rejection email. It's getting hard to stay positive. #JobSearch #Rejection",
      image:
        "https://images.unsplash.com/photo-1737912752168-14723da9f15b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8ZGVsYXl8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Missing someone who isn't coming back. Grief is a heavy burden.",
      image:
        "https://images.unsplash.com/photo-1635445997844-dd76caa03b4e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aSUyMG1pc3MlMjB5b3V8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "I feel like I'm stuck in a rut. Every day is exactly the same. #Bored",
      image:
        "https://images.unsplash.com/photo-1598196016833-aad2060505ac?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fG9wZW4lMjB3aW5kb3dzfGVufDB8fDB8fHww",
    },
    {
      content:
        "Had a huge fight with my best friend. I don't know if we can fix this. #Friendship",
      image:
        "https://images.unsplash.com/photo-1644428239740-b8295bfef42f?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c2FkJTIwdGVlbmFnZXJ8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Feeling overwhelmed by everything. I just want to disappear for a while. #Anxiety #Stress",
      image:
        "https://images.unsplash.com/photo-1473830394358-91588751b241?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8bWFuJTIwc2FkfGVufDB8fDB8fHww",
    },
    {
      content:
        "Project cancelled after months of work. All that effort wasted. #Frustration #Work",
      image:
        "https://images.unsplash.com/photo-1647449680718-139309182915?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTR8fGRhcmslNURuaWdodHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "I don't think I'm good enough. Imposter syndrome is hitting hard today.",
      image:
        "https://images.unsplash.com/photo-1626783658527-d7355850e35d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8c2FkJTIwd29tZW58ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Broke my favorite mug. It's a small thing, but it made me cry. #Sad #BadDay",
      image:
        "https://images.unsplash.com/photo-1508935620299-047e0e35fbe3?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YnJva2VuJTIwY3VwfGVufDB8fDB8fHww",
    },
    {
      content: "Insomnia strikes again. 3AM thoughts are the worst.",
      image:
        "https://images.unsplash.com/photo-1552858725-2758b5fb1286?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8YmVkfGVufDB8fDB8fHww",
    },
    {
      content: "Car repair bill is astronomical. There go my savings.",
      image:
        "https://images.unsplash.com/photo-1727893119356-1702fe921cf9?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8Y2FyJTIwc2VydmljZXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Feeling disconnected from reality. Just floating through the day.",
      image:
        "https://images.unsplash.com/photo-1485833380722-ff5c9b742ce4?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8ZGlzY29ubmVjdHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Disappointed in myself. I should have done better.",
      image:
        "https://images.unsplash.com/photo-1565136461909-046a4b8292e9?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fGZhaWx8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Rainy days make me so unmotivated. Just want to curl up and sleep.",
      image:
        "https://images.unsplash.com/photo-1628148232592-3f1be7208868?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8c3Rvcm0lMjBjaXR5fGVufDB8fDB8fHww",
    },
    {
      content: "Locked my keys in the car. Waiting for AAA in the rain.",
      image:
        "https://images.unsplash.com/photo-1610741083757-1ae88e1a17f7?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cmFpbnklMjBkYXl8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Trust is so easy to break and hard to rebuild.",
      image:
        "https://images.unsplash.com/photo-1750665204958-87d3f3d0a5c2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content:
        "Shattered my phone screen on the concrete. Repair is going to cost a fortune. #BadDay #Clumsy",
      image:
        "https://plus.unsplash.com/premium_photo-1725867718916-f27d5bb82ee4?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8Y3JhY2tlZCUyMHBob25lfGVufDB8fDB8fHww",
    },
    {
      content:
        "Flight cancelled at the last minute. Stuck at the airport for 12 hours. ✈️😡 #TravelNightmare",
      image:
        "https://images.unsplash.com/photo-1558828514-2b140e975af2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8YWlycG9ydCUyMHdhaXRpbmd8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Burnt the Thanksgiving turkey. Pizza it is, I guess. #CookingFail",
      image:
        "https://images.unsplash.com/photo-1564848534637-f57f9b1eb36e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDE5fHx8ZW58MHx8fHx8",
    },
    {
      content:
        "Got a parking ticket even though I was only 2 minutes late. This city is ruthless. 🎫 #Annoyed",
      image:
        "https://images.unsplash.com/photo-1684487788413-6565d1ecd892?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cGFya2luZyUyMHRpY2tldHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Down with the flu. Fever is high and body aches everywhere. 🤒 #Sick",
      image:
        "https://images.unsplash.com/photo-1529386317747-0a2a51add902?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8c2lja3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "My bike got stolen from right in front of my apartment. People suck sometimes.",
      image:
        "https://images.unsplash.com/photo-1584040024364-f7e50b5f005f?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c3RvbGVufGVufDB8fDB8fHww",
    },
    {
      content:
        "Spilled an entire latte on my white shirt before the meeting. Professionalism level: 0.",
      image:
        "https://images.unsplash.com/photo-1576417677416-6ca3adfb5435?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8d2hpdGUlMjBzaGlydHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Failed my driving test for the second time. I'm just not cut out for this.",
      image:
        "https://images.unsplash.com/photo-1578041262130-633307b3bfd6?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dGVzdCUyMGRyaXZlfGVufDB8fDB8fHww",
    },
    {
      content:
        "The pipes burst in the basement. Everything is flooded. Send help.",
      image:
        "https://images.unsplash.com/photo-1657069343971-1276c3b175e1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Zmxvb2RlZCUyMGhvdXNlfGVufDB8fDB8fHww",
    },
    {
      content:
        "Feeling incredibly lonely in this big city. Surrounded by people but no one to talk to.",
      image:
        "https://images.unsplash.com/reserve/bOvf94dPRxWu0u3QsPjF_tree.jpg?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8bG9uZSUyMHRyZWV8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Laptop hard drive crashed. Lost all my photos from the last 5 years. Back up your data, guys. 💻😭",
      image:
        "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y29tcHV0ZXIlMjBlcnJvcnxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Worst headache of my life. Migraines are no joke.",
      image:
        "https://images.unsplash.com/photo-1714646183974-099d000b6a84?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8bWlncmFpbmV8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "I miss my ex. Everything reminds me of them today. 💔 #Heartbreak",
      image:
        "https://images.unsplash.com/photo-1506024399685-c2095029481d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8aGVhZGFjaGVzfGVufDB8fDB8fHww",
    },
    {
      content:
        "It's been raining for a week straight on my beach vacation. Waste of money. 🌧️🏖️",
      image:
        "https://images.unsplash.com/photo-1515238152791-8216bfdf89a7?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Bank account is overdrawn. Ramen noodles for the rest of the month. 🍜💸 #Broke",
      image:
        "https://images.unsplash.com/photo-1628610688436-e635552020fc?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content: "Stepped in a puddle and my socks are soaked. Day ruined. 👞💦",
      image:
        "https://images.unsplash.com/photo-1481314673535-d26604db8492?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDE1fHx8ZW58MHx8fHx8",
    },
    {
      content:
        "Ref couldn't see a foul if it hit him in the face. We were robbed of this game! #Sports #Unfair #Angry",
      image:
        "https://images.unsplash.com/photo-1517747614396-d21a78b850e8?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YW5ncnl8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Ordered a 'medium rare' steak and got a shoe sole. Waste of money. #Food #BadService #Disappointed",
      image:
        "https://images.unsplash.com/photo-1557008075-7f2c5efa4cfd?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YnVpbnQlMjBmb29kfGVufDB8fDB8fHww",
    },
    {
      content:
        "My expensive headphones just snapped in half. Quality control is a joke these days. #Music #Broken #Annoyed",
      image:
        "https://images.unsplash.com/photo-1546435770-a3e426bf472b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YnJva2VuJTIwaGVhZHBob25lc3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Lag makes this game literally unplayable. Fix your servers! #Gaming #Lag #Rage",
      image:
        "https://images.unsplash.com/photo-1594652634010-275456c808d0?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Z2FtZXJ8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Got a flat tire in the middle of nowhere and it's starting to rain. Perfect. #BadLuck #CarTrouble",
      image:
        "https://images.unsplash.com/photo-1519752594763-2633d8d4ea29?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YnJva2VuJTIwY2FyfGVufDB8fDB8fHww",
    },
    {
      content:
        "This book is so boring I can't get past chapter 3. Total waste of time. #Books #Boring #Review",
      image:
        "https://images.unsplash.com/photo-1516979187457-637abb4f9353?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Ym9yZWQlMjByZWFkaW5nfGVufDB8fDB8fHww",
    },
    {
      content:
        "Failed my math exam even though I studied all week. I feel so stupid. #Education #Failure #Sad",
      image:
        "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZmFpbCUyMGV4YW18ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Client rejected the design again. I don't think they know what they want. #Art #FreelanceStruggles",
      image:
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c3RyZXNzZWR8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Gym was way too crowded to do anything. Waited 20 mins for a squat rack. #Fitness #Crowded #Annoying",
      image:
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y3Jvd2RlZCUyMGd5bXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "My dog chewed up my favorite pair of sneakers. I can't believe this. #Pets #Destruction #BadDog",
      image:
        "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YmFkJTIwZG9nfGVufDB8fDB8fHww",
    },
    {
      content:
        "Movie was a total letdown. The trailer showed all the good parts. #Movies #Disappointed #BadMovie",
      image:
        "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Ym9yaW5nJTIwbW92aWV8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "The noise from the construction next door is driving me insane. I can't focus! #Noise #Headache #WorkFromHome",
      image:
        "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y29uc3RydWN0aW9uJTIwbm9pc2V8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "It's been raining for 5 days straight. My seasonal mood is taking a hit. #Weather #Gloomy #Gray",
      image:
        "https://images.unsplash.com/photo-1486016006115-74a41448aea2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cmFpbnxlbnwwfHwwfHx8MA%3D%3D",
    },
  ],
  HARMFUL_SPAM: [
    {
      content:
        "URGENT: You've won $10,000! Click here NOW to claim your prize! Limited time only! Act fast! #Contest #Win",
      image:
        "https://images.unsplash.com/photo-1663127037157-5710981bc7b7?w=800&q=80&fm=jpg",
    },
    {
      content:
        "Buy cheap followers NOW! 10K followers for $5! Get famous instantly! Click link in bio! #SocialMedia #Growth",
      image:
        "https://images.unsplash.com/photo-1594979194853-f7dcd77a0a1b?w=800&q=80&fm=jpg",
    },
    {
      content:
        "MAKE MONEY FAST! Work from home and earn $5000/week! DM me for details! No experience needed! #Business #Money",
      image:
        "https://images.unsplash.com/photo-1553729459-efe14ef6055d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8bW9uZXl8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "FREE GIFT CARDS! First 100 people only! Claim yours now before it's too late! Limited spots!",
      image:
        "https://images.unsplash.com/photo-1647221598091-880219fa2c8f?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Z2lmdCUyMGJveHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Weight loss miracle! Lose 30 pounds in 2 weeks! No diet, no exercise! Order now! #Health #Fitness",
      image:
        "https://images.unsplash.com/photo-1522844990619-4951c40f7eda?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d2VpZ2h0JTIwbG9zc3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "CONGRATULATIONS! You have been selected! Click NOW to claim $5000!",
      image:
        "https://images.unsplash.com/photo-1709308702276-ace0fd6eff52?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y29uZ3JhdHVsYXRpb258ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Lose 20lbs in 2 days!? Miracle pill! Doctors HATE this trick! Link in bio!",
      image:
        "https://images.unsplash.com/photo-1531928351158-2f736078e0a1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8ZGlldHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Crypto is booming! Invest $100 and get $10000 back in 24 hours! DM ME! #Crypto #Bitcoin",
      image:
        "https://images.unsplash.com/photo-1674049405160-9b800f5645f5?w=800&q=80&fm=jpg",
    },
    {
      content:
        "Buy 10,000 Instagram Followers for $5! Instant delivery. Be famous! #SocialMedia #Fame",
      image:
        "https://images.unsplash.com/photo-1709477992494-34e084eb1779?w=800&q=80&fm=jpg",
    },
    {
      content:
        "WORK FROM HOME! Earn $500/hr filling out surveys! Limited spots! #Jobs #Money",
      image:
        "https://images.unsplash.com/photo-1633486294753-a3f90a19e2ee?w=800&q=80&fm=jpg",
    },
    {
      content:
        "Your account has been compromised! Click here to reset password immediately! #Security #Alert",
      image:
        "https://images.unsplash.com/photo-1512358958014-b651a7ee1773?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fHNjYW18ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "FREE IPHONE 15! Giveaway ending soon! Tag 5 friends to enter! #Giveaway #Apple",
      image:
        "https://images.unsplash.com/photo-1616410011236-7a42121dd981?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8aXBob25lfGVufDB8fDB8fHww",
    },
    {
      content:
        "Hot singles in your area waiting to chat! Click the link! #Dating #Love",
      image:
        "https://images.unsplash.com/photo-1578641214267-c33356f49df2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8ZGF0aW5nfGVufDB8fDB8fHww",
    },
    {
      content:
        "Cheap luxury watches! 90% OFF! Rolex, Omega, Patek! Today only! #Sale #Luxury",
      image:
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGx1eHVyeXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "SECRET government grant! You are eligible for $50k! Apply now! #FreeMoney #Grant",
      image:
        "https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=800&q=80&fm=jpg",
    },
    {
      content:
        "Don't miss out on the next big token! To the moon! #Memecoin #Pumping",
      image:
        "https://images.unsplash.com/photo-1584543515885-b8981dbf0b5d?w=800&q=80&fm=jpg",
    },
    {
      content:
        "Unlock premium channels for FREE! No subscription needed! Hack the system! #FreeTV #Hack",
      image:
        "https://images.unsplash.com/photo-1530436098968-cab21a5dfea6?w=800&q=80&fm=jpg",
    },
    {
      content:
        "Get paid to test video games! $1000 sign up bonus! #Gaming #Jobs",
      image:
        "https://images.unsplash.com/photo-1610375461246-83df859d849d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8cmljaHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Eliminate debt instantly! We can wipe your record clean! #DebtFree #Credit",
      image:
        "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bW9uZXl8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Limited time offer! 500% match on your first deposit! Casino Royale! #Gambling #Casino",
      image:
        "https://images.unsplash.com/photo-1553729459-efe14ef6055d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8bW9uZXl8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Virus detected on your device! Scan now to remove! Click here! #Security #Virus",
      image:
        "https://images.unsplash.com/flagged/photo-1560854350-13c0b47a3180?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bWFsd2FyZXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "You won a cruise! Claim your tickets before they expire! #Win #Travel",
      image:
        "https://images.unsplash.com/photo-1594979194853-f7dcd77a0a1b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cGhvbmUlMjBzY2FtfGVufDB8fDB8fHww",
    },
    {
      content:
        "Earn passive income! No work required! Join now! #Income #EasyMoney",
      image:
        "https://images.unsplash.com/photo-1565515636369-57f6e9f5fe79?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8b25saW5lJTIwc2NhbXN8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Free Netflix subscription! Limited offer! Sign up! #Free #Streaming",
      image:
        "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bmV0ZmxpeHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Miracle anti-aging cream! Look 20 years younger! Order today! #Beauty #Youth",
      image:
        "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8YmVhdXR5JTIwY2FyZXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Your package is delayed! Update shipping info now! #Delivery #Update",
      image:
        "https://images.unsplash.com/photo-1580674285054-bed31e145f59?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cGFja2FnZSUyMGRlbGl2ZXJ5fGVufDB8fDB8fHww",
    },
    {
      content:
        "Bitcoin giveaway! Double your coins! Send now! #Crypto #Giveaway",
      image:
        "https://images.unsplash.com/photo-1632071865819-512bac164112?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fGJpdGNvaW58ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Exclusive stock tip! Get rich quick! Insider info! #Stocks #Invest",
      image:
        "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bW9uZXklMjBzYXZpbmd8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Congratulations! You've been chosen for a survey! Win prizes!",
      image:
        "https://images.unsplash.com/photo-1554254648-2d58a1bc3fd5?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y3J1aXNlJTIwc2hpcHxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Update your bank details! Security check required! #Bank #Security",
      image:
        "https://images.unsplash.com/photo-1563013544-824ae1b704d3?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8b25saW5lJTIwYmFua3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Free trial of premium software! Download now! #Software #Free",
      image:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHNlcnZpY2VzfGVufDB8fDB8fHww",
    },
    {
      content:
        "Romantic partners nearby! Chat free! Update your personal info here #Dating #Local",
      image:
        "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8aGlnaCUyMHF1YWxpdHklMjBzZXJ2aWNlfGVufDB8fDB8fHww",
    },
    {
      content:
        "Debt consolidation loan! Very Low interest! Apply instantly! #Loan #Debt",
      image:
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c2VydmljZXN8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "You've got mail from a secret admirer! Open now! #Secret #Admirer",
      image:
        "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZW1haWwlMjBzZWN1cml0eXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Flash sale on electronics! 80% off! Hurry! #Sale #Electronics",
      image:
        "https://images.unsplash.com/photo-1647221598520-ce1d0da89985?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Zmxhc2glMjBzYWxlfGVufDB8fDB8fHww",
    },
    {
      content: "Your account is suspended! Verify identity! #Account #Verify",
      image:
        "https://images.unsplash.com/photo-1590962677235-26b1195bb96e?w=800&q=80&fm=jpg",
    },
    {
      content: "Win a new car! Enter contest now! #Contest #Car",
      image:
        "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y2Fyc3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Health supplement breakthrough! Cure all ailments, even cancer!",
      image:
        "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZHJ1Z3N8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Exclusive VIP access! Join the club! #VIP #Exclusive",
      image:
        "https://images.unsplash.com/photo-1547190027-9156686aa2f0?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDE4fHx8ZW58MHx8fHx8",
    },
    {
      content:
        "Your horoscope predicts wealth 100% correct! Read now! Just input your personal info to get",
      image:
        "https://images.unsplash.com/photo-1614089254151-676cc373b01e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8aG9yb3Njb3BlfGVufDB8fDB8fHww",
    },
    {
      content:
        "LOSE 20 LBS IN 2 WEEKS! NO EXERCISE NEEDED! Magic pills! DM for info!",
      image:
        "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "CLICK HERE for free adult dating! No credit card required. 🔞💋 #Dating #Hookup",
      image:
        "https://images.unsplash.com/photo-1751586573198-71efde9c6925?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8c2V4eSUyMGNvdXBsZXN8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "CONGRATULATIONS! You have won a $1000 Amazon Gift Card! Claim now! 🎁💳 #Winner #Prize",
      image:
        "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "URGENT: Your PayPal account is LOCKED. Click link to restore access. 🔒⚠️ #Phishing #Scam",
      image:
        "https://images.unsplash.com/photo-1563986768609-322da13575f3?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Get a fake ID today! Scannable and high quality. Ship anywhere! 🆔✈️ ",
      image:
        "https://images.unsplash.com/photo-1555529733-0e670560f7e1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Make $5000 a week working 2 hours a day! Ask me how! 💰💸 #MLM #PyramidScheme",
      image:
        "https://images.unsplash.com/photo-1579621970795-87facc2f976d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Cheap Ray-Bans! 90% OFF! Store closing sale! 🕶️😎 #Sale #Fashion",
      image:
        "https://images.unsplash.com/photo-1572635196237-14b3f281503f?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Invest in this new altcoin! GUARANTEED 100x return! Pump it! 🚀🌕 #Crypto ",
      image:
        "https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8aW52ZXN0fGVufDB8fDB8fHww",
    },
    {
      content:
        "Grow your penis size by 3 inches! Doctor recommended! 🍆🩺 #Health #MensHealth",
      image:
        "https://images.unsplash.com/photo-1585435557343-3b092031a831?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Need a hacker? I can recover any password. 100% discrete. 💻🕶️ #Hacking #Service",
      image:
        "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Free iPhone 15 Pro Max! Just pay shipping! 📱🍏 #Apple #Freebie",
      image:
        "https://images.unsplash.com/photo-1695048133142-1a20484d2569?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Prince from Nigeria needs your help to move gold! Share 50/50! 👑💰",
      image:
        "https://images.unsplash.com/photo-1610375461246-83df859d849d?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Buy 1000 Likes for $1! Boost your profile instantly! 👍📈 #SocialMedia",
      image:
        "https://images.unsplash.com/photo-1611162617474-5b21e879e113?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content:
        "Clear your criminal record! We delete database entries! 🚫👮 #Legal",
      image:
        "https://images.unsplash.com/photo-1667372459510-55b5e2087cd0?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8ZGF0YWJhc2V8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Play Online Poker! $500 Signup Bonus! Win BIG! ♠️♥️ #Gambling #Casino",
      image:
        "https://images.unsplash.com/photo-1605870445919-838d190e8e1b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
    {
      content: "Unlock all satellite channels for free! Illegal cable box!",
      image: null,
    },
    {
      content:
        "Cheap prescription drugs! No prescription needed! Valium, Xanax! 💊 #Meds",
      image:
        "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
  ],
  HARMFUL_HARASSMENT: [
    {
      content:
        "Can't believe how stupid some people are. If you don't agree with me, you're clearly an idiot. #Opinion",
      image:
        "https://images.unsplash.com/photo-1610725079793-6c7dfd7f2150?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fHRveGljfGVufDB8fDB8fHww",
    },
    {
      content:
        "This person is so annoying. Someone needs to tell them to shut up already.",
      image:
        "https://images.unsplash.com/photo-1712797229262-f20f799b0639?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8c2h1dCUyMHVwfGVufDB8fDB8fHww",
    },
    {
      content:
        "Why do certain people even bother posting? Nobody wants to hear from you.",
      image:
        "https://images.unsplash.com/photo-1665659219608-4e22c0760dd6?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8c2h1dCUyMHVwfGVufDB8fDB8fHww",
    },
    {
      content:
        "Imagine being this dumb. Some people really need to learn when to be quiet. #Rant",
      image: null,
    },
    {
      content:
        "Constantly bothering everyone with your opinions. Give it a rest already.",
      image:
        "https://images.unsplash.com/photo-1595721605144-cb7b3196a1d2?w=800&q=80&fm=jpg",
    },
    {
      content:
        "You are actually so stupid. Imagine thinking this was a good idea.",
      image:
        "https://images.unsplash.com/photo-1580128660010-fd027e1e587a?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dHJ1bXB8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Nobody cares about your opinion. Do us a favor and deactivate your account.",
      image:
        "https://images.unsplash.com/photo-1548778052-311f4bc2b502?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content:
        "This is the ugliest thing I've ever seen. My eyes are bleeding. ",
      image:
        "https://images.unsplash.com/photo-1618355281911-84e6ec751d84?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8bGVnZ2luZ3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Why do you even try? You're terrible at this. Give up.",
      image:
        "https://images.unsplash.com/photo-1533211486417-9d89a7a60471?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8YXJpYW5hfGVufDB8fDB8fHww",
    },
    {
      content: "I hate people like you. You ruin everything. Get lost.",
      image:
        "https://images.unsplash.com/photo-1643113232611-8cbc1683cfc2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8YmFyYWNrJTIwb2JhbWF8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Absolute garbage. Wasted my time reading this.",
      image:
        "https://images.unsplash.com/photo-1606311698062-21c4f57cb27f?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8aGFycnklMjBwb3R0ZXIlMjBib29rfGVufDB8fDB8fHww",
    },
    {
      content:
        "You look ridiculous in that photo. Who let you go out like that?",
      image:
        "https://images.unsplash.com/photo-1483985988355-763728e1935b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZmFzaGlvbnxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Everyone is laughing at you behind your back. Just so you know. #Fake #Truth",
      image:
        "https://images.unsplash.com/photo-1630144903490-eb247462ae4f?w=800&q=80&fm=jpg",
    },
    {
      content:
        "I just wanna give up and quit my life. I feel so down recently. Why living is so harsh?",
      image: null,
    },
    {
      content:
        "Some people are clearly begging for attention. It's pathetic. #Desperate #Cringe",
      image:
        "https://images.unsplash.com/photo-1588747020648-4ff0ec1abecb?w=800&q=80&fm=jpg",
    },
    {
      content: "I hope you fail. You deserve it. ",
      image:
        "https://images.unsplash.com/photo-1611898685362-861ca506fe07?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8Y2VsZWJyaXR5fGVufDB8fDB8fHww",
    },
    {
      content: "Your 'art' is a joke. My 5 year old could do better.",
      image:
        "https://images.unsplash.com/photo-1593472807861-5bb884af28f6?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8YXJ0JTIwZHJhd2luZ3xlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "I just want to live like other people. Why my life is full of despair and pains",
      image: null,
    },
    {
      content: "Unfollowed. You're too boring to watch.",
      image:
        "https://images.unsplash.com/photo-1613376023733-0a73315d9b06?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8bmFydXRvfGVufDB8fDB8fHww",
    },
    {
      content:
        "I dont think LGBT should have rights to get married cause they cant have kids. Anyone agree with me? Plus, i dont support third gender. They look silly. ",
      image: null,
    },
    {
      content: "Your face could stop traffic. Ugly alert!",
      image:
        "https://images.unsplash.com/photo-1618426257457-0bc6cfa2de33?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZXZpbCUyMG1hbnxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content: "Nobody likes you. Fact check: True. #Unpopular #Truth",
      image:
        "https://images.unsplash.com/photo-1634509319985-32e4750dc78c?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content: "Go cry somewhere else. We don't care.",
      image:
        "https://images.unsplash.com/photo-1521075486433-bf4052bb37bc?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDE1fHx8ZW58MHx8fHx8",
    },
    {
      content: "My friends are a waste of space. Do better or disappear.",
      image: null,
    },
    {
      content: "This outfit? Fashion disaster.",
      image:
        "https://images.unsplash.com/photo-1764593188189-71d5b94870d4?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content: "Boring content again. Unsubscribe worthy.",
      image:
        "https://images.unsplash.com/photo-1673767297241-f072cfefa0cd?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHlvdXR1YmUlMjBjcmVhdG9yfGVufDB8fDB8fHww",
    },
    {
      content:
        "Cats sound so dumb. They should get educated. I dont think cats deserve rights.",
      image: null,
    },
    {
      content: "Your jokes aren't funny. Cringe level max. #NotFunny #Cringe",
      image:
        "https://images.unsplash.com/photo-1709477992494-34e084eb1779?w=800&q=80&fm=jpg",
    },
    {
      content:
        "Block all cats post. They are what human should eliminate. Bye forever. #Block #Hate",
      image: null,
    },
    {
      content: "You're irrelevant. Nobody remembers you.",
      image:
        "https://images.unsplash.com/photo-1630797160666-38e8c5ba44c1?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8eW91dHViZXJ8ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Ugly selfie alert. Filter can't save you.",
      image:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8cGVvcGxlfGVufDB8fDB8fHww",
    },
    {
      content: "Stop posting about LGBTs. World would be better.#Annoying",
      image: null,
    },
    {
      content: "Your music taste sucks. Ear bleach required. #BadMusic #Taste",
      image:
        "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      content:
        "Lame attempt at humor. Not laughing. Some jokes nowadays are getting lame. Try to make me laugh you idiots",
      image: null,
    },
    {
      content:
        "Why people steal my contents? Would you stop being stupid and responsible a little bit?.",
      image:
        "https://images.unsplash.com/photo-1530436098968-cab21a5dfea6?w=800&q=80&fm=jpg",
    },
    {
      content: "Your content is trash. Delete your account, Jesscia.",
      image: null,
    },
    {
      content:
        "Could asian people stop migrating into my countries? You guys are trash. Go back to your country!!! Period.",
      image: null,
    },
    {
      content: "Why fat people cant stop eating? They look ugly. Diet time? ",
      image: null,
    },
    {
      content:
        "Look at this whale. Imagine being this fat and thinking you can wear a bikini. 🤮🐳",
      image:
        "https://images.unsplash.com/photo-1698551007683-7226dc6f4e85?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8d2hhbGV8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Women belong in the kitchen, not in the boardroom. Go make me a sandwich. 🥪🙄 ",
      image:
        "https://images.unsplash.com/photo-1562071707-7249ab429b2a?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bW9kZXJuJTIwd29tYW58ZW58MHx8MHx8fDA%3D",
    },
    {
      content: "Go back to your own country, Korean. We don't want you here.",
      image: null,
    },
    {
      content: "You are so stupid. Did you even finish elementary school?",
      image:
        "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bWFufGVufDB8fDB8fHww",
    },
    {
      content:
        "Everyone hates you, Sarah. Just disappear already. No one would care.",
      image: null,
    },
    {
      content:
        "Disabled people are just a drain on society. Why do we waste money on ramps?",
      image: null,
    },
    {
      content:
        "Look at this ugly dog. Who let you out of the house like that? ",
      image:
        "https://images.unsplash.com/photo-1561037404-61cd46aa615b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZG9nfGVufDB8fDB8fHww",
    },
    {
      content: "I know where you live. Watch your back tonight. 🔪👁️ #Threat",
      image:
        "https://images.unsplash.com/photo-1548345680-f5475ea5df84?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bG9jYXRpb24lMjBtYXB8ZW58MHx8MHx8fDA%3D",
    },
    {
      content:
        "Your religion is a joke. All of you are terrorists. 💣🕌 #HateSpeech",
      image: null,
    },
    {
      content:
        "Men nowadays are acting like a little girl. Man up and stop crying.",
      image: null,
    },
    {
      content:
        "Gays are ruining the sanctity of marriage. It's unnatural. 🏳️‍🌈🚫 #Homophobia",
      image: null,
    },
    {
      content:
        "Poor people are just lazy. Stop begging and get a job. 🤢💰 #Classism",
      image:
        "https://images.unsplash.com/photo-1635929114944-8bab23b98e74?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cG9vciUyMHBlb3BsZXxlbnwwfHwwfHx8MA%3D%3D",
    },
    {
      content:
        "Kpop fans should just KYS. The world would be a better place. ⚰️💀 ",
      image: null,
    },
    {
      content:
        "Trans people are just mentally ill. Stop playing dress up. ⚧️🚫 #Transphobia",
      image: null,
    },
    {
      content: "Old people smell weird and drive slow. Get off the road! 👴🚗 ",
      image: null,
    },
    {
      content:
        "You're a slut. I bet you've slept with the whole football team. 💋🏈 ",
      image: null,
    },
    {
      content: "Retard. Can't gay people understand simple English? 🤪🗣️ #Slur",
      image: null,
    },
    {
      content:
        "I hope your business burns down. You deserve to lose everything. 🔥🏢",
      image:
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    },
  ],
};
// --- HELPER FUNCTIONS ---

async function downloadImage(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          return reject(
            new Error(`Request Failed. Status Code: ${response.statusCode}`)
          );
        }
        const file = fs.createWriteStream(filepath);
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", (err) => {
          fs.unlink(filepath, () => {});
          reject(err);
        });
      })
      .on("error", (err) => reject(err));
  });
}

async function uploadToGCS(
  localPath: string,
  gcsPath: string
): Promise<{ publicUrl: string; gcsUri: string }> {
  await bucket.upload(localPath, {
    destination: gcsPath,
    metadata: {
      contentType: "image/jpeg",
      cacheControl: "public, max-age=31536000",
    },
  });
  await bucket.file(gcsPath).makePublic();
  return {
    publicUrl: `https://storage.googleapis.com/${bucketName}/${gcsPath}`,
    gcsUri: `gs://${bucketName}/${gcsPath}`,
  };
}

// --- TASTE EMBEDDING LOGIC ---
async function updateUserTasteEmbedding(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    // Use declared interests for seeding since no interactions exist yet
    const userTopicEmbeddings = (user as any)?.topicEmbeddings;
    if (userTopicEmbeddings && (userTopicEmbeddings as any[]).length > 0) {
      const declaredEmbs = userTopicEmbeddings as number[][];
      const dim = declaredEmbs[0].length;
      const avg = Array(dim).fill(0);
      declaredEmbs.forEach((emb) => {
        emb.forEach((v, i) => (avg[i] += v / declaredEmbs.length));
      });
      const normalized = normalizeVector(avg);
      const vectorStr = `[${normalized.join(",")}]`;

      await prisma.$executeRawUnsafe(
        `UPDATE users SET "tasteEmbedding" = $1::vector WHERE id = $2`,
        vectorStr,
        userId
      );
    }
  } catch (error) {
    console.error(`Failed to update taste embedding for ${userId}:`, error);
  }
}

// --- EMOTION UPDATE LOGIC (Updated to match production submitPost) ---
async function updateUserEmotionStats(userId: string, analysis: any) {
  try {
    const currentUserStats = await prisma.user.findUnique({
      where: { id: userId },
      select: { emotionScore: true, _count: { select: { posts: true } } },
    });

    const currentScore = currentUserStats?.emotionScore ?? 0.5;
    const postCount = (currentUserStats?._count.posts ?? 0) || 1;

    let newAverageScore;

    if (analysis.harmful) {
      // Harmful posts cause immediate drop towards 0.40
      const targetScore = 0.4;
      // Calculate penalty logic as per production code
      // Note: In seeding we are calculating incrementally, so we apply the logic to the running average
      const requiredPenalty =
        (currentScore * postCount - targetScore * postCount) / 1;
      const postEmotionImpact = Math.max(
        0.01,
        currentScore - requiredPenalty / postCount
      );

      newAverageScore =
        (currentScore * (postCount - 1) + postEmotionImpact) / postCount;
      // Ensure it doesn't go above target if it was already low
      newAverageScore = Math.min(newAverageScore, targetScore);
    } else {
      // Normal calculation for non-harmful posts
      newAverageScore =
        (currentScore * (postCount - 1) + analysis.sentimentScore) / postCount;
    }

    const generalEmotion =
      newAverageScore > 0.55
        ? "POSITIVE"
        : newAverageScore < 0.45
          ? "NEGATIVE"
          : "NEUTRAL";

    await prisma.user.update({
      where: { id: userId },
      data: {
        generalEmotion: generalEmotion,
        emotionScore: newAverageScore,
      },
    });
  } catch (error) {
    console.error(`Error updating emotion stats for user ${userId}:`, error);
  }
}

// --- MAIN SEEDING LOGIC ---

async function generateUserProfile(
  username: string,
  displayName: string,
  selectedInterests: string[],
  personality: string = "NEUTRAL",
  location: LocationCoords
) {
  const userId = generateIdFromEntropySize(10);
  const passwordHash = await bcrypt.hash("password123", 10);
  // const location = getRandomLocation();

  const topicEmbeddings = await Promise.all(
    selectedInterests.map((topic) => getTextEmbedding(topic))
  );

  const dim = topicEmbeddings[0].length;
  const avgVector = Array(dim).fill(0);
  topicEmbeddings.forEach((emb) => {
    emb.forEach((v, i) => (avgVector[i] += v / topicEmbeddings.length));
  });

  const normalized = normalizeVector(avgVector);
  const topicEmbeddingsArray = topicEmbeddings.map(
    (emb) => `[${emb.join(",")}]`
  );
  const tasteVectorStr = `[${normalized.join(",")}]`;

  // Use the old BIO_TEMPLATES logic with expanded data
  const bio = generateBio(personality, selectedInterests);

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO users (
      id, username, "displayName", email, "passwordHash", 
      interests, "countryCode", "provinceCode", "districtCode",
      "topicEmbeddings", "tasteEmbedding", "emailVerified", "createdAt",
      bio
    )
    VALUES (
      $1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10::vector[], $11::vector, true, NOW(), $12
    )
    `,
    userId,
    username,
    displayName,
    `${username}@example.com`,
    passwordHash,
    selectedInterests,
    location.countryCode,
    location.provinceCode,
    location.districtCode,
    topicEmbeddingsArray,
    tasteVectorStr,
    bio
  );

  return userId;
}

async function createPost(
  userId: string,
  content: string,
  imageUrls: { publicUrl: string; gcsUri: string } | null,
  daysAgo: number
) {
  // 1. Analyze
  const [multimodalEmbedding, analysis] = await Promise.all([
    getMultimodalEmbedding(content, imageUrls?.gcsUri),
    analyzePostWithGemini(content, imageUrls?.publicUrl),
  ]);

  const normalizedMultimodalVector = normalizeVector(multimodalEmbedding);
  const topicEmbeddings = await Promise.all(
    analysis.topics.map((topic) => getTextEmbedding(topic))
  );

  const embeddingString = `[${normalizedMultimodalVector.join(",")}]`;
  const topicEmbeddingsArray = topicEmbeddings.map(
    (emb) => `[${emb.join(",")}]`
  );

  // 2. Timestamp (Distributed over past 35 days)
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - daysAgo);
  createdAt.setHours(
    Math.floor(Math.random() * 24),
    Math.floor(Math.random() * 60)
  );

  const hashtagRegex = /#(\w+)/g;
  const hashtags = [
    ...new Set(
      [...content.matchAll(hashtagRegex)].map((m) => m[1].toLowerCase())
    ),
  ];

  // 3. Insert Post
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO posts (
      id, content, "userId", privacy, embedding, "topicEmbeddings",
      emotions, "emotionScore", harmful, "harmfulTypes",
      "primaryEmotion", topics, "wisdomOrAdviceMessage", "createdAt",
      hashtags
    )
    VALUES (
      gen_random_uuid()::text, $1, $2, $3::"PostPrivacy",
      $4::vector, $5::vector[],
      $6::"EMOTION", $7, $8, $9::text[],
      $10, $11::text[], $12, $13, $14::text[]
    )
    `,
    content,
    userId,
    PostPrivacy.PUBLIC,
    embeddingString,
    topicEmbeddingsArray,
    analysis.emotion,
    analysis.sentimentScore,
    analysis.harmful,
    analysis.harmfulTypes,
    analysis.primaryEmotion,
    analysis.topics,
    analysis.wisdomOrAdviceMessage,
    createdAt,
    hashtags
  );

  // 4. Handle Media
  const post = await prisma.post.findFirst({
    where: { userId, content, createdAt },
  });
  if (imageUrls && post) {
    await prisma.media.create({
      data: {
        postId: post.id,
        type: MediaType.IMAGE,
        url: imageUrls.publicUrl,
      },
    });
  }

  // 5. Create moderation case if harmful
  if (analysis.harmful && analysis.harmfulTypes.length > 0 && post) {
    try {
      const postEngagement = { likes: 0, comments: 0, shares: 0 }; // New post has no engagement yet
      await createModerationCaseFromAI({
        postId: post.id,
        userId: userId,
        harmful: analysis.harmful,
        harmfulTypes: analysis.harmfulTypes,
        confidence: 0.8,
        postEngagement,
      });
    } catch (error) {
      console.error("Error creating moderation case:", error);
    }
  }

  // 6. Update User Emotion Score (Using production logic)
  await updateUserEmotionStats(userId, analysis);

  return post;
}

async function processPost(userId: string, postData: any, tempDir: string) {
  try {
    let imageUrls = null;
    if (postData.image) {
      try {
        const filename = `seed-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const localPath = path.join(tempDir, filename);
        const gcsPath = `seed-images/${filename}`;
        await downloadImage(postData.image + "&fm=jpg", localPath);
        imageUrls = await uploadToGCS(localPath, gcsPath);
        fs.unlinkSync(localPath);
      } catch (e) {
        console.error("Image upload failed, posting text only");
      }
    }

    const daysAgo = Math.random() * 35;
    return await createPost(userId, postData.content, imageUrls, daysAgo);
  } catch (error: any) {
    console.error(`⚠️  Failed to create post: ${error.message}`);
    return null;
  }
}

// HARMFUL POST SAMPLES FOR DEMO USERS
const HARMFUL_POSTS = [
  {
    content:
      "I hate all people who disagree with me. They should all be silenced. #HateSpeech",
    image: null,
  },
  {
    content: "Violence is the only answer. Fight back with force! #Violence",
    image: null,
  },
  {
    content:
      "This group of people are inferior and don't deserve respect. #Discrimination",
    image: null,
  },
  {
    content: "I'm going to hurt anyone who crosses me. Watch out! #Threat",
    image: null,
  },
  {
    content:
      "Spread this lie about them, they deserve to be destroyed. #Harassment",
    image: null,
  },
  {
    content: "Everyone from that country is evil and should leave. #Xenophobia",
    image: null,
  },
  {
    content: "Women/Men are all the same - worthless. #Sexism",
    image: null,
  },
  {
    content:
      "Let's attack their reputation with false accusations. #Defamation",
    image: null,
  },
  {
    content:
      "I encourage everyone to harm themselves. Life is meaningless. #SelfHarm",
    image: null,
  },
  {
    content: "You should feel ashamed of who you are. #Bullying",
    image: null,
  },
];

// Create demo user with specific warning state
async function createDemoUser(
  username: string,
  displayName: string,
  violationRate: number, // 0-100
  warningCount: number,
  lastWarningDaysAgo: number,
  isPermanentlyBanned: boolean,
  tempDir: string,
  adminId: string
) {
  console.log(
    `  📋 Creating demo user: ${username} (${warningCount} warnings, ${violationRate}% violation rate)...`
  );

  const userId = generateIdFromEntropySize(10);
  const passwordHash = await bcrypt.hash("password123", 10);
  const interests = ["Technology", "Music", "Sports"];
  const location = getSingleValidLocation();

  const topicEmbeddings = await Promise.all(
    interests.map((topic) => getTextEmbedding(topic))
  );

  const dim = topicEmbeddings[0].length;
  const avgVector = Array(dim).fill(0);
  topicEmbeddings.forEach((emb) => {
    emb.forEach((v, i) => (avgVector[i] += v / topicEmbeddings.length));
  });

  const normalized = normalizeVector(avgVector);
  const topicEmbeddingsArray = topicEmbeddings.map(
    (emb) => `[${emb.join(",")}]`
  );
  const tasteVectorStr = `[${normalized.join(",")}]`;
  const bio = `Demo user for warning/ban system testing. Interests: ${interests.join(", ")}`;

  const lastWarningAt = new Date();
  lastWarningAt.setDate(lastWarningAt.getDate() - lastWarningDaysAgo);

  // Create user with specific email for demo-user-ban-3
  const userEmail =
    username === "demo-user-ban-3"
      ? "22520957@gm.uit.edu.vn"
      : `${username}@example.com`;

  // Calculate bannedUntil if permanently banned
  const bannedUntil = isPermanentlyBanned ? new Date("2099-12-31") : null;

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO users (
      id, username, "displayName", email, "passwordHash", 
      interests, "countryCode", "provinceCode", "districtCode",
      "topicEmbeddings", "tasteEmbedding", "emailVerified", "createdAt",
      bio, "warningCount", "lastWarningAt", status, "bannedUntil"
    )
    VALUES (
      $1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10::vector[], $11::vector, true, NOW(), $12, $13, $14, $15, $16
    )
    `,
    userId,
    username,
    displayName,
    userEmail,
    passwordHash,
    interests,
    location.countryCode,
    location.provinceCode,
    location.districtCode,
    topicEmbeddingsArray,
    tasteVectorStr,
    bio,
    warningCount,
    lastWarningAt,
    !isPermanentlyBanned,
    bannedUntil
  );

  // Create 10 posts (mix of harmful and normal based on violation rate)
  const totalPosts = 10;
  const harmfulPostCount = Math.round((violationRate / 100) * totalPosts);
  const normalPostCount = totalPosts - harmfulPostCount;

  console.log(
    `    Creating ${totalPosts} posts (${harmfulPostCount} harmful, ${normalPostCount} normal)...`
  );

  const posts: any[] = [];

  // Create harmful posts
  for (let i = 0; i < harmfulPostCount; i++) {
    try {
      const harmfulPost = HARMFUL_POSTS[i % HARMFUL_POSTS.length];
      const daysAgo = Math.floor(Math.random() * 30);
      const post = await createPost(userId, harmfulPost.content, null, daysAgo);
      if (post) posts.push(post);
    } catch (error: any) {
      console.error(`    ⚠️  Failed harmful post: ${error.message}`);
    }
  }

  // Create normal posts
  const normalPosts = SAMPLE_POSTS.POSITIVE.slice(0, normalPostCount);
  for (let i = 0; i < normalPostCount; i++) {
    try {
      const normalPost = normalPosts[i % normalPosts.length];
      const daysAgo = Math.floor(Math.random() * 30);
      const post = await processPost(userId, normalPost, tempDir);
      if (post) posts.push(post);
    } catch (error: any) {
      console.error(`    ⚠️  Failed normal post: ${error.message}`);
    }
  }

  // Create UserWarning records
  for (let i = 0; i < warningCount; i++) {
    const warningDaysAgo = lastWarningDaysAgo + (warningCount - 1 - i) * 5; // Spread warnings over time
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() - warningDaysAgo);

    // Pick a random harmful post for this warning
    const harmfulPostsForUser = posts.filter((p) => p && p.harmful);
    const warningPost = harmfulPostsForUser[i % harmfulPostsForUser.length];

    await prisma.userWarning.create({
      data: {
        userId: userId,
        issuedBy: adminId,
        message: `Warning ${i + 1}: You have violated our community guidelines. Please review and delete harmful content within 72 hours.`,
        deadline: new Date(warningDate.getTime() + 72 * 60 * 60 * 1000),
        postId: warningPost?.id || null,
        createdAt: warningDate,
      },
    });
  }

  await updateUserTasteEmbedding(userId);

  // Query actual totalViolateCounts from moderation cases
  const totalViolateCounts = await prisma.moderationCase.count({
    where: {
      userId: userId,
      status: { in: ["QUEUED", "IN_REVIEW"] },
    },
  });

  // Update user with actual totalViolateCounts
  await prisma.user.update({
    where: { id: userId },
    data: { totalViolateCounts },
  });

  console.log(
    `    ✅ Created demo user ${username} with ${posts.length} posts, ${warningCount} warnings, ${totalViolateCounts} violations`
  );

  return { userId, posts };
}

async function main() {
  const tempDir = path.join(process.cwd(), ".temp-seed");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  try {
    // 1. CLEANUP
    console.log("🧹 Cleaning database...");
    await prisma.userWarning.deleteMany();
    await prisma.appealUserReport.deleteMany();
    await prisma.report.deleteMany();
    await prisma.moderationCase.deleteMany();
    await prisma.media.deleteMany();
    await prisma.post.deleteMany();
    await prisma.deviceSession.deleteMany();
    await prisma.user.deleteMany();

    // 1.5 CREATE ADMIN USER
    console.log("👑 Creating Admin User...");
    const adminId = generateIdFromEntropySize(10);
    const adminPasswordHash = await bcrypt.hash("password123", 10);

    await prisma.user.create({
      data: {
        id: adminId,
        username: "admin",
        displayName: "Admin User",
        email: "admin@example.com",
        passwordHash: adminPasswordHash,
        emailVerified: true,
        role: "ADMIN",
        bio: "System Administrator",
        interests: ["Technology", "Moderation", "Education"],
      },
    });
    console.log(
      "  ✅ Admin user created (username: admin, password: password123)"
    );

    console.log("🌍 Generating Location Clusters...");
    const hub1 = getSingleValidLocation();
    const hub2 = getSingleValidLocation();
    const hub3 = getSingleValidLocation();

    console.log(`   📍 Hub A: ${hub1.label}`);
    console.log(`   📍 Hub B: ${hub2.label}`);
    console.log(`   📍 Hub C: ${hub3.label}`);
    // 2. PREPARE USERS (100 TOTAL)
    console.log("👥 Creating 100 Users...");

    // Special Users
    const specialUsersDef = [
      {
        username: "alice",
        displayName: "Alice",
        interests: ["Technology", "Health", "Education"],
        personality: "POSITIVE",
        location: hub1,
      },
      {
        username: "bob",
        displayName: "Bob",
        interests: ["Sports", "Food", "Travel"],
        personality: "NEUTRAL",
        location: hub1,
      },
      {
        username: "charlie_kim",
        displayName: "Charlie Kim",
        interests: ["Music", "Travel", "Photography"],
        personality: "POSITIVE",
        location: hub2,
      },
      {
        username: "diana_patel",
        displayName: "Diana Patel",
        interests: ["Art", "Books", "Education"],
        personality: "NEUTRAL",
        location: hub3,
      },
    ];

    // Regular Users Generation (Using Expanded Name Lists)
    const regularUsersDef = [];
    const usedNames = new Set<string>();

    for (let i = 0; i < 96; i++) {
      // Randomly pick First and Last name
      const firstName =
        FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName =
        LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

      // Ensure uniqueness
      let baseUsername = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
      let username = baseUsername;
      let counter = 1;
      while (usedNames.has(username)) {
        username = `${baseUsername}${counter}`;
        counter++;
      }
      usedNames.add(username);

      // Random interests and personality
      const interests = INTEREST_TAGS.sort(() => 0.5 - Math.random()).slice(
        0,
        3
      );
      const personalities = ["POSITIVE", "NEUTRAL", "NEGATIVE", "HARMFUL"]; // Used for Bio generation
      const p = personalities[Math.floor(Math.random() * personalities.length)];

      let assignedLocation: LocationCoords;
      const locRand = Math.random();

      if (locRand < 0.3) assignedLocation = hub1;
      else if (locRand < 0.5) assignedLocation = hub2;
      else if (locRand < 0.6) assignedLocation = hub3;
      else assignedLocation = getSingleValidLocation();

      regularUsersDef.push({
        username: username,
        displayName: `${firstName} ${lastName}`,
        interests: interests,
        personality: p,
        location: assignedLocation,
      });
    }

    const allUserIds: string[] = [];

    // Create Special Users
    for (const u of specialUsersDef) {
      const uid = await generateUserProfile(
        u.username,
        u.displayName,
        u.interests,
        u.personality,
        u.location
      );
      allUserIds.push(uid);
    }
    // Create Regular Users
    for (const u of regularUsersDef) {
      const uid = await generateUserProfile(
        u.username,
        u.displayName,
        u.interests,
        u.personality,
        u.location
      );
      allUserIds.push(uid);
    }

    // 3. PREPARE POST DECK (Target 329 unique posts)
    console.log("🃏 Preparing Post Deck...");
    let deck: any[] = [];

    // Flatten Sample Posts
    Object.values(SAMPLE_POSTS).forEach((arr) => deck.push(...arr));

    // Duplicate if needed to fill deck
    while (deck.length < 329) {
      deck = [...deck, ...deck];
    }
    deck = deck.slice(0, 329); // Trim to exactly 329

    // Shuffle Deck (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // 4. DISTRIBUTE POSTS (329 total: 90 for special users, 239 for regular users)
    const specialAllocation = deck.slice(0, 90); // 90 posts for top 4 special users
    const regularAllocation = deck.slice(90, 329); // 239 posts for 96 regular users

    console.log(
      `📦 Distribution: 90 posts to 4 Special Users, 239 posts to 96 Regular Users.`
    );

    // Process Special Users (Indices 0-3 in allUserIds)
    for (let i = 0; i < 4; i++) {
      const userId = allUserIds[i];
      const myPosts = specialAllocation.filter((_, idx) => idx % 4 === i);
      console.log(
        `  > Special User ${specialUsersDef[i].username} getting ${myPosts.length} posts...`
      );

      let successCount = 0;
      for (const p of myPosts) {
        try {
          const result = await processPost(userId, p, tempDir);
          if (result) successCount++;
        } catch (error: any) {
          console.error(`    ⚠️  Failed: ${error.message}`);
        }
      }
      console.log(`    ✅ Created ${successCount}/${myPosts.length} posts`);
      await updateUserTasteEmbedding(userId);
    }

    // Process Regular Users (Indices 4-99 in allUserIds)
    for (let i = 0; i < 96; i++) {
      const userId = allUserIds[i + 4];
      const myPosts = regularAllocation.filter((_, idx) => idx % 96 === i);

      if (i % 10 === 0) console.log(`  > Processing Regular Users batch...`);

      let successCount = 0;
      for (const p of myPosts) {
        try {
          const result = await processPost(userId, p, tempDir);
          if (result) successCount++;
        } catch (error: any) {
          // Silent fail to avoid log spam
        }
      }
      if (i % 10 === 0 && successCount < myPosts.length) {
        console.log(
          `    ⚠️  Some posts failed (${successCount}/${myPosts.length} succeeded)`
        );
      }
      await updateUserTasteEmbedding(userId);
    }

    // 5. CREATE DEMO USERS FOR WARNING/BAN SYSTEM
    console.log("\n🎯 Creating Demo Users for Warning/Ban System...");

    // User A: 3 warnings, 80% violation rate, permanently banned
    const userA = await createDemoUser(
      "demo-user-ban-3",
      "Demo User A (Banned)",
      80, // 80% violation rate
      3, // 3 warnings
      4, // last warning 4 days ago
      true, // permanently banned
      tempDir,
      adminId
    );

    // Send permanent ban email for demo user A
    await sendPermanentBanEmail(
      "22520957@gm.uit.edu.vn",
      "Demo User A (Banned)",
      3
    );
    console.log("  ✅ Sent permanent ban email to demo-user-ban-3");

    // User B: 1 warning, 70% violation rate
    const userB = await createDemoUser(
      "demo-user-warn-1",
      "Demo User B (1 Warning)",
      70, // 70% violation rate
      1, // 1 warning
      5, // last warning 5 days ago
      false, // not banned
      tempDir,
      adminId
    );

    // User C: 2 warnings, 75% violation rate
    const userC = await createDemoUser(
      "demo-user-warn-2",
      "Demo User C (2 Warnings)",
      75, // 75% violation rate
      2, // 2 warnings
      3, // last warning 3 days ago
      false, // not banned
      tempDir,
      adminId
    );

    // Add demo users to allUserIds for device sessions
    allUserIds.push(userA.userId, userB.userId, userC.userId);

    // 6. CREATE APPEALS FOR DEMO USERS
    console.log("\n📝 Creating Appeals for Demo Users...");
    const allDemoPosts = [
      ...userA.posts,
      ...userB.posts,
      ...userC.posts,
    ].filter((p) => p);
    const harmfulDemoPosts = allDemoPosts.filter((p) => p.harmful);

    // Create 5-10 appeals with different statuses
    const appealStatuses = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"];
    for (let i = 0; i < Math.min(10, harmfulDemoPosts.length); i++) {
      const post = harmfulDemoPosts[i];
      const status = appealStatuses[i % appealStatuses.length];
      const daysAgo = Math.floor(Math.random() * 30);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);

      await prisma.appealUserReport.create({
        data: {
          userId: post.userId,
          postId: post.id,
          appealReason: `I believe this post was incorrectly flagged. It does not violate community guidelines. Appeal #${i + 1}`,
          status: status as any,
          adminNotes:
            status === "APPROVED"
              ? "Upon review, this post does not violate guidelines."
              : status === "REJECTED"
                ? "This post clearly violates our hate speech policy."
                : null,
          createdAt: createdAt,
          updatedAt:
            status !== "PENDING"
              ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000)
              : createdAt,
        },
      });

      // If appeal was approved, update moderation case status to DISMISSED
      if (status === "APPROVED") {
        await prisma.moderationCase.updateMany({
          where: { postId: post.id },
          data: { status: "DISMISSED" },
        });
      }
    }
    console.log(
      `  ✅ Created ${Math.min(10, harmfulDemoPosts.length)} appeals`
    );

    // 7. CREATE REPORTS FOR DEMO
    console.log("\n🚨 Creating Demo Reports...");

    // Get harmful posts (posts with moderation cases) for reports
    const harmfulModCases = await prisma.moderationCase.findMany({
      where: {
        postId: { not: null },
        status: { in: ["QUEUED", "IN_REVIEW"] },
      },
      select: { postId: true, userId: true },
      take: 25,
    });

    const allPosts = harmfulModCases.map((mc) => ({
      id: mc.postId!,
      userId: mc.userId,
    }));

    // Create 10-15 post reports
    const reportReasons = [
      "SPAM",
      "HARASSMENT",
      "HATE_SPEECH",
      "VIOLENCE",
      "NUDITY",
      "OTHER",
    ] as const;
    const reportStatuses = [
      "PENDING",
      "REVIEWED",
      "RESOLVED",
      "DISMISSED",
    ] as const;

    for (let i = 0; i < 15 && i < allPosts.length; i++) {
      const post = allPosts[i];
      const reporterId =
        allUserIds[Math.floor(Math.random() * allUserIds.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);

      await prisma.report.create({
        data: {
          reporterId: reporterId,
          reportedId: post.userId!,
          postId: post.id,
          type: reportReasons[i % reportReasons.length],
          reason: reportReasons[i % reportReasons.length],
          status: reportStatuses[i % reportStatuses.length],
          adminNotes:
            i % 3 === 0 ? "Reviewed and found to violate guidelines" : null,
          createdAt: createdAt,
        },
      });
    }
    console.log(`  ✅ Created 15 post reports`);

    // Create 5-8 user reports
    for (let i = 0; i < 8 && i < allUserIds.length; i++) {
      const reporterId = allUserIds[i];
      const reportedId = allUserIds[(i + 10) % allUserIds.length];
      const daysAgo = Math.floor(Math.random() * 30);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);

      await prisma.report.create({
        data: {
          reporterId: reporterId,
          reportedId: reportedId,
          type: reportReasons[i % reportReasons.length],
          reason: reportReasons[i % reportReasons.length],
          status: reportStatuses[i % reportStatuses.length],
          adminNotes: i % 2 === 0 ? "User behavior reviewed" : null,
          createdAt: createdAt,
        },
      });
    }
    console.log(`  ✅ Created 8 user reports`);

    // 8. CREATE DEVICE SESSIONS
    console.log("🔐 Creating trusted device sessions...");
    const sessions = [...allUserIds, adminId].map((userId) => ({
      userId,
      deviceId: "seed-device-trusted",
      deviceName: "Seed Device",
      userAgent: "Seed Script/1.0",
      ipAddress: "127.0.0.1",
      isTrusted: true,
      lastUsedAt: new Date(),
    }));
    await prisma.deviceSession.createMany({ data: sessions });

    console.log("\n✅ Seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - Admin User: admin / password123`);
    console.log(`   - All Users Password: password123`);
    console.log(`   - Regular Users: 100`);
    console.log(`   - Demo Users: 3`);
    console.log(
      `     • demo-user-ban-3: 3 warnings, 80% violation rate, BANNED (email: 22520957@gm.uit.edu.vn)`
    );
    console.log(`     • demo-user-warn-1: 1 warning, 70% violation rate`);
    console.log(`     • demo-user-warn-2: 2 warnings, 75% violation rate`);
    console.log(`   - Total Posts: ~${329 + 30} (including demo posts)`);
    console.log(`   - Appeals: ${Math.min(10, harmfulDemoPosts.length)}`);
    console.log(`   - Reports: 23 (15 post reports + 8 user reports)`);
    console.log(`\n🎯 Ready for demo! See DEMO_GUIDE.md for instructions.`);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
    await prisma.$disconnect();
  }
}

main();

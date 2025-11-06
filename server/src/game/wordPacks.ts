import { WordEntry } from './types.js';

const foodWords = [
  'apple', 'banana', 'carrot', 'bread', 'butter', 'cheese', 'yogurt', 'pasta', 'pizza',
  'burger', 'taco', 'sushi', 'salmon', 'steak', 'omelet', 'pancake', 'waffle', 'cereal',
  'granola', 'avocado', 'tomato', 'spinach', 'broccoli', 'pepper', 'garlic', 'onion',
  'potato', 'pumpkin', 'lettuce', 'cabbage', 'cauliflower', 'strawberry', 'blueberry',
  'raspberry', 'blackberry', 'watermelon', 'cantaloupe', 'pineapple', 'mango', 'papaya',
  'kiwi', 'peach', 'plum', 'cherry', 'grape', 'pear', 'orange', 'lemon', 'lime', 'coconut',
  'almond', 'walnut', 'pistachio', 'hazelnut', 'cashew', 'peanut', 'sesame', 'basil',
  'oregano', 'thyme'
];

const animalWords = [
  'lion', 'tiger', 'cheetah', 'leopard', 'elephant', 'giraffe', 'zebra', 'rhinoceros',
  'hippo', 'crocodile', 'alligator', 'kangaroo', 'koala', 'wombat', 'panda', 'sloth',
  'otter', 'beaver', 'fox', 'wolf', 'coyote', 'bear', 'moose', 'deer', 'antelope', 'bison',
  'buffalo', 'goat', 'sheep', 'horse', 'donkey', 'camel', 'llama', 'alpaca', 'monkey',
  'gorilla', 'chimpanzee', 'orangutan', 'lemur', 'penguin', 'seal', 'walrus', 'dolphin',
  'whale', 'shark', 'eagle', 'falcon', 'owl', 'sparrow', 'robin', 'parrot', 'flamingo',
  'peacock', 'turkey', 'chicken', 'duck', 'goose', 'swan', 'lobster', 'crab'
];

const objectWords = [
  'notebook', 'pencil', 'marker', 'eraser', 'backpack', 'laptop', 'tablet', 'smartphone',
  'headphones', 'microphone', 'camera', 'tripod', 'flashlight', 'lantern', 'candle',
  'blanket', 'pillow', 'mattress', 'wardrobe', 'dresser', 'bookshelf', 'mirror', 'clock',
  'calendar', 'wallet', 'umbrella', 'suitcase', 'scissors', 'stapler', 'paperclip',
  'binder', 'folder', 'hammer', 'wrench', 'screwdriver', 'pliers', 'saw', 'drill', 'ladder',
  'paintbrush', 'canvas', 'easel', 'guitar', 'piano', 'violin', 'trumpet', 'drum', 'flute',
  'saxophone', 'helmet', 'gloves', 'goggles', 'telescope', 'binoculars', 'compass',
  'thermometer', 'microscope', 'projector', 'router', 'charger'
];

const placeWords = [
  'library', 'museum', 'aquarium', 'zoo', 'stadium', 'airport', 'harbor', 'mountain',
  'valley', 'desert', 'rainforest', 'waterfall', 'island', 'peninsula', 'volcano',
  'canyon', 'forest', 'meadow', 'prairie', 'savanna', 'tundra', 'village', 'city',
  'capital', 'suburb', 'downtown', 'market', 'bazaar', 'temple', 'cathedral', 'chapel',
  'mosque', 'synagogue', 'school', 'university', 'laboratory', 'hospital', 'clinic',
  'pharmacy', 'bakery', 'restaurant', 'cafe', 'theater', 'cinema', 'gallery', 'workshop',
  'factory', 'warehouse', 'farm', 'orchard', 'vineyard', 'beach', 'coast', 'lagoon',
  'harborfront', 'boardwalk', 'castle', 'fortress', 'palace', 'courthouse'
];

const schoolWords = [
  'teacher', 'student', 'principal', 'counselor', 'classroom', 'textbook', 'worksheet',
  'homework', 'assignment', 'project', 'presentation', 'laboratory', 'gymnasium',
  'auditorium', 'cafeteria', 'playground', 'bulletin', 'semester', 'trimester', 'quarter',
  'syllabus', 'notebook', 'highlighter', 'calculator', 'protractor', 'compass', 'backpack',
  'locker', 'timetable', 'bell', 'recess', 'detention', 'graduation', 'diploma', 'locker',
  'uniform', 'curriculum', 'club', 'advisor', 'tutor', 'study', 'research', 'library',
  'exam', 'quiz', 'lecture', 'seminar', 'campus', 'scholarship', 'tuition', 'essay',
  'science', 'history', 'geography', 'algebra', 'geometry', 'calculus', 'biology',
  'chemistry', 'physics'
];

const techWords = [
  'algorithm', 'binary', 'compiler', 'debugger', 'firewall', 'bandwidth', 'protocol',
  'database', 'server', 'client', 'frontend', 'backend', 'fullstack', 'microservice',
  'container', 'virtualization', 'cloud', 'devops', 'pipeline', 'repository', 'branch',
  'commit', 'merge', 'deploy', 'hosting', 'serverless', 'api', 'endpoint', 'websocket',
  'encryption', 'token', 'authentication', 'authorization', 'cache', 'latency', 'throughput',
  'microchip', 'sensor', 'robot', 'drone', 'wearable', 'blockchain', 'quantum', 'neural',
  'dataset', 'training', 'inference', 'prompt', 'syntax', 'variable', 'function', 'class',
  'object', 'module', 'package', 'library', 'framework', 'runtime', 'thread', 'process'
];

const categories: Record<string, WordEntry[]> = {
  Food: foodWords.map((word) => ({ word, category: 'Food' })),
  Animals: animalWords.map((word) => ({ word, category: 'Animals' })),
  Objects: objectWords.map((word) => ({ word, category: 'Objects' })),
  Places: placeWords.map((word) => ({ word, category: 'Places' })),
  School: schoolWords.map((word) => ({ word, category: 'School' })),
  Tech: techWords.map((word) => ({ word, category: 'Tech' }))
};

const generalPack: WordEntry[] = [
  ...categories.Food.slice(0, 40),
  ...categories.Animals.slice(0, 40),
  ...categories.Objects.slice(0, 40),
  ...categories.Places.slice(0, 40),
  ...categories.School.slice(0, 40),
  ...categories.Tech.slice(0, 40)
];

export const defaultWordPacks: Record<string, WordEntry[]> = {
  General: generalPack,
  Categories: Object.values(categories).flat(),
  ...categories
};

export const defaultPackNames = Object.keys(defaultWordPacks);

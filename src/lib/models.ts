export const models = {
  ageProgression: {
    model: "fal-ai/image-editing/age-progression",
    description:
      "See how a person might look as they age. Change the apparent age of a face in the image.",
    promptLabel: "Age Change",
    promptPlaceholder: "20 years older",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  baby: {
    model: "fal-ai/image-editing/baby-version",
    description:
      "Transform a face into a baby version, making the subject look much younger.",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  backgroundChange: {
    model: "fal-ai/image-editing/background-change",
    description:
      "Replace the background of your image with any scene or setting you describe.",
    promptLabel: "Background Prompt",
    promptPlaceholder: "beach sunset with palm trees",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  cartoonify: {
    model: "fal-ai/image-editing/cartoonify",
    description:
      "Turn your photo into a cartoon-style image with bold lines and vibrant colors.",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  colorCorrection: {
    model: "fal-ai/image-editing/color-correction",
    description:
      "Adjust the colors in your image for a more natural or stylized look.",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  expressionChange: {
    model: "fal-ai/image-editing/expression-change",
    description:
      "Change the facial expression of the subject, such as from neutral to smiling or sad.",
    promptLabel: "Expression Prompt",
    promptPlaceholder: "sad",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  faceEnhancement: {
    model: "fal-ai/image-editing/face-enhancement",
    description:
      "Enhance facial features for a clearer, more professional appearance.",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  hairChange: {
    model: "fal-ai/image-editing/hair-change",
    description:
      "Change the hairstyle or hair color of the subject in the image.",
    promptLabel: "Hair Style Prompt",
    promptPlaceholder: "bald",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  objectRemoval: {
    model: "fal-ai/image-editing/object-removal",
    description:
      "Remove unwanted objects or people from your image by describing them.",
    promptLabel: "Objects to Remove",
    promptPlaceholder: "background people",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  photoRestoration: {
    model: "fal-ai/image-editing/photo-restoration",
    description:
      "Restore old or damaged photos, removing scratches and improving quality.",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  professional: {
    model: "fal-ai/image-editing/professional-photo",
    description:
      "Enhance your photo for a professional look, perfect for resumes or social media.",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  sceneComposition: {
    model: "fal-ai/image-editing/scene-composition",
    description:
      "Place your subject in any scene you imagine, from enchanted forests to urban settings, with professional composition and lighting",
    promptLabel: "Scene Description",
    promptPlaceholder: "enchanted forest",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  styleTransfer: {
    model: "fal-ai/image-editing/style-transfer",
    description:
      "Apply a new artistic style to your image, such as making it look like a painting or drawing.",
    promptLabel: "Style Prompt",
    promptPlaceholder: "Van Gogh's Starry Night",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  textRemoval: {
    model: "fal-ai/image-editing/text-removal",
    description:
      "Remove all text and writing from images while preserving the background and natural appearance.",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  timeOfDay: {
    model: "fal-ai/image-editing/time-of-day",
    description:
      "Change the time of day in your image, such as turning day into night or vice versa.",
    promptLabel: "Time of Day",
    promptPlaceholder: "golden hour",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
  weatherEffect: {
    model: "fal-ai/image-editing/weather-effect",
    description:
      "Add or change weather effects in your image, such as rain, snow, or sunshine while maintaining scene's mood.",
    promptLabel: "Weather Effect",
    promptPlaceholder: "heavy snowfall",
    exampleInput:
      "https://v3.fal.media/files/zebra/hAjCkcyly4gsS9-cptD3Y_image%20(20).png",
    exampleOutput:
      "https://fal.media/files/lion/t7L2EtPYDkz1-fBlJsodJ_4e7306f22c8748258f96d1e5ed5a4cfe.jpg",
  },
} satisfies Record<string, Model>;

type FalImageEditingPrefix = "fal-ai/image-editing/";

type FalImageEditingSlugs =
  | "age-progression"
  | "baby-version"
  | "background-change"
  | "cartoonify"
  | "color-correction"
  | "expression-change"
  | "face-enhancement"
  | "hair-change"
  | "object-removal"
  | "photo-restoration"
  | "professional-photo"
  | "scene-composition"
  | "style-transfer"
  | "text-removal"
  | "time-of-day"
  | "weather-effect";

type FalImageEditingModel = `${FalImageEditingPrefix}${FalImageEditingSlugs}`;

type Model = {
  model: FalImageEditingModel;
  description: string;
  promptLabel?: string;
  promptPlaceholder?: string;
  exampleInput: string;
  exampleOutput: string;
};
